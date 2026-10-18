#!/usr/bin/env python3
"""Deterministic box-transit injection/recovery with fixed acceptance criteria."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
from independent_bls_audit import read_csv, best_bls, wilson_interval

def transit_mask(t: np.ndarray, period: float, epoch: float, duration: float) -> np.ndarray:
    phase = (t - epoch + period / 2.0) % period - period / 2.0
    return np.abs(phase) <= duration / 2.0

def epoch_match(recovered: float, injected: float, period: float, duration: float) -> bool:
    delta = abs((recovered - injected + period / 2.0) % period - period / 2.0)
    return delta <= 0.5 * duration

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--output", type=Path, default=Path("injection_recovery.json"))
    ap.add_argument("--seed", type=int, default=20261018)
    ap.add_argument("--trials-per-depth", type=int, default=10)
    ap.add_argument("--period-count", type=int, default=5000)
    ap.add_argument("--period-min", type=float, default=0.15)
    ap.add_argument("--period-max", type=float, default=10.0)
    ap.add_argument("--depths-ppm", type=float, nargs="+", default=[500, 1000, 2000, 5000, 10000])
    ap.add_argument("--injected-period", type=float, default=1.2345)
    ap.add_argument("--injected-duration", type=float, default=0.06)
    args = ap.parse_args()
    if args.trials_per_depth < 1 or args.period_count < 100 or any(d <= 0 for d in args.depths_ppm):
        ap.error("trials-per-depth must be positive, period-count >=100, and depths positive.")
    t, y, meta = read_csv(args.csv)
    periods = np.linspace(args.period_min, args.period_max, args.period_count)
    durations = np.asarray([0.02, 0.04, 0.06, 0.08, 0.10, 0.12])
    rng = np.random.default_rng(args.seed)
    tol_period = max(1.5 * float(periods[1] - periods[0]), 0.25 * args.injected_duration)
    rows = []

    # Deterministic high-depth synthetic control. It checks that the test itself
    # can recover an obvious transit before interpreting real-data recovery.
    t0 = float(t[0] + 0.37 * args.injected_period)
    clean = np.ones_like(t)
    clean[transit_mask(t, args.injected_period, t0, args.injected_duration)] -= 0.02
    control = best_bls(t, clean, periods, durations)
    control_pass = (
        abs(control["period_days"] - args.injected_period) <= tol_period
        and epoch_match(control["transit_time"], t0, args.injected_period, args.injected_duration)
        and np.isfinite(control["depth_fraction"])
        and control["depth_fraction"] >= 0.01
    )

    for ppm in args.depths_ppm:
        successes = 0
        trials = []
        injected_depth = ppm * 1e-6
        for i in range(args.trials_per_depth):
            epoch = float(t[0] + rng.uniform(0, args.injected_period))
            signal = y.copy()
            signal[transit_mask(t, args.injected_period, epoch, args.injected_duration)] -= injected_depth
            recovered = best_bls(t, signal, periods, durations)
            p_ok = abs(recovered["period_days"] - args.injected_period) <= tol_period
            e_ok = epoch_match(recovered["transit_time"], epoch, args.injected_period, args.injected_duration)
            d_ok = np.isfinite(recovered["depth_fraction"]) and recovered["depth_fraction"] >= 0.5 * injected_depth
            passed = bool(p_ok and e_ok and d_ok)
            successes += int(passed)
            trials.append({
                "trial": i + 1,
                "injected_epoch": epoch,
                "recovered_period_days": recovered["period_days"],
                "recovered_epoch": recovered["transit_time"],
                "recovered_depth_fraction": recovered["depth_fraction"],
                "period_pass": bool(p_ok),
                "epoch_pass": bool(e_ok),
                "depth_pass": bool(d_ok),
                "recovered": passed,
            })
        rows.append({
            "injected_depth_ppm": float(ppm),
            "trials": args.trials_per_depth,
            "recoveries": successes,
            "recovery_fraction": successes / args.trials_per_depth,
            "wilson95_interval": wilson_interval(successes, args.trials_per_depth),
            "trials_detail": trials,
        })
    report = {
        "status": "injection/recovery diagnostic; sensitivity depends on injected signal and actual data structure",
        "input": meta,
        "configuration": {
            "seed": args.seed,
            "trials_per_depth": args.trials_per_depth,
            "period_grid": {"min_days": args.period_min, "max_days": args.period_max, "count": args.period_count},
            "injected_period_days": args.injected_period,
            "injected_duration_days": args.injected_duration,
            "period_tolerance_days": tol_period,
            "epoch_tolerance": "circular epoch difference <= 0.5 * injected duration",
            "depth_tolerance": "fitted depth >= 0.5 * injected depth",
            "search_grid_durations_days": durations.tolist(),
        },
        "noiseless_high_depth_control": {
            "passed": bool(control_pass),
            "injected_period_days": args.injected_period,
            "injected_epoch": t0,
            "injected_depth_fraction": 0.02,
            "recovered": control,
        },
        "recovery_curve": rows,
        "interpretation_limit": "This measures recovery under this exact fixed-grid reference search and injection model. It is not a planet probability, and does not replace full-pipeline null calibration or astrophysical vetting.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "noiseless_control_passed": bool(control_pass),
        "curve": [{"depth_ppm": r["injected_depth_ppm"], "recoveries": r["recoveries"], "trials": r["trials"], "recovery_fraction": r["recovery_fraction"], "wilson95_interval": r["wilson95_interval"]} for r in rows],
        "output": str(args.output),
    }, indent=2))
    return 0 if control_pass else 1

if __name__ == "__main__":
    raise SystemExit(main())
