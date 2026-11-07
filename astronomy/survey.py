"""Run one shared transit search over explicit public MAST products."""
import argparse
import hashlib
import json
import platform
from dataclasses import asdict
from pathlib import Path
from urllib.parse import urlencode

import astropy
import numpy
import scipy

from .archive import MAX_FILE, download, target_id, valid_uri
from .discovery import Settings
from .server import process


def survey(manifest, cache, settings):
    records = []
    for row in manifest["targets"]:
        target, uri = row["target"], row["uri"]
        target_id(target)
        if not valid_uri(uri):
            raise ValueError(f"Invalid product URI for {target}")
        filename = uri.rsplit("/", 1)[-1]
        expected_hash = row.get("sha256")
        try:
            path = cache / filename if cache else None
            if path and expected_hash and path.is_file():
                with path.open("rb") as stream:
                    data = stream.read(MAX_FILE + 1)
                selected = {"target": target, "uri": uri, "file": filename}
                url = "https://mast.stsci.edu/api/v0.1/Download/file?" + urlencode({"uri": uri})
            else:
                data, selected, url = download(target, uri)
            if len(data) > MAX_FILE or (expected_hash and hashlib.sha256(data).hexdigest() != expected_hash):
                raise ValueError("Public product exceeds the size limit or differs from the manifest SHA-256")
            if path and not path.exists():
                path.write_bytes(data)
            result = process(data, filename, selected, url, settings)
            result.pop("curve")
            reference = row.get("expected_period_days")
            control = None
            if reference:
                control = any(abs(c["period_days"] / reference - 1) <= .01 and
                              c["classification"] == "Known confirmed planet" for c in result["candidates"])
            records.append({**row, "status": "analyzed", "known_control_recovered": control, "result": result})
        except (ValueError, RuntimeError, OSError) as exc:
            records.append({**row, "status": "failed", "error": str(exc)})
    unmatched = [
        {"target": row["target"], "uri": row["uri"], "candidate": candidate}
        for row in records if row["status"] == "analyzed"
        for candidate in row["result"]["candidates"] if candidate["classification"] == "Unmatched transit-like signal"
    ]
    return {"purpose": manifest["purpose"], "settings": asdict(settings), "records": records,
            "versions": {"python": platform.python_version(), "astropy": astropy.__version__,
                         "numpy": numpy.__version__, "scipy": scipy.__version__},
            "unmatched": unmatched, "interpretation": "Unmatched signals require independent validation."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--min-period", type=float, default=.5)
    parser.add_argument("--max-period", type=float, default=5)
    args = parser.parse_args()
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)
    report = survey(json.loads(args.manifest.read_text()), args.cache,
                    Settings(minimum_period=args.min_period, maximum_period=args.max_period))
    print(json.dumps(report, allow_nan=False, indent=2))
    return int(any(row["status"] == "failed" for row in report["records"]))


if __name__ == "__main__":
    raise SystemExit(main())
