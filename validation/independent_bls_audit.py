#!/usr/bin/env python3
"""Independent BLS cross-check and empirical maximum-power null audit.

This is a research audit utility, not a validated planet-detection pipeline.
It uses the exact input CSV and deterministic grids/seeds. Null results are
conditional on the preprocessing and period/duration search configured here;
they are not automatically the false-alarm probability of AstroLens' own
pipeline. Use --null-mode block to preserve short-range correlations better
than a point shuffle, and report both modes rather than hiding disagreement.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import astropy.units as u
    from astropy.timeseries import BoxLeastSquares
except ImportError as exc:
    raise SystemExit("Missing dependency: install validation/requirements-independent.txt") from exc

DEFAULT_PERIOD_MIN = 0.15
DEFAULT_PERIOD_MAX = 10.0
DEFAULT_DURATIONS = [0.02, 0.04, 0.06, 0.08, 0.10, 0.12]


def wilson_interval(successes: int, trials: int, z: float = 1.959963984540054) -> list[float]:
    if trials <= 0:
        return [float("nan"), float("nan")]
    p = successes / trials
    den = 1 + z * z / trials
    centre = (p + z * z / (2 * trials)) / den
    half = z * np.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / den
    return [max(0.0, float(centre - half)), min(1.0, float(centre + half))]


def read_csv(path: Path) -> tuple[np.ndarray, np.ndarray, dict]:
    raw = path.read_bytes()
    df = pd.read_csv(path)
    lower = {str(c).strip().lower(): c for c in df.columns}
    time_col = next((lower[k] for k in ("time", "btjd", "bjd", "jd") if k in lower), None)
    flux_col = next((lower[k] for k in ("pdcsap_flux", "relative_flux", "flux", "brightness") if k in lower), None)
    quality_col = lower.get("quality")
    if time_col is None or flux_col is None:
        raise ValueError(f"Cannot identify time/flux columns. Found: {list(df.columns)}")
    keep = np.isfinite(pd.to_numeric(df[time_col], errors="coerce")) & np.isfinite(pd.to_numeric(df[flux_col], errors="coerce"))
    quality_policy = "no quality column; no quality filtering applied"
    if quality_col is not None:
        q = pd.to_numeric(df[quality_col], errors="coerce")
        keep &= np.isfinite(q)
        # Match AstroLens' documented TESS mask when a QUALITY column is present.
        keep &= ((q.fillna(0).astype(np.uint64) & np.uint64(175)) == 0)
        quality_policy = "TESS default bitmask 175; confirm product-specific suitability"
    t = pd.to_numeric(df.loc[keep, time_col], errors="coerce").to_numpy(float)
    f = pd.to_numeric(df.loc[keep, flux_col], errors="coerce").to_numpy(float)
    order = np.argsort(t, kind="stable")
    t, f = t[order], f[order]
    if len(t) < 100 or np.any(np.diff(t) <= 0):
        raise ValueError("Need at least 100 finite rows and strictly increasing timestamps.")
    meta = {
        "path": str(path),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "input_rows": int(len(df)),
        "accepted_rows": int(len(t)),
        "time_column": str(time_col),
        "flux_column": str(flux_col),
        "quality_column": str(quality_col) if quality_col is not None else None,
        "quality_policy": quality_policy,
        "time_min": float(t.min()),
        "time_max": float(t.max()),
        "baseline_days": float(t.max() - t.min()),
        "median_cadence_minutes": float(np.median(np.diff(t)) * 1440),
        "flux_min": float(np.min(f)),
        "flux_median": float(np.median(f)),
        "flux_max": float(np.max(f)),
        "flux_error_column": next((str(c) for c in df.columns if str(c).lower() in ("flux_err", "pdcsap_flux_err", "sap_flux_err")), None),
    }
    return t, f / np.median(f) - 1.0, meta


def block_resample(values: np.ndarray, block_size: int, rng: np.random.Generator) -> np.ndarray:
    """Concatenate randomly selected contiguous flux blocks into a null series."""
    n = len(values)
    block_size = max(2, min(int(block_size), n))
    starts = rng.integers(0, n - block_size + 1, size=int(np.ceil(n / block_size)))
    return np.concatenate([values[s:s + block_size] for s in starts])[:n]


def best_bls(t: np.ndarray, y: np.ndarray, periods: np.ndarray, durations: np.ndarray) -> dict:
    model = BoxLeastSquares(t * u.day, y * u.dimensionless_unscaled)
    result = model.power(periods * u.day, durations * u.day, objective="snr")
    power = np.asarray(result.power.value if hasattr(result.power, "value") else result.power)
    ix = np.unravel_index(int(np.nanargmax(power)), power.shape)

    def values(arr):
        return np.asarray(arr.value if hasattr(arr, "value") else arr, dtype=float)

    def align(arr, kind):
        a = values(arr)
        if a.shape == power.shape:
            return a
        if a.ndim == 1 and power.ndim == 2:
            if kind in ("period", "time") and len(a) == power.shape[0]:
                return np.broadcast_to(a[:, None], power.shape)
            if kind == "duration" and len(a) == power.shape[1]:
                return np.broadcast_to(a[None, :], power.shape)
        return np.broadcast_to(a, power.shape)

    period_grid = align(result.period, "period")
    duration_grid = align(result.duration, "duration")
    time_grid = align(result.transit_time, "time")
    depth_grid = align(result.depth, "duration") if hasattr(result, "depth") else np.full(power.shape, np.nan)
    return {
        "period_days": float(period_grid[ix]),
        "duration_days": float(duration_grid[ix]),
        "transit_time": float(time_grid[ix]),
        "depth_fraction": float(depth_grid[ix]),
        "max_power": float(power[ix]),
        "period_index": int(ix[0]),
        "duration_index": int(ix[-1]) if len(ix) > 1 else 0,
    }


def lightkurve_crosscheck(t: np.ndarray, y: np.ndarray, periods: np.ndarray, durations: np.ndarray) -> dict:
    import lightkurve as lk
    lc = lk.LightCurve(time=t * u.day, flux=y * u.dimensionless_unscaled)
    pg = lc.to_periodogram(method="bls", period=periods * u.day, duration=durations * u.day)
    power = np.asarray(pg.power.value if hasattr(pg.power, "value") else pg.power)
    ix = int(np.nanargmax(power))
    per = pg.period[ix]
    dur = pg.duration[ix] if hasattr(pg, "duration") else np.nan
    return {
        "period_days": float(per.to_value(u.day) if hasattr(per, "to_value") else per),
        "duration_days": float(dur.to_value(u.day) if hasattr(dur, "to_value") else dur),
        "max_power": float(power[ix]),
        "power_definition": "Lightkurve BLS periodogram power; not numerically interchangeable with Astropy SNR",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--output", type=Path, default=Path("independent_bls_audit.json"))
    ap.add_argument("--seed", type=int, default=20261018)
    ap.add_argument("--null-runs", type=int, default=1000)
    ap.add_argument("--period-count", type=int, default=5000)
    ap.add_argument("--period-min", type=float, default=DEFAULT_PERIOD_MIN)
    ap.add_argument("--period-max", type=float, default=DEFAULT_PERIOD_MAX)
    ap.add_argument("--durations", type=float, nargs="+", default=DEFAULT_DURATIONS)
    ap.add_argument("--null-mode", choices=("shuffle", "block"), default="block")
    ap.add_argument("--block-size", type=int, default=30, help="number of adjacent samples per null block")
    ap.add_argument("--skip-lightkurve", action="store_true")
    args = ap.parse_args()

    t, y, meta = read_csv(args.csv)
    periods = np.linspace(args.period_min, args.period_max, args.period_count)
    durations = np.asarray(args.durations, dtype=float)
    if np.any(durations <= 0) or periods.size < 100 or args.null_runs < 1:
        ap.error("Durations must be positive, period-count at least 100, and null-runs at least 1.")

    observed = best_bls(t, y, periods, durations)
    # Deterministic repeatability check on the exact same input and grid.
    repeated = best_bls(t, y, periods, durations)
    repeatability = {
        "period_identical": observed["period_days"] == repeated["period_days"],
        "duration_identical": observed["duration_days"] == repeated["duration_days"],
        "max_power_identical": observed["max_power"] == repeated["max_power"],
        "period_difference_days": abs(observed["period_days"] - repeated["period_days"]),
        "power_difference": abs(observed["max_power"] - repeated["max_power"]),
    }
    observed["grid"] = {
        "period_min_days": args.period_min,
        "period_max_days": args.period_max,
        "period_count": int(len(periods)),
        "period_spacing_days": float(periods[1] - periods[0]),
        "durations_days": durations.tolist(),
    }

    # Independent implementation check; compare peak locations/tolerances,
    # not raw power magnitudes, which have different definitions.
    lk_result = None
    lk_error = None
    if not args.skip_lightkurve:
        try:
            lk_result = lightkurve_crosscheck(t, y, periods, durations)
        except Exception as exc:  # Preserve Astropy result and make the failure explicit.
            lk_error = f"{type(exc).__name__}: {exc}"

    rng = np.random.default_rng(args.seed)
    exceed = 0
    null_maxima = []
    for i in range(args.null_runs):
        if args.null_mode == "shuffle":
            y_null = rng.permutation(y)
        else:
            y_null = block_resample(y, args.block_size, rng)
        null_result = best_bls(t, y_null, periods, durations)
        null_maxima.append(null_result["max_power"])
        exceed += int(null_result["max_power"] >= observed["max_power"])
        if (i + 1) % 100 == 0:
            print(f"null runs: {i + 1}/{args.null_runs}", file=sys.stderr)

    # Add-one estimate prevents reporting a spurious exact zero.
    fap = (exceed + 1) / (args.null_runs + 1)
    interval = wilson_interval(exceed, args.null_runs)
    report = {
        "status": "reference BLS audit completed; not a full AstroLens-pipeline FAP unless preprocessing/search match",
        "input": meta,
        "configuration": {
            "seed": args.seed,
            "null_runs": args.null_runs,
            "null_mode": args.null_mode,
            "block_size_samples": args.block_size if args.null_mode == "block" else None,
            "period_grid": observed["grid"],
            "statistic": "maximum Astropy BoxLeastSquares SNR over the fixed period-duration grid",
        },
        "astropy_bls": observed,
        "repeatability": repeatability,
        "lightkurve_bls": lk_result,
        "lightkurve_error": lk_error,
        "peak_agreement": None if lk_result is None else {
            "absolute_period_difference_days": abs(observed["period_days"] - lk_result["period_days"]),
            "within_one_grid_step": abs(observed["period_days"] - lk_result["period_days"]) <= (periods[1] - periods[0]),
        },
        "empirical_max_power_null": {
            "exceedances": int(exceed),
            "trials": int(args.null_runs),
            "fap_add_one": float(fap),
            "wilson95_interval_raw_fraction": interval,
            "null_max_power_quantiles": {str(q): float(np.quantile(null_maxima, q)) for q in (0.5, 0.9, 0.95, 0.99, 0.999)},
            "interpretation": "Conditional on this exact period/duration grid, input preprocessing, and null generator. Block-shuffle is not a universal noise model. Do not label this as AstroLens full-pipeline FAP until the app's exact preprocessing and search are reproduced in each null trial.",
        },
        "limitations": [
            "No flux-error column or original FITS header is present in this CSV.",
            "The CSV quality flags are all zero; that does not prove the photometry is free of systematics.",
            "This script uses normalized supplied flux and does not reproduce AstroLens detrending unless equivalent preprocessing is added and verified.",
            "A periodogram peak is not a confirmed transit or planet.",
        ],
    }
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "input_sha256": meta["sha256"],
        "astropy_peak": observed,
        "lightkurve_peak": lk_result,
        "lightkurve_error": lk_error,
        "repeatability": repeatability,
        "null_mode": args.null_mode,
        "null_runs": args.null_runs,
        "exceedances": exceed,
        "fap_add_one": fap,
        "output": str(args.output),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
