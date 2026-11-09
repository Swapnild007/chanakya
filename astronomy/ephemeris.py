"""Conditional linear ephemeris intervals from independently timed events."""
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
    return {"status": "estimated", "confidence": .95, "method": "Event-profile timing and Student-t linear ephemeris",
            "reference_cycle": reference_cycle, "timed_events": len(cycles), "reduced_chi_square": reduced,
            "epoch_days": fitted[0], "period_days": fitted[1],
            "epoch_interval_days": [float(fitted[0] - half[0]), float(fitted[0] + half[0])],
            "period_interval_days": [float(fitted[1] - half[1]), float(fitted[1] + half[1])],
            "epoch_period_covariance_days2": float(covariance[0, 1]),
            "calibration_scope": "Conditional on this period family and a linear ephemeris. Uses timed events with two-sided coverage. Alias and model systematics are excluded. Synthetic coverage for this event selection is pending revalidation."}
