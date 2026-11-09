"""Event-level checks for instrumental impostors in a folded detection."""
import numpy as np
from scipy.stats import chi2

from .ephemeris import event_timing


def cadence_context(time, flux, quality):
    flagged = np.isfinite(time) & np.isfinite(quality) & (quality != 0) if quality is not None else np.zeros(len(time), bool)
    finite_time = np.isfinite(time)
    return {
        "flagged": np.sort(time[flagged]),
        "missing": np.sort(time[finite_time & ~np.isfinite(flux)]),
        "quality_available": quality is not None,
    }


def event_evidence(t, y, candidate, audit, context, minimum_events):
    period, epoch, duration = (candidate[k] for k in ("period_days", "epoch_days", "duration_days"))
    cadence, noise = audit["cadence_days"], audit["noise_mad"]
    half = duration / 2
    rows = []
    for cycle in candidate["event_cycles"]:
        center = epoch + cycle * period
        start, end = t.searchsorted([center - 1.5 * duration, center + 1.5 * duration])
        tx, flux = t[start:end], y[start:end]
        x = tx - center
        inside = np.abs(x) < half
        left, right = x < -half, x > half
        flags = int(np.diff(context["flagged"].searchsorted([center - half, center + half]))[0])
        missing = int(np.diff(context["missing"].searchsorted([center - half, center + half]))[0])
        core = x[np.abs(x) < half + cadence]
        gap = bool(len(core) > 1 and np.max(np.diff(core)) > max(3.5 * cadence, half))
        covered = bool(min(left.sum(), right.sum()) >= 2 and inside.sum() >= max(2, .6 * duration / cadence) and not gap)
        row = {"cycle": cycle, "flagged_cadences": flags, "missing_flux_cadences": missing,
               "gap_through_event": gap, "two_sided_coverage": covered}
        rows.append(row)
        if not covered:
            continue
        timing = event_timing(tx, flux, center, duration, cadence, noise)
        offset = timing[0] - center if timing else 0.
        # Remove a local slope using both shoulders. A symmetric event can be shallow
        # or cadence-smeared, so treat morphology as measured only with enough samples.
        shoulders = left | right
        continuum = np.polyval(np.polyfit(x[shoulders], flux[shoulders], 1), x)
        residual = continuum - flux
        shoulder_residual = residual[shoulders]
        scatter = max(noise, 1.4826 * np.median(np.abs(shoulder_residual - np.median(shoulder_residual))))
        aligned = np.abs(x - offset) < half
        if aligned.sum() < 2:
            row["two_sided_coverage"] = False
            continue
        depth = float(residual[aligned].mean())
        # Adjacent cadences are correlated. Count at most one independent sample per
        # quarter-duration on either side of the contrast.
        depth_error = scatter * np.sqrt(1 / min(4, aligned.sum()) + 1 / min(4, shoulders.sum()))
        row.update(depth=depth, depth_error=float(depth_error),
                   timing_days=timing[0] if timing else None, timing_error_days=timing[1] if timing else None)
        if aligned.sum() >= 5 and depth > 5 * depth_error:
            before, after = residual[left].mean(), residual[right].mean()
            row["shoulder_step_sigma"] = float(abs(before - after) / scatter)
            shape = np.clip((half - np.abs(x - offset)) / max(cadence, .15 * duration) + .5, 0, 1)
            box = aligned.astype(float)
            def loss(template):
                amplitude = max(0., float(residual @ template / (template @ template)))
                return float(np.sum((residual - amplitude * template) ** 2))
            row["step_over_trapezoid_delta_chi2"] = (loss(shape) - loss(box)) / scatter ** 2
    clean = [r for r in rows if r["two_sided_coverage"]]
    independent = [r for r in clean if r["depth"] > 2 * r["depth_error"]]
    warnings = []
    # A gap-adjacent dip can aid the period search but cannot substitute for a
    # independently observed transit with a local continuum on both sides.
    affected = sum(not r["two_sided_coverage"] and
                   bool(r["gap_through_event"] or r["flagged_cadences"] or r["missing_flux_cadences"]) for r in rows)
    if len(clean) < minimum_events and affected >= 2:
        warnings.append("Too few independently covered events after cadence-quality and gap checks")
    depth_p = None
    if len(independent) >= 4:
        depths = np.array([r["depth"] for r in independent])
        errors = np.array([r["depth_error"] for r in independent])
        weights = errors ** -2
        mean = np.average(depths, weights=weights)
        depth_p = float(chi2.sf(np.sum(weights * (depths - mean) ** 2), len(depths) - 1))
        if depth_p < .001 and np.std(depths, ddof=1) > .20 * mean:
            warnings.append("Independent event depths disagree beyond local noise")
    step_events = sum(r.get("step_over_trapezoid_delta_chi2", 0) > 9 for r in independent)
    timed = [r for r in independent if r["timing_days"] is not None]
    timing_p = None
    if len(timed) >= 4:
        x = np.array([r["cycle"] for r in timed], float)
        times = np.array([r["timing_days"] for r in timed])
        errors = np.array([r["timing_error_days"] for r in timed])
        trend = np.polyval(np.polyfit(x, times - times[0], 1, w=1 / errors), x)
        residual = times - times[0] - trend
        timing_p = float(chi2.sf(np.sum((residual / errors) ** 2), len(timed) - 2))
        if timing_p < .001 and np.std(residual) > .15 * duration:
            warnings.append("Independent event timings disagree with a linear ephemeris")
    if step_events >= 3 and step_events > len(independent) / 2:
        warnings.append("Repeated sharp-edged events favor an abrupt step over a symmetric transit")
    return {"quality_available": context["quality_available"], "covered_events": len(clean),
            "independent_events": len(independent), "gap_or_quality_affected_events": int(affected),
            "sharp_step_events": int(step_events), "depth_consistency_p": depth_p, "timing_consistency_p": timing_p,
            "events": rows}, warnings


