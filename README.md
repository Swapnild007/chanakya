# AstroLens · Transit Research

AstroLens screens measured stellar light curves for repeating transit-like signals. The workstation has six views for acquisition, photometry, investigation, catalogue filtering and reproducible session export. The original astronomy tools remain accessible at `classic.html`, including their separate browser-local CSV/FITS analysis and catalogue browsing.

## Run locally

Requires Python 3.10 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m astronomy.server
```

On Windows PowerShell activate with `.venv\Scripts\Activate.ps1`. Open http://127.0.0.1:8000. The default listener is local only. Static hosting can serve the classic tools and workstation shell, but the workstation analysis requires the same-origin Python service. The reference server is intended for local research. Public deployment needs a hardened application server or proxy with TLS, authentication as appropriate, request limits and access controls.

In **Planet Discovery**, search by TIC, KIC or EPIC identifier or upload a single FITS or CSV. CSV column names are `time,flux`, with optional `quality`. Time must be in days and the segment's median flux must be positive. FITS uses `TIME` plus `PDCSAP_FLUX`, `SAP_FLUX`, or `FLUX`. FITS without mission identity or time metadata can be screened with catalogue limitations. Uploads are sent to the configured AstroLens server and processed in memory. Saved reports are stored by the browser and can be exported as JSON.

Analyze independently of the browser:

```bash
python -m astronomy observation.fits --min-period 0.5 --max-period 5 > report.json
```

## Method

- NASA MAST discovery returns public light-curve products from a bounded set of matching observations. Search metadata is cached in-process. Archive calls have size/time limits and a bounded retry. Download requires a listed product and the FITS identifier must agree with the requested target.
- Preprocessing removes invalid and duplicate measurements, requires zero quality flags where present, splits on gaps of five median cadences, normalizes each segment, applies a gap-aware rolling median and clips positive outliers. Input SHA-256, settings, cadence counts and a robust noise estimate are exported.
- Astropy BoxLeastSquares searches a frequency grid constrained by baseline and cadence. It ranks transit-like dips by white-noise SNR and requires independently supported events before promoting a hypothesis. It masks the first candidate's window before a second pass.
- Odd/even depths, a phase-0.5 secondary check, per-event depth consistency and deep eclipses provide initial vetting. Review rank sorts by vetting status, supported event count and white-noise SNR.
- NASA Exoplanet Archive Planetary Systems, TOI and Kepler KOI queries compare applicable target identifiers and periods. Planetary Systems matches TIC identifiers and also searches a 10-arcsec cone when the FITS header provides coordinates. Period screening uses 1% tolerance, with half, double and third harmonics flagged separately. Direct matches require target identity and phase agreement within the larger of 0.05 days or the fitted transit duration, using compatible BJD/TDB metadata. Missing, partial and failed comparisons are recorded explicitly. K2 candidate catalogue coverage is incomplete.

## Scientific limits

The pipeline screens one product at a time. A white-noise SNR is a ranking diagnostic. Time-correlated variability, residual systematics, sparse coverage, nearby binaries, period aliases and detrending can affect results. Period and epoch uncertainties are uncalibrated. Pixel-level vetting, transit timing variations, multi-sector stitching and independent follow-up remain outside this release. Candidate catalogue coverage is incomplete even when the configured queries succeed. The workstation uses **Unmatched transit-like signal** for that result and reserves discovery claims for independently validated work.

## Verification

```bash
python -m unittest discover -s tests -v
node --test tests/*.test.js
npm install --no-save playwright
npx playwright install chromium
# Start the Python server on port 8765 in a separate terminal.
node tests/workstation.browser.cjs
```

Synthetic cases cover injected periods, noise, isolated dips and eclipses. Tests also cover catalogue classifications, unavailable sources, malformed observations, quality filtering and FITS round-trip parsing. Synthetic cases measure fixture recovery only.

For a real-data smoke test, use TIC 86396382, the WASP-12 system. The MAST Sector 20 SPOC light curve is `tess2019357164649-s0020-0000000086396382-0165-s_lc.fits`. Retrieve it from the [MAST product endpoint](https://mast.stsci.edu/api/v0.1/Download/file?uri=mast%3ATESS%2Fproduct%2Ftess2019357164649-s0020-0000000086396382-0165-s_lc.fits) and compare the recovered period to the [NASA WASP-12 ephemeris](https://exoplanetarchive.ipac.caltech.edu/overview/WASP-12). To include this file in the regression suite, set `ASTROLENS_WASP12_FITS` to its local path before running the Python tests. Record the exact input hash, recovered parameters, classification and API availability for live verification. Live archives require outbound HTTPS and may be slow or unavailable.

Archive references are the [MAST API](https://mast.stsci.edu/api/v0/), [TESS archive guide](https://heasarc.gsfc.nasa.gov/docs/tess/TSC2-Intro.html), and [NASA TAP documentation](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html).

## License

The repository has no explicit software license.
