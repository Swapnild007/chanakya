# Executed Sector 70 Data Diagnostics and Execution Blockers

**Run date:** 2026-10-18  
**Scope:** Actual CSV structural/distribution checks plus a small exploratory custom box scan.  
**Status:** Input diagnostics executed. Astropy/Lightkurve reference search and calibrated null trials remain **blocked**, not passed.  
**Change control:** No application source, `main`, or deployment files were changed.

## 1. Environment and dependency attempt

The supplied CSV is present in the analysis runtime. Available: NumPy, pandas, SciPy, Matplotlib. Missing: Astropy and Lightkurve. Installing `astropy>=6.0` and `lightkurve>=2.4` was attempted, but package installation failed because the environment cannot resolve the package index hostname (network/DNS unavailable). No result is claimed for either established BLS implementation.

## 2. Input integrity, verified in this run

- File: `tess2023263165758-s0070-0000000278892590-0265-s_lc (2)_astrolens.csv`
- SHA-256: `177eceb34c8cbf6220385f3f279f444766ed2abc335067036021bcaa3181e1be`
- 13,559 rows; columns `time`, `flux`, `quality`
- All quality flags are zero.
- Time span: 3209.1157877610244 to 3232.9245017729786; baseline 23.80871401195418 days.
- Median cadence: 1.9999119 minutes.
- Gaps exceeding one hour: 5.16649 hours, 109.26238 hours (4.55260 days), and 5.16639 hours.
- No missing values, duplicate timestamps, non-finite time/flux, or non-positive flux values were found.
- No flux-error column or original FITS header is included.

## 3. Flux-distribution checks

| Statistic | Value |
|---|---:|
| Minimum flux | 392.7912 |
| 1st percentile | 400.4256 |
| 25th percentile | 410.0618 |
| Median | 414.1219 |
| 75th percentile | 418.1063 |
| 99th percentile | 429.9585 |
| 99.9th percentile | 502.5150 |
| Maximum flux | 521.0688 |

There are 16 observations in the 392–396 range. They are isolated in time, not one continuous low-flux event. There are 710 observations between 409 and 410, so that range is part of the ordinary central distribution rather than a small isolated cluster.

A high-flux excursion is clear: 73 consecutive observations from time 3225.1443816 to 3225.2443767 (about 2.4 hours), with flux 444.5259 to 521.0688, plus one nearby isolated observation at flux above 444. This warrants investigation, but the CSV alone cannot distinguish instrumental artifact from astrophysical behavior.

## 4. Why the proposed 10,000-ppm mask needs care

A 10,000-ppm cut relative to the global median rejects 6,603/13,559 observations (48.7%), so it is not a safe raw-flux mask.

As a sensitivity diagnostic, I also compared flux against a 361-sample rolling median (approximately 0.5 days). A 10,000-ppm absolute residual threshold flags 6,497 observations in 3,383 short runs. This demonstrates that a simple fixed threshold at this scale is not selective for a handful of extreme points in this dataset. It does **not** mean 6,497 points are bad data. The flux has broad variability and the local baseline/window choice affects the residuals. Do not delete these points without inspecting the light curve, the original FITS quality/provenance, and robustness under predeclared alternative masks.

## 5. Exploratory local period scan (not a validated BLS implementation)

A small custom phase-folded box scan was run only around the three requested neighborhoods using a 0.5-day rolling-median-normalized series. It is a diagnostic to see whether the previously quoted period values remain stable under this particular processing choice; it is **not** Astropy BLS, Lightkurve BLS, a calibrated statistic, or a significance estimate.

- Around 0.460 days, the strongest local-grid result was 0.4594 days.
- Around 0.771 days, the strongest local-grid result was 0.7554 days, not 0.771 days.
- Around 0.500 days, the strongest local-grid result was 0.5050 days.

The search grid used 0.0002-day spacing and durations 0.01–0.06 days. The best scores favored the longest duration in some neighborhoods, which is a warning that broad residual structure may dominate the simple box statistic. These values must **not** be treated as independently validated candidate periods. A proper fixed-grid Astropy/Lightkurve comparison and window/alias diagnostics are still required.

## 6. Null calibration and release decision

The requested ≥1000 null trials were **not run**. The independent BLS libraries are unavailable in this runtime, and a custom null experiment would not substitute for the specified established implementation or the exact AstroLens preprocessing/search.

The false-alarm gate must remain closed until:
1. Astropy and Lightkurve are executed on the same fixed input, grid, and preprocessing;
2. peak agreement and the difference in period are recorded;
3. at least 1,000 null realizations per declared null model run the complete search and save each maximum statistic;
4. the observed statistic's empirical exceedance fraction and uncertainty are reported;
5. the noise/null model is justified, with gap and correlated-noise effects considered.

A reference BLS null estimate is not automatically the false-alarm probability of AstroLens' pipeline. No candidate ranking should be trusted as discovery evidence at this stage.

## 7. Next required input

Obtain the original TESS light-curve FITS file for this observation (or a verified MAST download) so TICID, RA_OBJ, DEC_OBJ, CROWDSAP, flux-error columns, and product provenance can be checked. The CSV filename embeds a target-like identifier, but a filename alone is not authoritative target verification.
