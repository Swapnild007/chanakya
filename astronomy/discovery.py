"""Reproducible single-product transit screening (all times in days)."""
import csv
import hashlib
import io
from dataclasses import asdict, dataclass

import numpy as np
from scipy.ndimage import median_filter

from .ephemeris import estimate
from .artifact_vetting import cadence_context, event_evidence


@dataclass(frozen=True)
class Settings:
    minimum_period: float = 0.5
    maximum_period: float = 5
    trend_days: float = 2
    min_transits: int = 3
    min_snr: float = 8
    max_signals: int = 2


def read_observation(data, filename):
    meta = {"file": filename, "sha256": hashlib.sha256(data).hexdigest(),
            "target": None, "mission": None, "bjd_reference": None,
            "provenance": "user-supplied", "time_system": "unspecified"}
    if filename.lower().endswith((".fit", ".fits")):
        from astropy.io import fits
        with fits.open(io.BytesIO(data), memmap=False) as hdus:
            hdus.verify("exception")
            table = next((h for h in hdus if isinstance(h, fits.BinTableHDU)
                          and "TIME" in h.columns.names), None)
            if table is None:
                raise ValueError("FITS contains no TIME light-curve table")
            header = hdus[0].header.copy()
            header.update(table.header)
            names = table.columns.names
            flux = next((c for c in ("PDCSAP_FLUX", "SAP_FLUX", "FLUX") if c in names), None)
            if flux is None or str(header.get("TIMEUNIT", "d")).lower() not in ("d", "day", "days"):
                raise ValueError("FITS requires flux and time in days")
            quality = next((c for c in ("QUALITY", "SAP_QUALITY") if c in names), None)
            reference = header.get("BJDREFI")
            mission = header.get("MISSION", header.get("TELESCOP"))
            kepler_id = "EPIC" if mission == "K2" or "CAMPAIGN" in header else "KIC"
            target = next((f"{kind} {int(header[key])}" for key, kind in
                           (("TICID", "TIC"), ("EPICID", "EPIC"), ("KEPLERID", kepler_id))
                           if header.get(key)), None)
            meta.update(target=target, mission=mission,
                        bjd_reference=float(reference) + float(header.get("BJDREFF", 0))
                        if reference is not None else None,
                        time_system=str(header.get("TIMESYS", "unspecified")),
                        flux_column=flux, quality_column=quality,
                        ra=header.get("RA_OBJ"), dec=header.get("DEC_OBJ"))
            return (np.asarray(table.data["TIME"], float), np.asarray(table.data[flux], float),
                    np.asarray(table.data[quality], float) if quality else None, meta)
    if not filename.lower().endswith(".csv"):
        raise ValueError("Choose a .csv, .fits or .fit observation")
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    names = {key.strip().lower(): key for key in reader.fieldnames or ()}
    tcol = next((c for c in ("time", "btjd", "bkjd", "bjd") if c in names), None)
    fcol = next((c for c in ("pdcsap_flux", "sap_flux", "flux") if c in names), None)
    qcol = next((c for c in ("quality", "sap_quality") if c in names), None)
    if not tcol or not fcol:
        raise ValueError("CSV requires time and flux columns")

    def numeric(row, column):
        try:
            return float(row[names[column]])
        except (ValueError, TypeError):
            return np.nan

    rows = [(numeric(row, tcol), numeric(row, fcol),
             numeric(row, qcol) if qcol else 0) for row in reader]
    columns = np.asarray(rows, dtype=float).reshape((-1, 3)).T
    meta.update(flux_column=fcol, quality_column=qcol)
    return columns[0], columns[1], columns[2] if qcol else None, meta


def robust_sigma(x):
    return 1.4826 * np.median(np.abs(x - np.median(x)))


