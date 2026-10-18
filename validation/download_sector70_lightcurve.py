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
    # Prefer the exact sector/target and PDCSAP product; do not silently fall back
    # to another sector or author.
    chosen = search[0]
    lc = chosen.download(quality_bitmask="default")
    if lc is None or len(lc) < 100:
        raise RuntimeError("Downloaded SPOC light curve is empty or too short.")
    if "pdcsap_flux" not in (lc.colnames or []):
        raise RuntimeError(f"Downloaded product has no PDCSAP_FLUX column: {lc.colnames}")
    import numpy as np
    import pandas as pd
    t = np.asarray(lc.time.value, dtype=float)
    f = np.asarray(lc["pdcsap_flux"].value, dtype=float)
    q = np.asarray(lc["quality"], dtype=np.int64) if "quality" in lc.colnames else np.zeros(len(t), dtype=np.int64)
    out = pd.DataFrame({"time": t, "flux": f, "quality": q})
    out = out.replace([np.inf, -np.inf], np.nan).dropna(subset=["time", "flux"])
    out = out.sort_values("time").drop_duplicates(subset=["time"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)
    print(f"MAST product: {chosen}")
    print(f"Rows written: {len(out)}")
    print(f"Output: {args.output}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
