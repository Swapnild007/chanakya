# AstroLens: Astronomy Candidate Research

AstroLens is an evidence-first research workspace for exploring astronomical candidates. It currently combines a live NASA Exoplanet Archive TOI catalogue loader, a browser-local light-curve outlier scanner, and a transparent Python candidate triage function.

## Current capabilities
- **Live catalogue query:** requests up to 100 rows from the NASA Exoplanet Archive TAP `toi` table. TOIs are existing catalogue candidates, not new discoveries. The dashboard's score reflects metadata completeness only.
- **Local light-curve scan:** choose a CSV with time and flux/brightness columns. The browser flags groups of at least two low-flux points below median minus three scaled median absolute deviations (MAD). The file stays in the browser and is not uploaded.
- **Python candidate scoring:** transparent heuristic for triage, not a calibrated probability or machine-learning model.
- Responsive dashboard, candidate detail panels, search, filters, test suite, and CI.

## Run
Requires Python 3.10+.

```bash
python -m unittest discover -s tests -v
python -m http.server 8000
```
Open http://localhost:8000. Live catalogue loading requires an internet connection and browser access to the NASA TAP endpoint. If the browser blocks cross-origin requests, use the NASA TAP link below or add a small server-side proxy; never label failed retrieval as live data.

## NASA data sources
- [NASA Exoplanet Archive TAP documentation](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html)
- [NASA Exoplanet Archive TOI catalogue](https://exoplanetarchive.ipac.caltech.edu/overview/TOI)
- [MAST API documentation](https://mast.stsci.edu/api/v0/)
- [Exo.MAST light-curve web services](https://exo.mast.stsci.edu/docs/)

## Scientific limits
The current browser scanner is an outlier detector, not a periodic transit search. Stellar variability, cosmic rays, gaps, detrending artifacts, eclipsing binaries, and instrumental effects can create false positives. The live TOI catalogue is not a blind discovery feed. Genuine discovery work next requires FITS light-curve ingestion, robust detrending, a periodic transit-search algorithm (e.g. box least squares), known-object cross-matching, and evaluation against labelled public observations.

Do not describe any candidate as a confirmed planet, star, or new discovery without appropriate independent validation.

## Tests
`python -m unittest discover -s tests -v`

## License
No license is granted by this initial scaffold. Add an explicit license before external redistribution.
