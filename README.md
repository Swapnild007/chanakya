# AstroLens: AI-Assisted Astronomy Discovery

AstroLens is a clean rebuild of this repository as a research tool for ranking potential astronomical discoveries from observations. It is not a claim that a new star, planet, or other object has already been discovered.

## Scientific scope
- **Milestone 1:** inspect and score candidate transit-like signals in tabular light-curve measurements.
- **Milestone 2:** connect to public, documented astronomy datasets and preserve source identifiers/provenance.
- **Milestone 3:** add cross-catalogue matching, uncertainty-aware ranking, and reproducible candidate reports.
- **Milestone 4:** evaluate on labelled public data, compare with a baseline, and document false positives.

## Repository layout
- `index.html`, `styles.css`, `app.js`: static mobile-friendly research dashboard.
- `astronomy/candidate_engine.py`: deterministic, inspectable candidate scoring engine.
- `data/demo_observations.csv`: clearly labelled synthetic test data, not telescope observations.
- `tests/test_candidate_engine.py`: automated unit tests.
- `.github/workflows/tests.yml`: CI test workflow.

## Run locally
Requires Python 3.10+.

```bash
python -m unittest discover -s tests -v
python -m http.server 8000
```
Open http://localhost:8000.

## Candidate scoring
The initial engine uses transparent, configurable heuristics. It does **not** train a machine-learning model and does not establish that a candidate is a planet or a new object. Scores are triage priorities only. Confirmation requires validated observations, known-object cross-matching, appropriate statistical tests, and expert review.

## Data integrity
- Demo records are synthetic and labelled as such.
- No API keys or credentials are required.
- Source provenance and uncertainty must be retained for any imported observation.
- Never describe a candidate as a confirmed discovery without independent evidence.

## Roadmap / release gate
1. Pass unit tests and review scoring behavior.
2. Add a real public dataset adapter with citations, caching and failure handling.
3. Validate against labelled positives and negatives; report precision, recall and false-positive rate.
4. Only then consider a model-based anomaly detector.

## License
No license is granted by this initial scaffold. Add an explicit license before external redistribution.
