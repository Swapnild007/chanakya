#!/usr/bin/env python3
"""Download the public SPOC TESS Sector 70 light curve for TIC 278892590."""
from __future__ import annotations
import argparse
from pathlib import Path
import sys

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("sector70_tic278892590.csv"))
    args = parser.parse_args()
    try:
        import lightkurve as lk
    except ImportError as exc:
        print(f"Missing Lightkurve dependency: {exc}", file=sys.stderr)
        return 2

    search = lk.search_lightcurve("TIC 278892590", mission="TESS", sector=70, author="SPOC")
    if len(search) == 0:
        raise RuntimeError("MAST returned no SPOC light curves for TIC 278892590, Sector 70.")
    # The supplied analysis CSV has approximately 120-second cadence. Select the
    # closest SPOC exposure explicitly so a 20-second fast product is not silently
    # substituted. Lightkurve reads the TESS PDCSAP flux column as `lc.flux`.
    import numpy as np
    import astropy.units as u
    exposures = np.array([float(v.to_value(u.s)) if hasattr(v, "to_value") else float(v) for v in search.table["exptime"]])
    idx = int(np.argmin(np.abs(exposures - 120.0)))
    chosen = search[idx]
    if abs(float(exposures[idx]) - 120.0) > 5.0:
        raise RuntimeError(f"No approximately 120-second SPOC product found. Available exposures: {exposures.tolist()}")
    lc = chosen.download(quality_bitmask="default")
    if lc is None or len(lc) < 100:
        raise RuntimeError("Downloaded SPOC light curve is empty or too short.")
    import pandas as pd
    t = np.asarray(lc.time.value, dtype=float)
    f = np.asarray(lc.flux.value, dtype=float)
    q = np.asarray(lc["quality"], dtype=np.int64) if "quality" in lc.colnames else np.zeros(len(t), dtype=np.int64)
    out = pd.DataFrame({"time": t, "flux": f, "quality": q})
    out = out.replace([np.inf, -np.inf], np.nan).dropna(subset=["time", "flux"])
    out = out.sort_values("time").drop_duplicates(subset=["time"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)
    import json
    meta_keys = ("TICID", "RA_OBJ", "DEC_OBJ", "CROWDSAP", "SECTOR", "CAMERA", "CCD", "AUTHOR", "ORIGIN", "DATE-OBS", "DATE-END")
    metadata = {k: str(lc.meta[k]) for k in meta_keys if k in lc.meta}
    args.output.with_suffix(".metadata.json").write_text(json.dumps({"search_result": str(chosen), "metadata": metadata}, indent=2) + "\\n", encoding="utf-8")
    print(f"MAST product: {chosen}")
    print(f"Rows written: {len(out)}")
    print(f"Output: {args.output}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
