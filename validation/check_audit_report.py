#!/usr/bin/env python3
"""Fail closed when the reference-analysis gates are not met."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("report", type=Path)
    a = p.parse_args()
    report = json.loads(a.report.read_text(encoding="utf-8"))
    errors = []
    cfg = report.get("configuration", {})
    null = report.get("empirical_max_power_null", {})
    lk = report.get("lightkurve_bls")
    agreement = report.get("peak_agreement")
    if int(cfg.get("null_runs", 0)) < 1000:
        errors.append("Fewer than 1000 null trials were completed.")
    if not report.get("input", {}).get("sha256"):
        errors.append("Input hash is missing.")
    if not report.get("astropy_bls", {}).get("period_days"):
        errors.append("Astropy BLS peak is missing.")
    if lk is None:
        errors.append("Lightkurve BLS did not produce an independent peak.")
    if not agreement or not agreement.get("within_one_grid_step", False):
        errors.append("Astropy and Lightkurve peak periods do not agree within one grid step.")
    if int(null.get("trials", 0)) < 1000:
        errors.append("Null calibration count in the report is below 1000.")
    if null.get("fap_add_one") is None:
        errors.append("Empirical null tail estimate is missing.")
    print(json.dumps({
        "reference_search_gate": "PASS" if not errors else "FAIL",
        "astropy_period_days": report.get("astropy_bls", {}).get("period_days"),
        "lightkurve_period_days": (lk or {}).get("period_days"),
        "peak_agreement": agreement,
        "null_trials": null.get("trials"),
        "empirical_tail_estimate": null.get("fap_add_one"),
        "errors": errors,
        "important_scope_limit": "Passing these checks validates only the independent reference-search audit. It does not confirm a planet or establish AstroLens full-pipeline FAP.",
    }, indent=2))
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
