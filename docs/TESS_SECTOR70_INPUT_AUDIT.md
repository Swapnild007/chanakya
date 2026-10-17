# AstroLens TESS Sector 70 Input Audit

**Status:** Input-integrity audit completed; end-to-end AstroLens scientific regression still pending.  
**Scope:** Structural and sampling checks on the supplied CSV only. This is not a transit detection result and does not independently validate AstroLens candidate statistics.

## Input identity

- File: `tess2023263165758-s0070-0000000278892590-0265-s_lc (2)_astrolens.csv`
- SHA-256: `177eceb34c8cbf6220385f3f279f444766ed2abc335067036021bcaa3181e1be`
- Rows: 13,559 data rows
- Columns: `time`, `flux`, `quality`
- Time scale: values span 3209.1157877610244 to 3232.9245017729786, a baseline of 23.80871401195418 days
- Missing values: 0 in all three columns
- Non-finite time or flux: 0
- Non-positive flux values: 0
- Duplicate timestamps: 0
- Non-increasing time steps: 0
- Quality flags: all 13,559 rows have `quality = 0`
- Flux uncertainty column: absent
- Original FITS header / complete product provenance: not present in this CSV

## Sampling and coverage

- Median cadence: 1.9999119 minutes, approximately 2 minutes
- 10th to 90th percentile of adjacent time steps: approximately 1.9998811 to 1.9999488 minutes
- Three gaps exceed one hour:
  1. 5.16649 hours, after row index 3913 (zero-based interval index), from time 3214.5503619 to 3214.7656323
  2. 109.26238 hours (4.55260 days), after interval index 5846, from time 3217.4488673 to 3222.0014666
  3. 5.16639 hours, after interval index 9767, from time 3227.4456521 to 3227.6609183
- These gaps must be represented explicitly in event-coverage and sensitivity interpretation. Do not treat an event falling inside a gap as a missed transit or evidence against a candidate.

## Interpretation and limitations

1. A zero-valued quality column means no rows are flagged in this CSV. It does **not** prove the photometry is free of systematics or that the appropriate product-specific quality policy has been applied.
2. The CSV does not include flux uncertainties or the original FITS header, so error-weighted inference and provenance verification cannot be completed from this file alone.
3. The input checks establish basic file integrity and sampling structure only. They do not establish a period, transit depth, false-alarm probability, recovery threshold, candidate significance, or discovery.
4. The application's actual parsing, quality filtering, candidate search, detrending modes, shared diagnostics, injection-recovery, and null tests still need to be run against this exact hashed input and compared with a reproducible independent run of the committed source.

## Remaining release gate

- [ ] Run the current committed AstroLens pipeline on this exact file without changing application code.
- [ ] Capture the source revision and all analysis parameters.
- [ ] Compare shared residual mean, event-depth consistency, reduced chi-square, and search-to-event-mean ratio across all panels.
- [ ] Record leading periods, epochs, durations, candidate depths, event coverage, and aliases for each processing mode.
- [ ] Validate injection-recovery and null-test assumptions and uncertainty; do not describe a restricted null test as global false-alarm probability.
- [ ] Review known-object cross-matches and obtain original FITS metadata / uncertainty information if available.
- [ ] Keep the result labeled **scientific validation in progress** until the above checks pass.

**Change-control note:** This report is documentation only. It does not authorize edits to application code, `main`, or deployment configuration.
