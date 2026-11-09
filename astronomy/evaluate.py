"""Seeded synthetic injection/recovery and conditional interval validation."""
import argparse
import json
import platform
from dataclasses import asdict

import astropy
import numpy as np
import scipy
from scipy.signal import lfilter
from scipy.stats import norm

from .discovery import Settings, analyze

SETTINGS = Settings(minimum_period=.85, maximum_period=3.4, max_signals=1)
DEPTHS = (.001, .002, .004, .008)
CONTROLS = ("correlated_noise", "eclipsing_binary", "asymmetric_eclipsing_binary", "instrumental_dropouts")


def case(seed, kind, depth=.004, baseline=15, *, cadence=.0125, red_noise_scale=1.):
    rng = np.random.default_rng(seed)
    time = np.arange(0, baseline, cadence)
    white = rng.normal(0, .001, len(time))
    red = lfilter([1], [1, -.73], rng.normal(0, .00045 * red_noise_scale, len(time)))
    flux = 1 + white + red + .0012 * np.sin(2 * np.pi * time / 2.7 + rng.uniform(0, 6))
    quality = np.zeros(len(time), dtype=int)
    quality[rng.choice(len(time), 20, replace=False)] = 1
    gap = rng.uniform(4, min(10, baseline - 1))
    quality[(time > gap) & (time < gap + .7)] = 1
    period, epoch = rng.uniform(1.05, 3), rng.uniform(.25, .75)
    duration = rng.uniform(.075, .155)

    def transit(center, width):
        dt = (time - center + period / 2) % period - period / 2
        return np.clip((width / 2 - np.abs(dt)) / (.2 * width) + .5, 0, 1)

    if kind == "injection":
        flux -= depth * transit(epoch, duration)
    elif kind == "eclipsing_binary":
        flux -= .022 * transit(epoch, duration) + .008 * transit(epoch + period / 2, duration * .85)
    elif kind == "asymmetric_eclipsing_binary":
        flux -= .012 * transit(epoch, duration) + .007 * transit(epoch + period * .41, duration * .9)
    elif kind == "instrumental_dropouts":
        for shift in rng.uniform(0, .15, 5) + np.arange(5) * 2.6:
            flux[(time > shift) & (time < shift + .075)] -= rng.uniform(.008, .035)
    elif kind in ("quality_edge_dropouts", "stable_step_dropouts"):
        for start in .35 + np.arange(0, baseline, 2.2):
            window = (time > start) & (time < start + .087)
            flux[window] -= .014
            if kind == "quality_edge_dropouts":
                quality[(time >= start - .035) & (time <= start + .043)] = 16
    return time, flux, quality, period, epoch


def trial(seed, kind, depth, baseline=15, *, cadence=.0125, red_noise_scale=1.):
    time, flux, quality, period, epoch = case(seed, kind, depth, baseline, cadence=cadence,
                                            red_noise_scale=red_noise_scale)
    signal = next(iter(analyze(time, flux, quality, settings=SETTINGS)["candidates"]), None)
    return score_trial(signal, period, epoch, seed, kind, depth, baseline)


