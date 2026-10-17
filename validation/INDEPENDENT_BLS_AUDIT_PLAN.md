# Independent BLS Audit: Execution Plan and Input Findings

**Status:** Audit runner added; scientific run pending dependency-enabled execution.  
**Branch:** `audit/scientific-validation-roadmap`  
**Priority:** independent search agreement, then null calibration.  
**No application code or deployment changes are authorized by this artifact.**

## 1. Independent reference search

The runner at [`validation/independent_bls_audit.py`](./independent_bls_audit.py) performs a deterministic Astropy `BoxLeastSquares` search on a fixed period grid and attempts an independent Lightkurve BLS periodogram on the same timestamps and normalized flux. It records grid configuration, top peak, and period agreement without comparing unlike power definitions.

Example command from the repository root:

```bash
python -m pip install -r validation/requirements-independent.txt
python validation/independent_bls_audit.py "/path/to/tess2023263165758-s0070-0000000278892590-0265-s_lc (2)_astrolens.csv" --seed 20261018 --null-runs 1000 --period-count 5000 --null-mode block --output independent_bls_audit.json
```

The default grid is 0.15–10 days with 5,000 uniformly spaced period samples and fixed durations of 0.02–0.12 days. The seed is fixed at 20261018. The script records the input SHA-256 in its output.

## 2. Null calibration boundary

The script computes the maximum Astropy BLS SNR over the full configured period-duration grid for each null realization and reports the exceedance count, add-one empirical tail estimate, a Wilson interval, and null-maximum quantiles. It supports point-shuffle and contiguous-block nulls.

**Important:** this is an empirical false-alarm estimate conditional on the chosen null generator, period grid, duration grid, and preprocessing. A block shuffle is not a universal stellar/instrument noise model. It is **not** the false-alarm probability of AstroLens' full pipeline unless AstroLens' exact preprocessing and search are reproduced for every null realization. Do not remove the app's "not computed" gate based only on this reference-search estimate.

## 3. Preliminary histogram / excursion finding

Input hash: `177eceb34c8cbf6220385f3f279f444766ed2abc335067036021bcaa3181e1be`

- 13,559 rows, columns `time`, `flux`, `quality`; all quality flags are zero.
- Flux range: 392.7912 to 521.0688; median 414.1219.
- There are 16 observations below flux 396, spanning several times rather than forming one single continuous low-flux event.
- A distinct high-flux cluster contains 73 consecutive observations between time 3225.144382 and 3225.244377, with flux from 444.5259 to 521.0688, plus one nearby high point. This is a strong local excursion worth inspecting as a possible artifact or astrophysical event.
- A global-median 10,000-ppm cut would reject 6,603 of 13,559 rows because the input flux has a broad distribution/trend. Therefore, applying the proposed threshold directly to raw flux would be scientifically unsafe. The test must be relative to a documented local baseline or detrended residual, with both masked and unmasked results reported.

These are distributional observations, not a diagnosis of the physical cause. The original FITS header and flux-error column are missing from the CSV, so target provenance and uncertainty-aware analysis remain open.

## 4. Required interpretation

- A reference peak match is necessary evidence, not sufficient proof of a transit.
- Report the Astropy and Lightkurve peak periods, the actual grid resolution, and their difference.
- Run at least 1,000 null realizations for each declared null model. If computational limits prevent that, report the actual number and do not claim a 1,000-run result.
- Keep false-alarm probability unavailable in the app until the exact app pipeline is calibrated with appropriate null trials and the noise model is justified.
- The 0.460-day and 0.771-day candidates still require dense local-grid checks and window/alias analysis.
- Do not claim a planet or discovery from a periodogram peak alone.
