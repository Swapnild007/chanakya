"""Conditional linear ephemeris intervals from independently timed events."""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.stats import t as student_t


def event_timing(time, flux, center, duration, cadence, noise):
    local = np.abs(time - center) < 1.2 * duration
    x, y = time[local] - center, flux[local]
    if len(x) < 8 or min(np.count_nonzero(x < -.55 * duration),
                        np.count_nonzero(x > .55 * duration)) < 2:
        return None
    step = max(cadence / 8, duration / 160)
    grid = np.linspace(-.35 * duration, .35 * duration, max(9, int(.7 * duration / step) + 1))
    # Fit a baseline and nonnegative depth for a fixed-duration trapezoid.
    ingress = max(cadence, .15 * duration)
    templates = np.clip((duration / 2 - np.abs(x[None, :] - grid[:, None])) / ingress + .5, 0, 1)
    templates -= templates.mean(axis=1, keepdims=True)
    norms = np.sum(templates ** 2, axis=1)
    if np.any(norms <= 0):
        return None
    centered = y - y.mean()
    depths = np.maximum(0, -(templates @ centered) / norms)
    scores = depths ** 2 * norms
    peak = int(np.argmax(scores))
    if peak in (0, len(grid) - 1) or scores[peak] < 9 * noise ** 2:
        return None
    residual = centered + depths[peak] * templates[peak]
    scatter = max(noise, float(np.std(residual, ddof=2)))
    # Include only the connected profile interval surrounding the peak.
    accept = scores >= scores[peak] - scatter ** 2
    left = np.flatnonzero(~accept[:peak])
    right = np.flatnonzero(~accept[peak + 1:])
    if not len(left) or not len(right):
        return None
    error = max(cadence / 2, (grid[peak + 1 + right[0]] - grid[left[-1]]) / 2)
    return float(center + grid[peak]), float(error)


@lru_cache(maxsize=1)
def calibration():
    path = Path(__file__).resolve().parent.parent / "data" / "covered-event-calibration.json"
    return json.loads(path.read_text()) if path.is_file() else None


def estimate(candidate, evidence):
    """Fit only events timed inside windows that passed the coverage audit."""
    unavailable = {"status": "unavailable", "reason": "Fewer than four timed events with two-sided coverage"}
    period, epoch = (candidate[k] for k in ("period_days", "epoch_days"))
    timings = [(row["cycle"], row["timing_days"], row["timing_error_days"])
               for row in evidence["events"]
               if row["two_sided_coverage"] and row["timing_days"] is not None]
    if len(timings) < 4:
        return unavailable
    cycles, times, errors = np.asarray(timings).T
    reference_cycle = int(np.median(cycles).round())
    origin = epoch + reference_cycle * period
    design = np.column_stack((np.ones(len(cycles)), cycles - reference_cycle))
    weighted = design / errors[:, None]
    values = (times - origin) / errors
    fit, _, _, _ = np.linalg.lstsq(weighted, values, rcond=None)
    dof = len(cycles) - 2
    reduced = float(np.sum((values - weighted @ fit) ** 2) / dof)
    covariance = np.linalg.inv(weighted.T @ weighted) * max(1, reduced)
    half = student_t.ppf(.975, dof) * np.sqrt(np.diag(covariance))
    fitted = [float(origin + fit[0]), float(fit[1])]
    result = {"status": "estimated", "confidence": .95, "method": "Event-profile timing and Student-t linear ephemeris",
            "reference_cycle": reference_cycle, "timed_events": len(cycles), "reduced_chi_square": reduced,
            "epoch_days": fitted[0], "period_days": fitted[1],
            "epoch_interval_days": [float(fitted[0] - half[0]), float(fitted[0] + half[0])],
            "period_interval_days": [float(fitted[1] - half[1]), float(fitted[1] + half[1])],
            "epoch_period_covariance_days2": float(covariance[0, 1]),
            "calibration_scope": "Conditional on this period family and a linear ephemeris. Uses timed events with two-sided coverage. Alias and model systematics are excluded."}
    calibration_evidence = calibration()
    if calibration_evidence and calibration_evidence["interval_validation"]["joint_multiplier"] is not None:
        validation = calibration_evidence["interval_validation"]
        factor = validation["joint_multiplier"]
        result["synthetic_calibration"] = {
            "seed": calibration_evidence["holdout_seed"], "multiplier": factor,
            "holdout": validation["holdout_scaled"]["joint"],
            "period_interval_days": [float(fitted[1] - factor * half[1]), float(fitted[1] + factor * half[1])],
            "epoch_interval_days": [float(fitted[0] - factor * half[0]), float(fitted[0] + factor * half[0])],
            "scope": "Measured on the 18-minute synthetic holdout among recovered signals with usable fits. Coverage on actual observations is unverified."
        }
    return result


