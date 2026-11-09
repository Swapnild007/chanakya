"""Paired synthetic assessment of background and pointing coincidence vetting."""
import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
import json

import numpy as np
from scipy.signal import lfilter

from .discovery import analyze
from .evaluate import SETTINGS, case, fraction, score_trial
from .reliability import coverage

SEEDS = {"development": 217001, "holdout": 391027}
SCENARIOS = ("background step", "pointing recovery", "blended centroid",
             "silent step", "planet", "planet with unrelated excursions", "planet with coincident background")


def run(job):
    seed, kind, cadence_minutes, baseline, noise, depth, legacy = job
    cadence = cadence_minutes / 1440
    rng = np.random.default_rng(seed + 900_000)
    time, flux, quality, period, epoch = case(seed, "correlated_noise", baseline=baseline,
                                             cadence=cadence, red_noise_scale=noise)
    duration = rng.uniform(.08, .17)
    phase = (time - epoch + period / 2) % period - period / 2
    offsets = cadence * np.linspace(-.45, .45, 10)
    phase_grid = phase[:, None] + offsets
    step = (np.abs(phase_grid) < duration / 2).mean(axis=1)
    ramp = np.clip((duration / 2 - np.abs(phase_grid)) / (.20 * duration) + .5, 0, 1).mean(axis=1)
    recovery = (step + .25 * np.exp(-np.maximum(phase - duration / 2, 0) / duration)
                * (phase > duration / 2))
    planet = kind.startswith("planet")
    flux -= depth * (ramp if planet else recovery if kind == "pointing recovery" else step)
    background, pointing, centroid = (
        lfilter([1], [1, -.45], rng.normal(0, 1, len(time))) for _ in range(3))
    if kind == "background step" or kind == "planet with coincident background":
        background += rng.uniform(10, 16) * step
    if kind == "pointing recovery":
        pointing -= rng.uniform(10, 16) * recovery
    if kind == "blended centroid":
        centroid += rng.uniform(10, 16) * step
    if kind == "planet with unrelated excursions":
        unrelated = (time % (period * 1.23)) < duration
        background += 13 * unrelated
    options = {} if legacy else {"ancillary": {"SAP_BKG": background, "POS_CORR1": pointing,
                                               "MOM_CENTR1": centroid}}
    report = analyze(time, flux, quality, settings=SETTINGS, **options)
    return {**score_trial(next(iter(report["candidates"]), None), period, epoch, seed, kind, depth, baseline),
            "cadence_minutes": cadence_minutes, "noise_scale": noise}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("split", choices=SEEDS)
    parser.add_argument("--legacy", action="store_true", help="Run against the previous analyzer without ancillary input")
    parser.add_argument("--workers", type=int, default=4, choices=range(1, 9))
    args = parser.parse_args()
    strata = [(kind, cadence, baseline, noise, depth) for kind in SCENARIOS
              for cadence in (10, 30) for baseline in (12, 25) for noise in (1., 2.)
              for depth in (.004, .009) for _ in range(3)]
    jobs = [(SEEDS[args.split] + i, *stratum, args.legacy) for i, stratum in enumerate(strata)]
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(run, jobs))
    summaries = {}
    for kind in SCENARIOS:
        group = [r for r in rows if r["scenario"] == kind]
        summaries[kind] = {
            "detected": fraction(sum(r["detected"] for r in group), len(group)),
            "passed_photometry": fraction(sum(r["passed_vetting"] for r in group), len(group)),
            "insufficiently_validated": sum(r["observation_vetting_status"] == "insufficiently validated" and
                                            r["passed_vetting"] for r in group),
            "instrumental_coincidences": sum(r["observation_vetting_status"] == "instrumental coincidence" for r in group),
            "fit_stages": Counter(r["fit_stage"] for r in group),
            "intervals": coverage(group, 1.),
        }
    print(json.dumps({"split": args.split, "seed": SEEDS[args.split], "legacy": args.legacy,
                      "scenarios": summaries, "trials": rows}, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