# FITS light-curve summaries. Target centroids can also respond to blends,
# so their displacement is advisory. SAP and PDCSAP share the same exposures.
ANCILLARY_COLUMNS = ("SAP_BKG", "POS_CORR1", "POS_CORR2", "MOM_CENTR1", "MOM_CENTR2", "SAP_FLUX")
INSTRUMENT_COLUMNS = {"SAP_BKG", "POS_CORR1", "POS_CORR2"}


def ancillary_evidence(time, quality, channels, candidate, events, cadence):
    """Measure signed contrasts against two local shoulders on the same cadences."""
    measurements = {}
    clean = np.isfinite(time) & ((quality == 0) if quality is not None else True)
    period, epoch, duration = (candidate[k] for k in ("period_days", "epoch_days", "duration_days"))
    for name in ANCILLARY_COLUMNS:
        if name not in channels:
            continue
        values = np.asarray(channels[name], float)
        if values.shape != time.shape:
            raise ValueError(f"{name} must align with TIME")
        usable = clean & np.isfinite(values)
        t, indices = np.unique(time[usable], return_index=True)
        y = values[usable][indices]
        rows = []
        for event in events:
            if not event["two_sided_coverage"]:
                continue
            center = epoch + event["cycle"] * period
            start, stop = t.searchsorted([center - 1.5 * duration, center + 1.5 * duration])
            x, flux = t[start:stop] - center, y[start:stop]
            inside = np.abs(x) < duration / 2
            left, right = x < -duration / 2, x > duration / 2
            if min(left.sum(), right.sum()) < 3 or inside.sum() < max(3, .6 * duration / cadence):
                continue
            shoulders = left | right
            continuum = np.polyval(np.polyfit(x[shoulders], flux[shoulders], 1), x)
            residual = flux - continuum
            scatter = 1.4826 * np.median(np.abs(residual[shoulders] - np.median(residual[shoulders])))
            # A constant or quantized auxiliary stream has no defensible local scale.
            if scatter <= 16 * np.finfo(float).eps * max(1., np.max(np.abs(flux))):
                continue
            rows.append({"cycle": event["cycle"], "contrast": float(np.median(residual[inside])),
                         "shoulder_scatter": float(scatter)})
        positive = sum(r["contrast"] > 5 * r["shoulder_scatter"] for r in rows)
        negative = sum(r["contrast"] < -5 * r["shoulder_scatter"] for r in rows)
        repeat = max(positive, negative)
        measurements[name] = {"measured_events": len(rows), "repeated_events": repeat,
                              "coincident": repeat >= 4 and repeat > len(rows) / 2,
                              "events": rows}
    coincident = [name for name in measurements if name in INSTRUMENT_COLUMNS and measurements[name]["coincident"]]
    return {"status": "instrumental coincidence" if coincident else "insufficiently validated",
            "coincident_channels": coincident, "channels": measurements,
            "pixel_evidence": "unavailable", "independent_observations": "unavailable",
            "scope": "Same-product light-curve summaries. Repeated background or pointing coincidences are heuristic evidence. Target centroids may also reflect blending. Independent measurements and pixel localization are unavailable."}
