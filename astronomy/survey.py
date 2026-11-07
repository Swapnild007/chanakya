"""Run one shared transit search over explicit public MAST products."""
import argparse
import hashlib
import json
import platform
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from urllib.parse import urlencode

import astropy
import numpy
import scipy

from .archive import MAX_FILE, download, request, target_id, valid_uri
from .discovery import Settings, preprocess, read_observation
from .ephemeris import estimate
from .server import process


def external_timing_comparisons(result):
    """Compare a catalogue point ephemeris with the observed conditional fit."""
    reference = result["observation"].get("bjd_reference")
    if reference is None or result["observation"].get("time_system") != "TDB":
        return []
    comparisons = []
    for candidate in result["candidates"]:
        fit = candidate["ephemeris"]
        if fit["status"] != "estimated":
            continue
        epoch = reference + fit["epoch_days"]
        for match in candidate["catalogue_matches"]:
            if match["classification"] != "Known confirmed planet" or match["epoch_delta_days"] is None:
                continue
            cycle = round((epoch - match["epoch"]) / match["period"])
            predicted = match["epoch"] + cycle * match["period"]
            low, high = fit["epoch_interval_days"]
            p_low, p_high = fit["period_interval_days"]
            comparisons.append({"catalogue_id": match["id"], "catalogue_period_days": match["period"],
                                "catalogue_epoch_bjd_tdb": match["epoch"], "catalogue_cycle_offset": cycle,
                                "propagated_catalogue_epoch_bjd_tdb": predicted,
                                "period_difference_days": fit["period_days"] - match["period"],
                                "epoch_difference_days": epoch - predicted,
                                "catalogue_period_in_nominal_interval": p_low <= match["period"] <= p_high,
                                "catalogue_epoch_in_nominal_interval": reference + low <= predicted <= reference + high,
                                "interpretation": "Point-reference agreement only. Catalogue uncertainty, covariance, TTVs and shared data are not accounted for."})
    return comparisons


def disjoint_timing_check(data, filename, result, settings):
    """Fit disjoint cadence halves in an already identified period family."""
    comparisons = result["candidates"]
    timing = next(((candidate, match) for candidate in comparisons if candidate["ephemeris"]["status"] == "estimated"
                   for match in candidate["catalogue_matches"]
                   if match["classification"] == "Known confirmed planet" and match["epoch_delta_days"] is not None), None)
    if timing is None:
        return {"status": "unavailable", "reason": "No vetted catalogue-matched ephemeris"}
    candidate, match = timing
    time, flux, quality, meta = read_observation(data, filename)
    finite = time[numpy.isfinite(time)]
    midpoint = (finite.min() + finite.max()) / 2
    period = match["period"]
    reference = match["epoch"] - meta["bjd_reference"]
    epoch = reference + round((midpoint - reference) / period) * period
    halves = []
    for mask in (time < midpoint, time >= midpoint):
        try:
            t, _, y, audit = preprocess(time[mask], flux[mask], quality[mask] if quality is not None else None, settings)
        except ValueError as exc:
            halves.append({"status": "unavailable", "reason": str(exc)})
            continue
        cycles = range(int(numpy.ceil((t[0] - epoch) / period)), int(numpy.floor((t[-1] - epoch) / period)) + 1)
        fit = estimate(t, y, {"period_days": period, "epoch_days": epoch,
                             "duration_days": candidate["duration_days"], "event_cycles": cycles}, audit)
        if fit["status"] == "estimated":
            offset = fit["reference_cycle"]
            fit["epoch_at_common_cycle_days"] = fit["epoch_days"] - offset * fit["period_days"]
        halves.append(fit)
    ok = all(half["status"] == "estimated" for half in halves)
    return {"status": "compared" if ok else "partial", "catalogue_id": match["id"], "split_observation_days": float(midpoint),
            "common_catalogue_epoch_days": float(epoch), "halves": halves,
            "period_difference_days": halves[1]["period_days"] - halves[0]["period_days"] if ok else None,
            "epoch_difference_days": halves[1]["epoch_at_common_cycle_days"] - halves[0]["epoch_at_common_cycle_days"] if ok else None,
            "interpretation": "Disjoint cadences and independent preprocessing. Catalogue period family and full-product duration are shared. This tests agreement, not coverage."}