def preprocess(time, flux, quality, settings):
    valid = np.isfinite(time) & np.isfinite(flux)
    clean = valid & (quality == 0) if quality is not None else valid
    t, indices = np.unique(time[clean], return_index=True)
    f = flux[clean][indices]
    if t.size < 100 or t.size > 100_000:
        raise ValueError("Analysis requires 100–100,000 unique usable cadences")
    dt = np.diff(t)
    cadence = float(np.median(dt))
    breaks = np.flatnonzero(dt > 5 * cadence) + 1
    raw = f.copy()
    residual = f.copy()
    segments = np.split(np.arange(t.size), breaks)
    for idx in segments:
        level = float(np.median(f[idx]))
        if level <= 0:
            raise ValueError("Every observing segment requires positive median flux")
        raw[idx] /= level
        # Smooth each uninterrupted segment separately. Never clip negative dips.
        width = min(2001, 2 * int(settings.trend_days / cadence / 2) + 1,
                    2 * ((idx.size - 1) // 2) + 1)
        trend = median_filter(raw[idx], size=width, mode="nearest") if width >= 5 else 1
        if np.any(trend <= 0):
            raise ValueError("Non-positive detrending baseline")
        residual[idx] = raw[idx] / trend
    sigma = max(float(robust_sigma(residual)), 1e-9)
    keep = residual < 1 + 8 * sigma
    audit = {"input": len(time), "used": int(keep.sum()), "invalid": int((~valid).sum()),
             "quality_rejected": int(valid.sum() - clean.sum()), "quality_policy": "require zero when present",
             "duplicates_removed": int(clean.sum() - t.size), "positive_outliers_removed": int((~keep).sum()),
             "cadence_days": cadence, "noise_mad": sigma, "gap_count": len(breaks),
             "coverage_days": float(t[-1] - t[0])}
    if keep.sum() < 100:
        raise ValueError("Too few cadences after outlier removal")
    return t[keep], raw[keep], residual[keep], audit


def search(t, y, audit, settings):
    """Search a baseline-constrained grid with Astropy BoxLeastSquares."""
    from astropy.timeseries import BoxLeastSquares

    cadence, sigma = audit["cadence_days"], audit["noise_mad"]
    span = t[-1] - t[0]
    low = max(settings.minimum_period, 8 * cadence)
    high = min(settings.maximum_period, span / (settings.min_transits - 1))
    durations = np.array([.04, .07, .10, .15, .22, .32])
    durations = durations[(durations >= 2 * cadence) & (durations <= settings.trend_days / 4)
                          & (5 * durations < high)]
    if high <= low or not len(durations):
        raise ValueError("Insufficient baseline or cadence for the requested search")
    model = BoxLeastSquares(t - t[0], y, dy=np.full(len(y), sigma))
    trial_budget = 24_000
    dense_steps = (1 / low - 1 / high) * span ** 2 / durations.min()
    factor = float(max(1, dense_steps / (trial_budget - 2)))
    periods = model.autoperiod(durations, minimum_period=low, maximum_period=high,
                               frequency_factor=factor)
    periods = periods[(periods >= low) & (periods <= high)]
    best = None
    for duration in durations:
        trial = periods[periods > 5 * duration]
        if not len(trial):
            continue
        result = model.power(trial, duration, objective="snr", oversample=10)
        index = int(np.argmax(np.where(np.isfinite(result.depth_snr), result.depth_snr, -np.inf)))
        if factor > 1 and np.isfinite(result.depth_snr[index]):
            frequency = 1 / result.period[index]
            step = factor * durations.min() / span ** 2
            neighborhood = 1 / np.linspace(max(1 / high, frequency - step),
                                            min(1 / max(low, 5 * duration), frequency + step), 17)
            result = model.power(neighborhood, duration, objective="snr", oversample=10)
            index = int(np.argmax(np.where(np.isfinite(result.depth_snr), result.depth_snr, -np.inf)))
        snr = float(result.depth_snr[index])
        if np.isfinite(snr) and (best is None or snr > best["snr"]):
            best = {"period_days": float(result.period[index]),
                    "epoch_days": float(result.transit_time[index] + t[0]),
                    "duration_days": float(result.duration[index]), "depth": float(result.depth[index]),
                    "snr": snr, "period_trials": len(periods), "phase_oversample": 10, "frequency_grid_factor": factor}
    return best


def red_noise_snr(time, flux, inside, depths, duration, cadence, noise):
    if not depths:
        return None
    outside = ~inside
    bins = np.floor((time[outside] - time[0]) / duration).astype(int)
    # Compact labels avoid allocating over long observation gaps.
    _, index = np.unique(bins, return_inverse=True)
    counts = np.bincount(index)
    sums = np.bincount(index, weights=flux[outside])
    good = counts >= max(2, .6 * duration / cadence)
    if good.sum() < 12:
        return None
    scatter = max(float(robust_sigma(sums[good] / counts[good])), noise / np.sqrt(duration / cadence))
    return float(np.median(depths) * np.sqrt(len(depths)) / scatter)


def secondary_event(cycles, flux, baseline, period, duration, depth, noise):
    phase = cycles % 1
    half = duration / (2 * period)
    best = None
    # Look for repeated off-phase eclipses. Limit phase resolution to four bins per duration.
    for center in np.linspace(.15, .85, max(17, min(100, int(1.4 / half)))):
        inside = np.abs(phase - center) < half
        if inside.sum() < 6:
            continue
        drop = float(baseline - flux[inside].mean())
        snr = drop * np.sqrt(inside.sum()) / noise
        if drop < .20 * depth or snr < 9:
            continue
        labels = np.floor(cycles[inside]).astype(int)
        _, index = np.unique(labels, return_inverse=True)
        counts = np.bincount(index)
        sums = np.bincount(index, weights=baseline - flux[inside])
        supported = np.count_nonzero((counts >= 2) & (sums >= 2.5 * noise * np.sqrt(counts)))
        if supported >= 3 and (best is None or snr > best["snr"]):
            best = {"phase": float(center), "snr": float(snr), "events": int(supported)}
    return best


def vet(t, y, candidate, audit, settings):
    period, epoch, duration = (candidate[key] for key in ("period_days", "epoch_days", "duration_days"))
    cycles = (t - epoch) / period
    phase = (cycles + .5) % 1 - .5
    inside = np.abs(phase) < duration / (2 * period)
    events = np.rint(cycles).astype(int)
    noise = audit["noise_mad"]
    baseline = np.median(y[~inside])
    supported, depths = [], []
    for cycle in np.unique(events[inside]):
        samples = y[inside & (events == cycle)]
        depth = float(baseline - np.mean(samples))
        if len(samples) >= 2 and depth * np.sqrt(len(samples)) >= 2 * noise:
            supported.append(int(cycle))
            depths.append(depth)
    groups = [y[inside & (events % 2 == parity)] for parity in (0, 1)]
    odd_even = (float(abs(groups[0].mean() - groups[1].mean()) /
                      (noise * np.sqrt(1 / len(groups[0]) + 1 / len(groups[1]))))
                if all(len(group) >= 3 for group in groups) else None)
    secondary = y[np.abs(np.abs(phase) - .5) < duration / (2 * period)]
    secondary_snr = float((baseline - secondary.mean()) * np.sqrt(len(secondary)) / noise) if len(secondary) >= 6 else None
    warnings = []
    correlated_snr = red_noise_snr(t, y, inside, depths, duration, audit["cadence_days"], noise)
    if correlated_snr is not None and correlated_snr < 7:
        warnings.append("Weak detection relative to transit-duration noise")
    off_phase = secondary_event(cycles, y, baseline, period, duration, candidate["depth"], noise)
    # Require material depth contrast as well as nominal significance.
    if (odd_even is not None and odd_even >= 5
            and abs(groups[0].mean() - groups[1].mean()) >= .20 * candidate["depth"]):
        warnings.append("Odd/even depth difference")
    if (secondary_snr is not None and secondary_snr >= 5
            and baseline - secondary.mean() >= .20 * candidate["depth"]):
        warnings.append("Secondary eclipse near phase 0.5")
    elif off_phase is not None:
        warnings.append("Repeated secondary eclipse away from phase 0.5")
    if depths and max(depths) > 3 * min(depths):
        warnings.append("Inconsistent event depths")
    if candidate["depth"] > .1:
        warnings.append("Deep eclipse")
    candidate.update(observed_transits=len(supported), event_cycles=supported,
                     odd_even_sigma=odd_even, secondary_snr=secondary_snr,
                     duration_noise_snr=correlated_snr, off_phase_secondary=off_phase, warnings=warnings,
                     depth_error_white_noise=float(noise / np.sqrt(inside.sum())),
                     classification=("Insufficient evidence" if len(supported) < settings.min_transits
                                     else "Rejected or likely false positive" if warnings
                                     else "Transit-like signal — catalogue comparison pending"))


def analyze(time, flux, quality=None, metadata=None, settings=Settings()):
    limits = (settings.minimum_period, settings.maximum_period, settings.trend_days, settings.min_snr)
    if (not all(np.isfinite(limits)) or not .1 <= settings.minimum_period < settings.maximum_period <= 100
            or not .5 <= settings.trend_days <= 10 or not 3 <= settings.min_transits <= 10
            or not 7 <= settings.min_snr <= 30 or not 1 <= settings.max_signals <= 3):
        raise ValueError("Invalid analysis settings")
    t, raw, y, audit = preprocess(time, flux, quality, settings)
    context = cadence_context(time, flux, quality)
    keep = np.ones(t.size, dtype=bool)
    candidates = []
    for _ in range(settings.max_signals):
        candidate = search(t[keep], y[keep], audit, settings)
        if candidate is None or candidate["snr"] < settings.min_snr:
            break
        vet(t[keep], y[keep], candidate, audit, settings)
        evidence, warnings = event_evidence(t[keep], y[keep], candidate, audit, context, settings.min_transits)
        candidate["instrumental_vetting"] = evidence
        candidate["warnings"].extend(warnings)
        if warnings and candidate["classification"] != "Insufficient evidence":
            candidate["classification"] = "Rejected or likely false positive"
        candidate["ephemeris"] = (
            estimate(t[keep], y[keep], candidate, audit)
            if not candidate["warnings"] and candidate["observed_transits"] >= 4
            else {"status": "unavailable", "reason": "Vetting failed or fewer than four supported events"}
        )
        candidates.append(candidate)
        if candidate["classification"] == "Insufficient evidence":
            break
        period, epoch, duration = (candidate[key] for key in ("period_days", "epoch_days", "duration_days"))
        phase_days = (t - epoch + period / 2) % period - period / 2
        # Mask shoulders as well as the fitted box before looking for another signal.
        keep &= np.abs(phase_days) >= .75 * duration
        if keep.sum() < 100:
            break
    return {"observation": metadata or {}, "settings": asdict(settings), "preprocessing": audit,
            "algorithm": "Astropy BoxLeastSquares", "candidates": candidates, "curve": {"time": t.tolist(), "raw": raw.tolist(), "flux": y.tolist()},
            "limitations": ["Single light curve. No pixel centroid, contamination, or independent follow-up vetting.",
                            "Box model and discrete duration grid. SNR assumes white noise and is not a false-alarm probability.",
                            "Ephemeris intervals are conditional on the selected period family and linear timing model. Segment edges, aliases and instrumental artifacts need review."]}
