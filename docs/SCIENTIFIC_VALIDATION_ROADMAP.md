# AstroLens Scientific Validation Roadmap

**Status:** Audit plan only  
**Scope:** Read-only review of the existing AstroLens implementation and validation of the supplied TESS Sector 70 light-curve CSV.  
**Change policy:** This document does not authorize refactoring, algorithm changes, or deployment changes. Preserve the current implementation until an identified issue is reproduced and reviewed.

## Executive decision

AstroLens already has a substantial browser-based foundation: catalogue access, MAST light-curve import, local light-curve screening, BLS candidate search, detrending comparisons, event-depth diagnostics, injection-recovery, null resampling, and shared scientific primitives.

The next milestone should be **evidence-backed validation of the existing pipeline**, not feature expansion. Unit tests on synthetic data establish repeatability for selected functions; they do not establish scientific performance on real observations.

## Independent search and null calibration artifacts

The priority-1/2 audit runner and its interpretation limits are documented in [`validation/INDEPENDENT_BLS_AUDIT_PLAN.md`](../validation/INDEPENDENT_BLS_AUDIT_PLAN.md). The runner is [`validation/independent_bls_audit.py`](../validation/independent_bls_audit.py), with dependencies in [`validation/requirements-independent.txt`](../validation/requirements-independent.txt). These artifacts define a reproducible Astropy BLS / Lightkurve comparison and 1,000-run conditional maximum-power null experiment. They have **not yet been executed** in this environment because Astropy and Lightkurve are not installed and package retrieval is unavailable; therefore no independent peak agreement or empirical FAP is claimed.

## Latest audit artifact

The supplied CSV's structural integrity and sampling profile are recorded in [`TESS_SECTOR70_INPUT_AUDIT.md`](./TESS_SECTOR70_INPUT_AUDIT.md). Its SHA-256 is `177eceb34c8cbf6220385f3f279f444766ed2abc335067036021bcaa3181e1be`. This confirms input structure, not candidate validity. The end-to-end pipeline regression remains open because the next gate requires capturing the actual pipeline outputs on this exact input and comparing them with a reproducible run.

## Current implementation observed in the repository

- `science-core.js` centralizes residual summaries, event statistics, event-depth consistency, TESS quality handling, candidate depth summaries, injection-recovery, and block-resampled diagnostics.
- `full-analysis.js` runs the integrated analysis, including multiple detrending windows and a candidate search.
- `bls-validation.js` reports screening diagnostics and compares candidate behavior across processing choices.
- `multi-source-discovery.js` provides archive cross-match and observation discovery interfaces.
- `tests/science-core.test.js` exercises reproducibility, event statistics, quality masks, injection-recovery intervals, null controls, and shared-summary consistency on synthetic data.
- The repository CI workflow runs Python unit tests, JavaScript syntax checks, and the science-core test script.

These observations describe code and test coverage, not proof that every scientific assumption is valid or that the live deployment currently matches the repository.

## P0: Real-data regression gate

Run the existing workflow unchanged on the supplied Sector 70 CSV and record:

1. Exact input filename, file hash, row count, recognized columns, time range, cadence distribution, invalid rows, and quality-flag summary.
2. The precise flux column and quality-mask policy used. Confirm that the data product and default TESS quality mask are appropriate for this file; do not assume that a zero flag alone proves clean photometry.
3. Candidate periods, epochs, durations, depths, scores, event coverage, and alias matches for each processing mode.
4. Canonical residual mean, event-depth chi-square, degrees of freedom, reduced chi-square, and search-to-event-mean ratio, all traced to the shared summary.
5. Agreement between the browser's integrated analysis and an independent run of the same committed functions.
6. The effect of long data gaps on predicted event coverage, period sensitivity, and the number of independent observed events.

**Acceptance criteria**
- The same input and code revision produce reproducible results.
- Every displayed shared statistic matches its canonical source, within documented numerical tolerance.
- Missing coverage is reported as missing, not as a non-detection.
- Any disagreement is documented and reproduced before any code is changed.

## P0: Detection-statistics and sensitivity audit

Inspect the existing methods and their assumptions:

- **Injection recovery:** Verify the injection definition, period/epoch search tolerance, depth grid, number of trials per depth, and uncertainty interval calculation. Confirm that the injection and recovery path does not unintentionally reuse the exact selected candidate in a way that inflates recovery.
- **Null controls:** Check that the null experiment represents relevant time-correlated noise and that the reported statistic is described as a restricted diagnostic when only selected periods are evaluated. Do not call it a global false-alarm probability without a full-search calibration.
- **Sensitivity transition:** Report the measured recovery curve and uncertainty. Treat any transition as a range supported by the trials, not a sharp universal threshold.
- **Event-depth consistency:** Verify event grouping, coverage, uncertainty assumptions, and the interpretation of the approximate chi-square critical value.
- **Detrending robustness:** Compare results across existing windows and inspect whether the candidate changes materially with detrending choices.
- **Multiplicity and aliases:** Account for the fact that a search scans many trial periods and can return harmonics or aliases.

**Acceptance criteria**
- Each diagnostic has a documented definition, assumptions, and limitation.
- Recovery and null rates include uncertainty and sample counts.
- No heuristic score is described as a calibrated probability.
- No candidate is called a confirmed planet or new discovery from these diagnostics alone.

## P1: Independent evidence

Only after the P0 gates:

- Confirm the provenance of the input flux product and retrieve the corresponding original FITS metadata when available.
- Cross-match leading periods and target identity against appropriate known-object catalogues.
- Inspect available data-quality, spacecraft/systematics, centroid, and aperture-level evidence where relevant.
- Where public data exist, compare independent sectors or observations while respecting differing cadence and instrument processing.
- Record contradictory evidence and unresolved checks alongside supportive evidence.

