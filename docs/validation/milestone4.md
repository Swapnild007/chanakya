# Milestone 4 validation

Baseline [cfb6f7b](https://github.com/Swapnild007/chanakya/commit/cfb6f7baa40dd41f13fbe7b3a8c0bb0dc2c146c0). The local baseline tree was verified against GitHub. The milestone is incomplete while silent artifacts and real-data uncertainty calibration remain unresolved.

## Stable steps and measurement scope

All 36 legacy stable steps passed the baseline and the updated photometric checks. All 36 now have an explicit insufficiently validated evidence status. In a representative 24-day control, a 2.20004-day signal had 11 locally supported events and only four favored the abrupt model by the existing criterion. The fitted box duration was 0.070 days versus the simulated 0.087-day step. Both cadence sampling and fitting the box and trapezoid at a fixed BLS-derived width and fitted center affect that contrast. Phase coherence, consistent depths and clean quality are expected by construction. A repeatable box alone cannot establish origin.

The new veto compares the median event contrast with a two-shoulder local slope and robust shoulder scatter in SAP background and spacecraft pointing-correction streams. It requires at least four same-direction excursions exceeding five local scatter units and a strict majority of measured events. This is a heuristic coincidence rule, with no calibrated false-alarm significance. Centroid summaries and SAP flux are descriptive. SAP and PDCSAP use the same exposures. A light-curve summary does not localize the source on pixels. Target motion could also reflect a blend. The workstation and JSON expose these distinctions and retain catalogue identity separately from observation vetting.

## Independent synthetic holdout

Development and holdout each contain 336 trials with disjoint seeds. The design crosses 10- and 30-minute cadences, 12- and 25-day baselines, two correlated-noise strengths and two signal depths. It uses randomized phase, duration and period, exposure-sampled profiles, and independent auxiliary noise. The holdout is paired by seed between baseline and update. The unchanged BLS detector found 334 of 336 injections at the injected period and phase. The table reports the number passing photometric vetting. Each row has 48 trials.

| Holdout scenario | Baseline | Updated | Updated 95% Wilson interval |
| --- | ---: | ---: | ---: |
| Background-coincident step | 43 | 0 | 0–7.4% |
| Pointing-coincident step with recovery tail | 42 | 0 | 0–7.4% |
| Centroid-only blend mimic | 42 | 42 | 75.3–94.1% |
| Silent step | 44 | 44 | 80.4–96.7% |
| Planet | 42 | 42 | 75.3–94.1% |
| Planet with unrelated background excursions | 44 | 44 | 80.4–96.7% |
| Planet with deliberately coincident background | 46 | 0 | 0–7.4% |

The 46-to-zero regression in the mixed case measures a real failure mode of a coincidence veto. The zero-acceptance results only apply to the simulated witness strengths and profiles. Silent and centroid-only survivors remain insufficiently validated. Unmatched light-curve signals remain review items. This sample provides no population false-positive estimate.

## Ephemeris and authentic observations

In the 288-injection timing-stress replay, 51 had no detection, 65 returned an incorrect period or phase, 53 failed vetting, 11 had insufficient covered events, seven had enough covered events but no usable timing estimate, and 101 had usable fits. Joint period and epoch coverage was 101/101 conditional on a usable fit. Usable-fit probability was 101/288 (35.1%). The stress report includes cadence, correlated noise, depth, baseline, and covered-event strata. Low-support and shallow regimes remain limited.

The SHA-256-pinned replay analyzed 10 previously acquired MAST light curves with the recorded catalogue snapshot. It reproduced six known planet identifications, including all four explicit controls. It produced zero vetted unmatched signals and zero new discoveries. None of the screened candidates in this sample triggered the new background or pointing coincidence warning. This replay assesses regression on known products and provides no labelled real instrumental positives.

In the HAT-P-7 b Kepler Quarter 2 split, the halves used the same BJD TDB reference. Four and seven timings survived coverage and timing checks, respectively, with all timed events several cycles from the comparison epoch. The fitted periods differed by 78.7 seconds. Propagating each nominal epoch interval with its period covariance gave half-widths of 163.2 and 43.0 minutes at the common cycle, encompassing the 24.1-minute point difference. The difference remained 24.1 minutes at 1-, 2- and 3-day PDCSAP detrending, and was 22.2 minutes with SAP at 2 days. Sparse timing support and period extrapolation explain the wide agreement bounds. These checks do not identify a unique cause for the point difference or validate coverage on real data.

The survey can compare separately fitted same-target products with disjoint time windows in BJD TDB. It rejects duplicate or overlapping observations as independent evidence and withholds epoch comparisons where cycle pairing is ambiguous. A live public archive probe downloaded HAT-P-7 Kepler Quarters 1 and 2. The independently fitted periods differ by 20.8 seconds and the projected epochs by 9.6 minutes. Their nominal half-widths at the comparison cycle were 24.6 and 26.6 minutes, and the cycle pairing was unique under those intervals. An authentic 46.4 MB WASP-12 TESS Sector 20 target-pixel file was downloaded from MAST and pinned by SHA-256. Both apertures measured 21 events. Median fractional depth was 1.374% for the 11-pixel optimal aperture and 0.884% across the 121 collected pixels. Median centroid shifts were (−0.00004, −0.00005) and (+0.00253, −0.00694) pixels, respectively. The difference is aperture-dependent and descriptive. These pixels share exposures with the light curve. The measurements provide neither PRF localization nor a confidence claim. The research probe now allows a longer transfer only for this fixed product.

## Reproduce

Run with the repository requirements and set `OPENBLAS_NUM_THREADS=1` for parallel validation.

```sh
python -m astronomy.artifact_validation development
python -m astronomy.artifact_validation holdout
python -m astronomy.reliability --timing-stress --repeats 6
python -m astronomy.survey data/milestone3-targets.json --cache observations \
  --catalogue-snapshot docs/validation/milestone4-catalogue-snapshot.json \
  --sensitivity-target 'KIC 10666592'
python -m astronomy.observation_validation
```

For the paired baseline, copy only `astronomy/artifact_validation.py` and `astronomy/evaluate.py` from this branch into a disposable checkout of `cfb6f7b` and run `python -m astronomy.artifact_validation holdout --legacy`. The baseline analyzer, cadence vetting and ephemeris modules stay at the checkpoint. The [measured summaries](milestone4-results.json) include Wilson intervals and individual real-product provenance.

Pixel localization on real false positives, independent corroboration of unmatched signals, verification across repeated TESS sectors and K2 campaigns, and real-observation interval coverage remain open. The discovery search was held to the fixed regression sample.
