# Milestone 3 validation

[Expanded survey and provenance](milestone3-survey.json) · [Synthetic trials and calibration strata](milestone3-synthetic.json) · [Frozen target selection](../../data/milestone3-targets.json)

## Instrumental-dropout investigation

The six accepted Milestone 2 dropout seeds were 93078, 93090, 93095, 93117, 93118, and 93124. Each simulated periodic rectangular depressions near a 2.6-day cycle with timing jitter and varying depths. The recovered periods were 2.561–2.616 days. None had a flagged cadence inside the fitted event windows. Coherent periodograms, adequate duration-noise SNR, and an absence of a strong secondary allowed them to pass. The former broad depth-ratio rule was insensitive to significant local depth differences when the absolute spread remained below its cutoff.

The new local continuum and noise model found inconsistent event depths for 93090, 93095, 93117, and 93118. Two cases still passed. Each had only three locally supported events. One exhibited two sharp events, below the requirement for a recurring morphology warning. The other had no recurring sharp morphology and lacked enough local measurements for a depth consistency test. The replays are regression evidence. They are excluded from the new development and holdout totals.

The two new seed ranges have 360 trials each and use 9-, 15-, and 24-day baselines. Only the development range determines the interval scale. The holdout uses the identical cases for both the legacy and new vetters. The legacy comparison runs the current trial generator with the `f0d9bf9` discovery analyzer. The paired holdout reduced jittered-dropout acceptance from 4/36 to 1/36. Stable unflagged steps were designed to recur at fixed phase and depth and still passed 36/36. Their behavior is consistent with a limitation of flux-only vetting at this cadence.

## Timing agreement and limits

The frozen synthetic scale and the new development scale were both ×1.00. The new holdout covered both true values in 60/60 eligible intervals, out of 144 injection trials. Six recovered trials had no eligible ephemeris. There was no measurable interval coverage at 1,000 ppm or with fewer than four observed events, and the 2,000 ppm stratum had only two intervals. The JSON includes separate period, epoch, and joint results for depth, SNR, baseline, and transit-count strata, with Wilson intervals.

Four real known-planet fits supported nominal catalogue and disjoint-half comparisons. Four catalogue periods and three propagated catalogue epochs fell in their respective nominal intervals. Absolute period differences between the halves were 3.9–12.1 seconds, and common-cycle epoch differences were 39–303 seconds. The fits use disjoint cadences and independent preprocessing, with the catalogue period family and full-product duration held in common. The catalogue point references may share data and have uncertainties, covariance, and timing variations. These checks measure agreement and do not establish real-observation coverage.

## Real-target accounting

All ten fixed targets were retrieved, verified by FITS target identifier and SHA-256, analyzed, and compared against applicable catalogues. Six targets had a catalogue match, eight had at least one rejected candidate, nine had at least one photometric warning, and none had a vetted unmatched signal. These target categories overlap. There were no acquisition or analysis failures in the final run. This is a fixed engineering sample with known controls, so its counts do not estimate survey yield.

## Coverage-vetted ephemeris follow-up

The original estimator independently repeated the event-profile fit using the globally supported cycles. An event could therefore contribute timing after the local audit marked its coverage limited. Full-product and disjoint-half fits now use the timing measurements from the same local coverage audit. Candidate classification rules and the search grid are unchanged. The workstation exposes individual cycle coverage, flagged and missing cadence counts, and event timing in Candidate Investigation.

Reproduce the follow-up with:

```bash
OPENBLAS_NUM_THREADS=1 python -m astronomy.reliability --workers 6 > timing-reliability.json
OPENBLAS_NUM_THREADS=1 python -m astronomy.reliability --timing-stress --repeats 6 --workers 6 > timing-stress.json
OPENBLAS_NUM_THREADS=1 python -m astronomy.survey data/milestone3-targets.json --cache .venv/observations --workers 4 > timing-survey.json
```

The 720-trial paired rerun reproduced the prior classification, injection recovery, fit availability, and interval scores to within 0.000001. The separate six dropout replays retained the same four rejections and two escapes. Joint coverage remained 60/60 among eligible holdout fits (95% Wilson interval 94.0–100%), out of 66 recoveries and 144 injected trials. The [updated runtime calibration evidence](../../data/covered-event-calibration.json) records separate period, epoch and joint counts and Wilson intervals by depth, duration-noise SNR, baseline and observed transit count. The development-only scale stayed at 1.00.

The independent stress run used seeds starting at 180000, with 1,000–8,000 ppm injections and 9-, 15-, and 24-day baselines in each regime. Red-noise scale multiplies the simulated AR(1) innovation amplitude. Each stratum uses distinct seeds. The nominal intervals were evaluated without fitting a scale on these runs.

| Cadence | Red-noise scale | Recovery | Joint timing coverage | 95% Wilson interval |
|---|---:|---:|---:|---:|
| 18 min | 1× | 32/72 | 27/27 | 87.5–100% |
| 18 min | 2× | 27/72 | 26/26 | 87.1–100% |
| 30 min | 1× | 35/72 | 27/27 | 87.5–100% |
| 30 min | 2× | 25/72 | 21/21 | 84.5–100% |

Separate period and epoch counts equaled joint counts in each regime. These small, recovery-selected samples are consistent with nominal 95% coverage and with conservative intervals. They leave coverage at shallow depths, on more complex noise, and in real observations weakly constrained or unverified.

The live MAST rerun analyzed all ten SHA-256-pinned products. Six targets had known matches, eight had at least one rejected candidate, nine had a photometric warning, and zero had a vetted unmatched signal. The six known matches were WASP-12 b, HAT-P-7 b, Kepler-8 b, WASP-47 b, TrES-2 b, and Kepler-17 b. Four catalogue periods and three propagated catalogue epochs fell within nominal intervals. The absolute disjoint-half differences were 3.4–78.7 seconds in period and 43–1,448 seconds in epoch. HAT-P-7 b accounted for both maxima. Its full-product fit went from 18 to 11 timed events, and its halves used four and seven. The broader disagreement and small number of timings show why coverage eligibility and catalogue agreement should be reported together. The published intervals remain conditional on the period family and timing model.