## P2: Additions worth considering after validation

1. **Candidate evidence dossier:** One exportable record containing provenance, search configuration, periods, events, depth statistics, quality filtering, aliases, detrending agreement, null diagnostics, and caveats.
2. **Gap-aware coverage view:** Visualize expected versus sampled events and show how gaps affect sensitivity and period ambiguity.
3. **Completeness/reliability report:** Present injection-recovery curves, confidence intervals, matched null rates, and the exact scope of the experiment.
4. **Cross-sector comparison:** Compare candidate consistency across independent sectors or suitable observations.
5. **Reproducibility manifest:** Save input hash, source revision, parameters, processing mode, and output summary so results can be repeated exactly.

These are candidate roadmap items, not instructions to implement them immediately. Prefer reuse of the existing shared scientific functions and UI modules over duplicating calculations.

## Risks and controls

| Risk | Control |
|---|---|
| Synthetic tests pass but real data fail | Make the supplied real-data regression a release gate |
| Different panels compute subtly different values | Trace every displayed shared statistic to the canonical summary |
| Gaps are mistaken for absent events | Explicitly distinguish observed, sparsely sampled, and uncovered events |
| A restricted null test is mistaken for global significance | Label its conditioning and search scope directly |
| Detrending creates or suppresses a dip | Report mode agreement and inspect sensitivity to window choice |
| Catalogue matches are mistaken for confirmation | Keep provenance, candidate status, and confirmation status separate |
| Feature growth obscures unresolved science | Freeze feature work until P0 acceptance criteria are met |

## Release decision checklist

- [ ] Original CSV identified and hashed.
- [ ] Input parsing, cadence, gaps, and quality policy documented.
- [ ] Real-data run reproduced from the current committed source.
- [ ] Shared diagnostics agree across all panels.
- [ ] Injection-recovery and matched null controls reviewed.
- [ ] Sensitivity transition and uncertainty interpreted conservatively.
- [ ] Aliases and known-object cross-matches reviewed.
- [ ] Remaining limitations visible in the candidate report.
- [ ] No scientific conclusion exceeds the available evidence.

**Release rule:** Until the checklist is complete, describe the state as *scientific validation in progress*. Passing automated tests and deployment checks is necessary engineering evidence, but not sufficient scientific validation.

## Engineering and UI assurance charter (NASA-inspired, not a certification claim)

Use NASA's published software assurance, software engineering, planetary-data, and accessibility guidance as reference points for disciplined engineering. This charter is an internal quality target; it does **not** assert that AstroLens is NASA-certified or formally compliant with every NASA standard.

### Engineering assurance

- **Requirements traceability:** For each scientific output, document its input, algorithm, assumptions, units, uncertainty, and test coverage.
- **Verification before modification:** Reproduce a defect, add a regression test where feasible, review the change, and verify both expected behavior and relevant failure cases.
- **Controlled change:** Keep this audit branch documentation-only until the real-data gate identifies a specific issue. Do not change `main`, application code, or deployment configuration as part of this roadmap update.
- **Reproducibility:** Record source revision, input hash, analysis parameters, and the environment or processing mode needed to repeat a result.
- **Risk-based testing:** Prioritize scientific correctness, data integrity, and misleading-result prevention over cosmetic polish or feature count.

### Mission-control UI principles

- **Information hierarchy:** Make target identity, data provenance, analysis state, candidate evidence, uncertainty, and limitations easy to distinguish.
- **Readable science first:** Favor legible axes, explicit units, honest uncertainty, sensible chart scales, and visible data gaps over decorative effects.
- **Focused workspaces:** Keep discovery, light-curve inspection, candidate validation, and evidence/reporting tasks distinct while preserving navigation context.
- **Precision glassmorphism, restrained:** Use compact translucent surfaces and liquid-style navigation only where they improve hierarchy. Avoid heavy blur, excessive motion, low-contrast text, or effects that compete with scientific plots.
- **Responsive operation:** Ensure tables, charts, controls, and evidence summaries remain usable on mobile as well as desktop.
- **Accessible interaction:** Provide keyboard access, visible focus, meaningful labels, adequate contrast, and chart cues that do not rely on color alone. Include clear loading, empty, invalid-data, and failure states.
- **No false certainty:** Do not use color, badges, animations, or polished presentation to imply a stronger scientific result than the evidence supports.

### UI and engineering review checklist

- [ ] Every important displayed quantity has a defined source and unit.
- [ ] Uncertainty, missing coverage, quality filtering, and analysis limitations are visible where decisions are made.
- [ ] Charts remain interpretable with gaps, aliases, and low event coverage.
- [ ] Keyboard navigation, focus states, labels, contrast, and non-color cues are reviewed.
- [ ] Mobile layouts preserve scientific context and do not hide critical caveats.
- [ ] Loading, empty, invalid-input, and error states are deliberate and understandable.
- [ ] Visual effects do not reduce readability or obscure data.
- [ ] Any code change is tied to a reproduced issue or an approved requirement and has appropriate regression coverage.

### Reference guidance

- NASA software assurance and software safety: https://sma.nasa.gov/docs/default-source/policies/nasa-std-8739-8b.pdf
- NASA software engineering requirements and related resources: https://www.nasa.gov/intelligent-systems-division/software-management-office/nasa-software-engineering-procedural-requirements-standards-and-related-resources/
- NASA accessibility resources: https://www.nasa.gov/section-508-accessibility-at-nasa/
- NASA Planetary Data System standards overview: https://pds.nasa.gov/datastandards/about/

Apply the guidance proportionately to this browser-based research tool. Do not claim formal compliance without a defined applicability assessment, documented verification, and the appropriate review.

