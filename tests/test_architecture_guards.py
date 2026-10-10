import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_DATA = ROOT / "prototype" / "data" / "sample_messages.json"
BROWSER_BUNDLE = ROOT / "prototype" / "data.js"
ROOT_ENTRY = ROOT / "index.html"
COMMAND_CENTER_APP = ROOT / "apps" / "command-center" / "app.js"
FIREWALL_CLASSIFIER = ROOT / "prototype" / "classifier.js"


class ArchitectureGuardTests(unittest.TestCase):
    def test_browser_dataset_matches_canonical_json(self):
        canonical = json.loads(CANONICAL_DATA.read_text(encoding="utf-8"))
        bundle = BROWSER_BUNDLE.read_text(encoding="utf-8")
        match = re.search(r"window\.CHANAKYA_MESSAGES\s*=\s*(\[.*\]);\s*$", bundle, re.DOTALL)
        self.assertIsNotNone(match, "Browser data bundle must expose one JSON-compatible array")
        bundled = json.loads(match.group(1))
        self.assertEqual(bundled, canonical, "prototype/data.js has drifted from the canonical JSON fixture")

    def test_root_entry_points_to_single_command_center(self):
        html = ROOT_ENTRY.read_text(encoding="utf-8")
        self.assertIn("./apps/command-center/", html)
        self.assertNotIn("./prototype/", html)

    def test_command_center_does_not_duplicate_firewall_classifier(self):
        command_center = COMMAND_CENTER_APP.read_text(encoding="utf-8").lower()
        firewall = FIREWALL_CLASSIFIER.read_text(encoding="utf-8").lower()
        # The ecosystem shell may link to the product, but must not copy its classifier implementation.
        classifier_markers = ("function classify(", "const categories=", "expectedcategory", "prompt_injection")
        for marker in classifier_markers:
            self.assertNotIn(marker, command_center, f"Product logic marker duplicated in Command Center: {marker}")
        self.assertTrue(any(marker in firewall for marker in ("function classify(", "const categories=", "expectedcategory")))

    def test_command_center_and_firewall_are_distinct_owned_surfaces(self):
        command_html = (ROOT / "apps" / "command-center" / "index.html").read_text(encoding="utf-8")
        firewall_html = (ROOT / "prototype" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Chanakya AI · Command Center", command_html)
        self.assertIn("Cognitive Firewall", firewall_html)
        self.assertNotEqual(command_html, firewall_html)


if __name__ == "__main__":
    unittest.main()
