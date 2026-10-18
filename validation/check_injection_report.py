#!/usr/bin/env python3
"""Validate injection/recovery report completeness without inventing a pass."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("report", type=Path)
    args = p.parse_args()
    r = json.loads(args.report.read_text(encoding="utf-8"))
    errors = []
    control = r.get("noiseless_high_depth_control", {})
    if control.get("passed") is not True:
        errors.append("Noiseless high-depth control did not recover under the fixed rule.")
    curve = r.get("recovery_curve", [])
    if len(curve) < 3:
        errors.append("Recovery curve must include at least three injection depths.")
    for item in curve:
        if int(item.get("trials", 0)) < 1:
            errors.append(f"No trials reported at depth {item.get('injected_depth_ppm')} ppm.")
        ci = item.get("wilson95_interval")
        if not isinstance(ci, list) or len(ci) != 2:
            errors.append(f"Missing Wilson interval at depth {item.get('injected_depth_ppm')} ppm.")
        elif not (0 <= ci[0] <= ci[1] <= 1):
            errors.append(f"Invalid Wilson interval at depth {item.get('injected_depth_ppm')} ppm.")
    print(json.dumps({
        "injection_report_gate": "PASS" if not errors else "FAIL",
        "noiseless_control_passed": control.get("passed"),
        "depths_ppm": [x.get("injected_depth_ppm") for x in curve],
        "trials_per_depth": [x.get("trials") for x in curve],
        "errors": errors,
        "scope_limit": "Recovery estimates characterize the declared injection model and reference search only; they are not planet probabilities.",
    }, indent=2))
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