def score_trial(signal, period, epoch, seed, kind, depth, baseline):
    passed = bool(signal and not signal["warnings"] and signal["observed_transits"] >= SETTINGS.min_transits)
    detected = bool(signal and abs(signal["period_days"] / period - 1) <= .01 and
                    abs((signal["epoch_days"] - epoch + period / 2) % period - period / 2) <= .06)
    recovery = passed and detected
    interval = signal.get("ephemeris", {}) if recovery else {}
    period_score = epoch_score = None
    if interval.get("status") == "estimated":
        t0 = interval["epoch_days"]
        # Project truth to the actual reference cycle, never pick a cycle to minimize residual.
        truth = epoch + (round((signal["epoch_days"] - epoch) / period) + interval["reference_cycle"]) * period
        epoch_half = (interval["epoch_interval_days"][1] - interval["epoch_interval_days"][0]) / 2
        period_half = (interval["period_interval_days"][1] - interval["period_interval_days"][0]) / 2
        epoch_score = abs(t0 - truth) / epoch_half
        period_score = abs(interval["period_days"] - period) / period_half
    evidence = signal.get("instrumental_vetting", {}) if signal else {}
    covered = evidence.get("covered_events", 0)
    stage = ("no detection" if signal is None else "incorrect period or phase" if not detected else
             "vetting rejection" if not passed else "insufficient event coverage" if covered < 4 else
             "unavailable timing fit" if period_score is None else "usable fit")
    return {"seed": seed, "scenario": kind, "depth": depth, "baseline_days": baseline,
            "passed_vetting": passed, "detected": detected, "recovered": recovery,
            "fit_stage": stage, "covered_events": covered,
            "observation_vetting_status": signal.get("observation_vetting", {}).get("status") if signal else None,
            "period_interval_score": period_score, "epoch_interval_score": epoch_score,
            "joint_interval_score": max(period_score, epoch_score) if period_score is not None else None,
            "duration_noise_snr": signal.get("duration_noise_snr") if signal else None,
            "observed_transits": signal["observed_transits"] if signal else 0,
            "warnings": signal["warnings"] if signal else []}


def fraction(success, total):
    if not total:
        return {"count": 0, "total": 0, "fraction": None, "wilson_95": None}
    p, z = success / total, norm.ppf(.975)
    center = (p + z*z / (2*total)) / (1 + z*z/total)
    half = z * np.sqrt(p*(1-p)/total + z*z/(4*total*total)) / (1 + z*z/total)
    return {"count": success, "total": total, "fraction": p,
            "wilson_95": [float(max(0, center-half)), float(min(1, center+half))]}


def evaluate(repeats, seed):
    jobs = [(kind, depth) for kind in ("injection", *CONTROLS)
            for depth in (DEPTHS if kind == "injection" else (0,)) for _ in range(repeats)]
    rows = [trial(seed + index, kind, depth) for index, (kind, depth) in enumerate(jobs)]
    grouped = {str(depth): [r for r in rows if r["depth"] == depth] for depth in DEPTHS}
    # Stratified, disjoint seeds. Calibrate jointly for the period and reference epoch.
    calibration = [r for group in grouped.values() for r in group[::2]]
    holdout = [r for group in grouped.values() for r in group[1::2]]
    scores = sorted(r["joint_interval_score"] for r in calibration if r["joint_interval_score"] is not None)
    test = [r["joint_interval_score"] for r in holdout if r["joint_interval_score"] is not None]
    order = int(np.ceil(.95 * (len(scores) + 1)))
    factor = max(1., scores[order - 1]) if 0 < order <= len(scores) else None
    return {"synthetic": True, "seed": seed, "repeats_per_case": repeats, "settings": asdict(SETTINGS),
            "versions": {"python": platform.python_version(), "astropy": astropy.__version__,
                         "numpy": np.__version__, "scipy": scipy.__version__},
            "completeness_by_depth": {depth: fraction(sum(r["recovered"] for r in group), len(group))
                                      for depth, group in grouped.items()},
            "false_positive_by_scenario": {
                kind: fraction(sum(r["passed_vetting"] for r in rows if r["scenario"] == kind), repeats)
                for kind in CONTROLS},
            "interval_validation": {"calibration_intervals": len(scores), "holdout_intervals": len(test),
                                    "joint_multiplier": factor,
                                    "holdout_before": fraction(sum(s <= 1 for s in test), len(test)),
                                    "holdout_after": fraction(sum(s <= factor for s in test), len(test))
                                    if factor is not None else None},
            "trials": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, default=24)
    parser.add_argument("--seed", type=int, default=6841)
    args = parser.parse_args()
    if not 2 <= args.repeats <= 100 or args.seed < 0:
        parser.error("Use 2–100 repetitions per scenario and a nonnegative seed")
    print(json.dumps(evaluate(args.repeats, args.seed), allow_nan=False, indent=2))


if __name__ == "__main__":
    main()