def project_epoch(fit, cycles):
    """Propagate the nominal marginal timing interval, including covariance."""
    from math import sqrt

    epoch_half = (fit["epoch_interval_days"][1] - fit["epoch_interval_days"][0]) / 2
    period_half = (fit["period_interval_days"][1] - fit["period_interval_days"][0]) / 2
    critical = student_t.ppf(.975, fit["timed_events"] - 2)
    half_squared = (epoch_half ** 2 + (cycles * period_half) ** 2 +
                    2 * cycles * fit["epoch_period_covariance_days2"] * critical ** 2)
    center = fit["epoch_days"] + cycles * fit["period_days"]
    return {"epoch_days": center, "half_width_days": sqrt(max(0, half_squared))}


def compare_observations(first, second):
    """Compare fitted ephemerides from disjoint products of the same target."""
    meta_a, meta_b = (r["observation"] for r in (first, second))
    if not meta_a.get("target") or meta_a["target"] != meta_b.get("target"):
        return {"status": "unavailable", "reason": "No common verified target identifier"}
    if any(m.get("time_system", "").upper() != "TDB" or m.get("bjd_reference") is None
           for m in (meta_a, meta_b)):
        return {"status": "unavailable", "reason": "Both products require a BJD TDB reference"}
    if not meta_a.get("sha256") or not meta_b.get("sha256"):
        return {"status": "unavailable", "reason": "Product provenance is missing"}
    if meta_a["sha256"] == meta_b["sha256"]:
        return {"status": "same product", "reason": "Identical product hashes"}
    windows = [r["preprocessing"].get("observed_time_range_days") for r in (first, second)]
    if any(window is None for window in windows):
        return {"status": "unavailable", "reason": "Observation windows are missing"}
    a, b = ([t + m["bjd_reference"] for t in window] for window, m in zip(windows, (meta_a, meta_b)))
    if max(a[0], b[0]) <= min(a[1], b[1]):
        return {"status": "overlapping windows", "reason": "Products may reuse the same exposures"}
    comparisons = []
    reference_time = (max(a[0], b[0]) + min(a[1], b[1])) / 2

    def fits_by_id(report):
        return {m["id"]: c["ephemeris"] for c in report["candidates"]
                if c["ephemeris"]["status"] == "estimated" for m in c["catalogue_matches"]
                if m["classification"] == "Known confirmed planet"}

    fits_a, fits_b = fits_by_id(first), fits_by_id(second)
    for key in sorted(fits_a.keys() & fits_b.keys()):
        fa, fb = fits_a[key], fits_b[key]
        pa, pb = fa["period_days"], fb["period_days"]
        if pa <= 0 or pb <= 0 or abs(pa / pb - 1) > .01:
            continue
        epoch_a = meta_a["bjd_reference"] + fa["epoch_days"]
        epoch_b = meta_b["bjd_reference"] + fb["epoch_days"]
        cycle_a = round((reference_time - epoch_a) / pa)
        anchor = epoch_a + cycle_a * pa
        cycle_b = round((anchor - epoch_b) / pb)
        proj_a, proj_b = project_epoch(fa, cycle_a), project_epoch(fb, cycle_b)
        offset = epoch_b + cycle_b * pb - anchor
        width = proj_a["half_width_days"] + proj_b["half_width_days"]
        # When the nominal projections allow another cycle pairing, a wrapped
        # difference could manufacture apparent agreement.
        ambiguous = abs(offset) + width >= min(pa, pb) / 2
        comparisons.append({"catalogue_id": key, "cycles_from_fit_epochs": [cycle_a, cycle_b],
                            "period_difference_days": pb - pa,
                            "epoch_difference_days": None if ambiguous else offset,
                            "projected_half_widths_days": [proj_a["half_width_days"], proj_b["half_width_days"]],
                            "cycle_pairing": "ambiguous" if ambiguous else "unique within nominal bounds",
                            "epoch_intervals_overlap": None if ambiguous else abs(offset) <= width})
    return {"status": "compared" if comparisons else "unavailable", "comparisons": comparisons,
            "product_sha256": [meta_a["sha256"], meta_b["sha256"]],
            "windows_bjd_tdb": [a, b],
            "scope": "Disjoint observation windows and independently fitted ephemerides. Shared catalogue identity, pipeline systematics and unmodeled timing variations limit interpretation."}
