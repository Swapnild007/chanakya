#!/usr/bin/env python3
"""Candidate-level event consistency and local-baseline excursion diagnostics.

This is diagnostic only. It does not classify any signal as a planet.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd

def robust_sigma(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < 3:
        return float("nan")
    med = np.median(x)
    return float(1.4826 * np.median(np.abs(x - med)))

def depth_for_event(t: np.ndarray, residual: np.ndarray, centre: float, duration: float) -> dict:
    phase = np.abs(t - centre)
    inside = phase <= duration / 2
    outside = (phase >= 1.5 * duration) & (phase <= 5 * duration)
    inside &= np.isfinite(residual)
    outside &= np.isfinite(residual)
    if inside.sum() < 2 or outside.sum() < 5:
        return {"centre": float(centre), "n_in": int(inside.sum()), "n_out": int(outside.sum()), "depth": None, "uncertainty": None, "snr": None}
    d = float(np.median(residual[outside]) - np.median(residual[inside]))
    si, so = robust_sigma(residual[inside]), robust_sigma(residual[outside])
    err = float(np.sqrt((si * si / inside.sum()) + (so * so / outside.sum()))) if np.isfinite(si) and np.isfinite(so) else float("nan")
    return {"centre": float(centre), "n_in": int(inside.sum()), "n_out": int(outside.sum()), "depth": d, "uncertainty": err, "snr": float(d / err) if err > 0 and np.isfinite(err) else None}

def summarize_events(events: list[dict]) -> dict:
    valid = [e for e in events if e.get("depth") is not None and e.get("uncertainty") and e["uncertainty"] > 0]
    if len(valid) < 3:
        return {"usable_events": len(valid), "chi_square": None, "degrees_of_freedom": None, "reduced_chi_square": None, "warning": "Fewer than three events have enough in/out-of-event points."}
    depths = np.array([e["depth"] for e in valid])
    errors = np.array([e["uncertainty"] for e in valid])
    weights = 1 / errors**2
    mean = float(np.sum(weights * depths) / np.sum(weights))
    chi2 = float(np.sum(((depths - mean) / errors)**2))
    return {"usable_events": len(valid), "weighted_mean_depth": mean, "chi_square": chi2, "degrees_of_freedom": len(valid)-1, "reduced_chi_square": chi2/(len(valid)-1), "warning": "Interpret chi-square cautiously if residuals are correlated or uncertainties are approximate."}

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("bls_report", type=Path)
    ap.add_argument("--output", type=Path, default=Path("transit_vetting.json"))
    ap.add_argument("--local-window-points", type=int, default=361)
    ap.add_argument("--excursion-threshold-ppm", type=float, default=10000)
    args = ap.parse_args()
    df = pd.read_csv(args.csv)
    lower = {str(c).strip().lower(): c for c in df.columns}
    if not {"time", "flux"}.issubset(lower):
        raise ValueError("Input CSV must contain time and flux columns.")
    t = pd.to_numeric(df[lower["time"]], errors="coerce").to_numpy(float)
    f = pd.to_numeric(df[lower["flux"]], errors="coerce").to_numpy(float)
    valid = np.isfinite(t) & np.isfinite(f)
    t, f = t[valid], f[valid]
    order = np.argsort(t)
    t, f = t[order], f[order]
    if len(t) < 100 or np.any(np.diff(t) <= 0):
        raise ValueError("Need >=100 valid rows and strictly increasing timestamps.")
    w = max(5, int(args.local_window_points))
    if w % 2 == 0:
        w += 1
    series = pd.Series(f)
    baseline = series.rolling(w, center=True, min_periods=max(5, w//4)).median().to_numpy()
    baseline[~np.isfinite(baseline) | (baseline == 0)] = np.nan
    residual = f / baseline - 1.0
    report = json.loads(args.bls_report.read_text(encoding="utf-8"))
    peak = report["astropy_bls"]
    period = float(peak["period_days"])
    duration = float(peak["duration_days"])
    epoch = float(peak["transit_time"])
    if not (period > 0 and duration > 0):
        raise ValueError("Invalid BLS period or duration.")
    kmin = int(np.floor((t.min() - epoch) / period)) - 1
    kmax = int(np.ceil((t.max() - epoch) / period)) + 1
    centres = [epoch + k*period for k in range(kmin, kmax+1) if t.min() <= epoch+k*period <= t.max()]
    events = [depth_for_event(t, residual, c, duration) for c in centres]
    summary = summarize_events(events)
    # A local-baseline excursion mask, never a raw global-flux threshold.
    excursion = np.isfinite(residual) & (np.abs(residual) * 1e6 >= args.excursion_threshold_ppm)
    masked_residual = residual.copy()
    masked_residual[excursion] = np.nan
    masked_events = [depth_for_event(t, masked_residual, c, duration) for c in centres]
    masked_summary = summarize_events(masked_events)
    odd = [e for i,e in enumerate(events) if i % 2 == 0 and e.get("depth") is not None]
    even = [e for i,e in enumerate(events) if i % 2 == 1 and e.get("depth") is not None]
    odd_mean = float(np.median([e["depth"] for e in odd])) if odd else None
    even_mean = float(np.median([e["depth"] for e in even])) if even else None
    secondary_centres = [c + period/2 for c in centres if t.min() <= c + period/2 <= t.max()]
    secondary = [depth_for_event(t, residual, c, duration) for c in secondary_centres]
    report_out = {
        "status": "diagnostic only; no planet classification",
        "input_sha256": report.get("input", {}).get("sha256"),
        "configuration": {"local_baseline_window_points": w, "excursion_threshold_ppm": args.excursion_threshold_ppm, "mask_definition": "absolute flux residual from centered rolling-median local baseline, in ppm"},
        "candidate": {"period_days": period, "duration_days": duration, "epoch": epoch},
        "event_depth_consistency_unmasked": summary,
        "event_depth_consistency_local_excursions_masked": masked_summary,
        "odd_even_depth_diagnostic": {"odd_event_median_depth": odd_mean, "even_event_median_depth": even_mean, "difference": None if odd_mean is None or even_mean is None else odd_mean-even_mean, "odd_events": len(odd), "even_events": len(even), "threshold_predeclared": False, "note": "Descriptive only; set a validated threshold before using as a pass/fail gate."},
        "secondary_eclipse_diagnostic": {"events": secondary, "median_depth": float(np.nanmedian([e["depth"] for e in secondary if e.get("depth") is not None])) if any(e.get("depth") is not None for e in secondary) else None, "threshold_predeclared": False, "note": "Descriptive only; not a validated exclusion test."},
        "local_excursions": {"count": int(excursion.sum()), "fraction_of_points": float(excursion.mean()), "threshold_ppm": args.excursion_threshold_ppm},
        "events_unmasked": events,
        "events_masked": masked_events,
        "limitations": ["Rolling-median detrending can attenuate or reshape long events.", "Per-event errors are robust approximations and may not capture time-correlated noise.", "Odd/even and secondary diagnostics are not pre-registered pass/fail criteria.", "Centroid/aperture validation requires target-pixel files."],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report_out, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"events": len(events), "usable_events": summary.get("usable_events"), "reduced_chi_square": summary.get("reduced_chi_square"), "local_excursion_count": int(excursion.sum()), "output": str(args.output)}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
