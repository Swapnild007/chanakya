"""First-pass low-flux outlier grouping for CSV light curves.

This is a triage utility, not a periodic transit search or discovery claim.
"""
import csv
import math
from dataclasses import dataclass
from statistics import median
from typing import Iterable


@dataclass(frozen=True)
class DipEvent:
    start_time: float
    end_time: float
    point_count: int
    minimum_flux: float
    depth_percent: float


def detect_low_flux_events(times: Iterable[float], fluxes: Iterable[float], sigma_threshold: float = 3.0, min_points: int = 2) -> list[DipEvent]:
    pairs = sorted((float(t), float(f)) for t, f in zip(times, fluxes) if math.isfinite(float(t)) and math.isfinite(float(f)))
    if len(pairs) < 20:
        raise ValueError("At least 20 finite time/flux samples are required")
    if sigma_threshold <= 0 or min_points < 1:
        raise ValueError("sigma_threshold and min_points must be positive")
    values = [f for _, f in pairs]
    center = median(values)
    mad = median(abs(v - center) for v in values)
    scale = max(1.4826 * mad, abs(center) * 1e-10, 1e-12)
    threshold = center - sigma_threshold * scale
    groups: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for point in pairs:
        if point[1] < threshold:
            current.append(point)
        elif current:
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    events = []
    for group in groups:
        if len(group) < min_points:
            continue
        minimum = min(flux for _, flux in group)
        depth = 100.0 * (center - minimum) / abs(center) if center else 0.0
        events.append(DipEvent(group[0][0], group[-1][0], len(group), minimum, depth))
    return sorted(events, key=lambda event: event.depth_percent, reverse=True)


def read_lightcurve_csv(path: str, time_column: str | None = None, flux_column: str | None = None):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV must contain a header row")
        fields = {name.strip().lower(): name for name in reader.fieldnames}
        def find(explicit, candidates):
            if explicit:
                if explicit.lower() not in fields:
                    raise ValueError(f"Column not found: {explicit}")
                return fields[explicit.lower()]
            return next((original for lowered, original in fields.items() if any(c in lowered for c in candidates)), None)
        tcol = find(time_column, ("time", "btjd", "bjd", "jd"))
        fcol = find(flux_column, ("pdcsap_flux", "sap_flux", "flux", "brightness"))
        if not tcol or not fcol:
            raise ValueError("Could not identify time and flux columns")
        times, fluxes = [], []
        for row in reader:
            try:
                t, f = float(row[tcol]), float(row[fcol])
            except (TypeError, ValueError):
                continue
            if math.isfinite(t) and math.isfinite(f):
                times.append(t); fluxes.append(f)
    return times, fluxes
