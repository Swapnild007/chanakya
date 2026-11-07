"""Analyze a single observation and write a reproducible JSON report."""
import argparse
import json
from pathlib import Path

from .archive import MAX_FILE
from .discovery import Settings
from .server import process

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("observation", type=Path)
parser.add_argument("--min-period", type=float, default=.5)
parser.add_argument("--max-period", type=float, default=5)
parser.add_argument("--trend-days", type=float, default=2)
args = parser.parse_args()
try:
    with args.observation.open("rb") as stream:
        data = stream.read(MAX_FILE + 1)
    if len(data) > MAX_FILE:
        raise ValueError("Observation exceeds 25 MiB")
    report = process(data, args.observation.name,
                     settings=Settings(args.min_period, args.max_period, args.trend_days))
except (OSError, ValueError, RuntimeError) as exc:
    parser.exit(2, f"Analysis failed: {exc}\n")
print(json.dumps(report, allow_nan=False))
