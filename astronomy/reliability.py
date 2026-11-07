"""Run the predeclared Milestone 3 synthetic development and holdout protocol."""
import argparse
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict
import json
import math
import platform

import astropy
import numpy
import scipy

from .evaluate import CONTROLS, DEPTHS, SETTINGS, fraction, trial

BASELINES = (9, 15, 24)
SCENARIOS = (*CONTROLS, "quality_edge_dropouts", "stable_step_dropouts")
DEVELOPMENT_SEED = 105000
HOLDOUT_SEED = 134100
REPLAYS = (93078, 93090, 93095, 93117, 93118, 93124)


def jobs(seed, repeats):
    strata = [(kind, depth, baseline) for kind in ("injection", *SCENARIOS)
              for depth in (DEPTHS if kind == "injection" else (0,))
              for baseline in BASELINES for _ in range(repeats)]
    return [(seed + i, *stratum) for i, stratum in enumerate(strata)]


def run_trial(job):
    return trial(*job)


def coverage(rows, scale):
    eligible = [row for row in rows if row["joint_interval_score"] is not None]
    out = {"attempted": len(rows), "recovered": sum(row["recovered"] for row in rows)}
    for axis in ("period", "epoch", "joint"):
        out[axis] = fraction(sum(row[f"{axis}_interval_score"] <= scale for row in eligible), len(eligible))
    return out


def summarize(dev, holdout):
    scores = sorted(row["joint_interval_score"] for row in dev if row["joint_interval_score"] is not None)
    rank = math.ceil(.95 * (len(scores) + 1))
    scale = max(1., scores[rank - 1]) if 0 < rank <= len(scores) else None
    injections = [row for row in holdout if row["scenario"] == "injection"]
    result = {
        "synthetic": True, "settings": asdict(SETTINGS),
        "versions": {"python": platform.python_version(), "astropy": astropy.__version__,
                     "numpy": numpy.__version__, "scipy": scipy.__version__},
        "development_seed": DEVELOPMENT_SEED, "holdout_seed": HOLDOUT_SEED,
        "completeness_by_depth": {
            str(depth): fraction(sum(row["recovered"] for row in injections if row["depth"] == depth),
                                 sum(row["depth"] == depth for row in injections)) for depth in DEPTHS},
        "false_positive_by_scenario": {
            scenario: fraction(sum(row["passed_vetting"] for row in holdout if row["scenario"] == scenario),
                               sum(row["scenario"] == scenario for row in holdout)) for scenario in SCENARIOS},
        "interval_validation": {
            "development_eligible": len(scores), "joint_multiplier": scale,
            "holdout_nominal": coverage(injections, 1.),
            "holdout_scaled": coverage(injections, scale) if scale is not None else None,
        },
    }
    groups = {
        "depth": {str(d): [r for r in injections if r["depth"] == d] for d in DEPTHS},
        "baseline_days": {str(b): [r for r in injections if r["baseline_days"] == b] for b in BASELINES},
        "duration_noise_snr": {"<10": [], "10–<20": [], "≥20": [], "unavailable": []},
        "observed_transits": {"0–3": [], "4–6": [], "≥7": []},
    }
    for row in injections:
        snr, count = row["duration_noise_snr"], row["observed_transits"]
        groups["duration_noise_snr"]["unavailable" if snr is None else "<10" if snr < 10 else
                                     "10–<20" if snr < 20 else "≥20"].append(row)
        groups["observed_transits"]["0–3" if count < 4 else "4–6" if count < 7 else "≥7"].append(row)
    result["interval_validation"]["strata"] = {
        axis: {label: {"nominal": coverage(rows, 1.), "scaled": coverage(rows, scale) if scale is not None else None}
               for label, rows in bins.items()} for axis, bins in groups.items()
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, default=12, help="Trials per scenario/depth and baseline")
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    if not 1 <= args.repeats <= 30 or not 1 <= args.workers <= 8:
        parser.error("Use 1–30 repeats and 1–8 workers")
    development = jobs(DEVELOPMENT_SEED, args.repeats)
    holdout = jobs(HOLDOUT_SEED, args.repeats)
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        dev = list(pool.map(run_trial, development))
        held = list(pool.map(run_trial, holdout))
        replays = list(pool.map(run_trial, [(seed, "instrumental_dropouts", 0) for seed in REPLAYS]))
    print(json.dumps({**summarize(dev, held), "development": dev, "holdout": held,
                      "prior_escape_replays": replays}, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