def examine_unmatched(candidate):
    events = candidate["instrumental_vetting"]["events"]
    # The halves are defined by observed cycle number, not by strongest dip.
    midpoint = (events[0]["cycle"] + events[-1]["cycle"]) / 2 if events else 0
    halves = [[row for row in events if (row["cycle"] <= midpoint) == early] for early in (True, False)]
    return {"halves": [{"supported": len(half), "two_sided": sum(r["two_sided_coverage"] for r in half),
                        "flagged_cadences": sum(r["flagged_cadences"] for r in half)} for half in halves],
            "nearby_catalogue_harmonics": candidate["catalogue_matches"],
            "disposition": "Requires independent observations and pixel-level vetting"}


def analyze_target(row, cache, settings):
    target, uri = row["target"], row.get("uri")
    target_id(target)
    if not valid_uri(uri):
        return {**row, "status": "failed", "error": row.get("selection_error", "Invalid MAST product URI")}
    filename = uri.rsplit("/", 1)[-1]
    expected_hash = row.get("sha256")
    try:
        path = cache / filename if cache else None
        if expected_hash:
            url = "https://mast.stsci.edu/api/v0.1/Download/file?" + urlencode({"uri": uri})
            selected = {"target": target, "uri": uri, "file": filename}
            if path and path.is_file():
                with path.open("rb") as stream:
                    data = stream.read(MAX_FILE + 1)
            else:
                data = request(url, limit=MAX_FILE)
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
        return {**row, "status": "analyzed", "known_control_recovered": control,
                "external_timing_comparisons": external_timing_comparisons(result),
                "disjoint_timing_check": disjoint_timing_check(data, filename, result, settings), "result": result}
    except (ValueError, RuntimeError, OSError) as exc:
        return {**row, "status": "failed", "error": str(exc)}


def survey(manifest, cache, settings, workers=1):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        records = list(pool.map(lambda row: analyze_target(row, cache, settings), manifest["targets"]))
    unmatched = [
        {"target": row["target"], "uri": row["uri"], "candidate": candidate,
         "investigation": examine_unmatched(candidate)}
        for row in records if row["status"] == "analyzed"
        for candidate in row["result"]["candidates"] if candidate["classification"] == "Unmatched transit-like signal"
    ]
    analyzed = [row for row in records if row["status"] == "analyzed"]
    categories = {"matched": {"Known confirmed planet", "Previously reported candidate"},
                  "unmatched": {"Unmatched transit-like signal"},
                  "rejected": {"Insufficient evidence", "Rejected or likely false positive"}}
    counts = {key: sum(any(c["classification"] in values for c in row["result"]["candidates"])
                       for row in analyzed) for key, values in categories.items()}
    counts["photometry_flagged"] = sum(any(c["warnings"] for c in row["result"]["candidates"]) for row in analyzed)
    counts["no_signal"] = sum(not row["result"]["candidates"] for row in analyzed)
    return {"purpose": manifest["purpose"], "selection": manifest.get("selection"),
            "target_counts": {"attempted": len(records), "analyzed": len(analyzed),
                              "failed": len(records) - len(analyzed), **counts},
            "settings": asdict(settings), "records": records,
            "versions": {"python": platform.python_version(), "astropy": astropy.__version__,
                         "numpy": numpy.__version__, "scipy": scipy.__version__},
            "unmatched": unmatched, "interpretation": "Unmatched signals require independent validation."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--min-period", type=float, default=.5)
    parser.add_argument("--max-period", type=float, default=5)
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    args = parser.parse_args()
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)
    report = survey(json.loads(args.manifest.read_text()), args.cache,
                    Settings(minimum_period=args.min_period, maximum_period=args.max_period), args.workers)
    print(json.dumps(report, allow_nan=False, indent=2))
    return int(any(row["status"] == "failed" for row in report["records"]))


if __name__ == "__main__":
    raise SystemExit(main())
