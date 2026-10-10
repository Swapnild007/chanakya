import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "prototype" / "data" / "sample_messages.json"
APP_PATH = ROOT / "prototype" / "app.js"
HTML_PATH = ROOT / "prototype" / "index.html"


def baseline_category(message):
    text = (message["subject"] + " " + message["body"] + " " + " ".join(message["labels"])).lower()
    # Mirror the conservative deterministic baseline in prototype/app.js.
    if any(s in text for s in ("ignore all prior instructions", "prompt_injection", "forward the entire inbox", "export the entire inbox")):
        return "needs_decision"
    if any(s in text for s in ("security", "unusual sign-in", "account")):
        return "act_now"
    if any(s in text for s in ("conflict", "conflicting", "blocked", "legal", "contract notice", "review requested", "authority is unknown")):
        return "needs_decision"
    if any(s in text for s in ("closes tomorrow", "in 30 minutes", "overrun", "approve vendor budget")):
        return "act_now"
    if any(s in text for s in ("routine invoice receipt", "receipt", "acknowledgement", "acknowledgment")):
        return "authorized_handling"
    if any(s in text for s in ("newsletter", "roundup", "no action", "no action is requested", "no direct request", "on track", "status update", "informational")):
        return "digest_later"
    if any(s in text for s in ("social", "engagement", "liked a post", "notification")):
        return "noise"
    return "needs_decision"


class CognitiveFirewallTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.messages = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    def test_dataset_is_valid_and_ids_unique(self):
        self.assertGreaterEqual(len(self.messages), 10)
        ids = [m["id"] for m in self.messages]
        self.assertEqual(len(ids), len(set(ids)))
        for m in self.messages:
            for field in ("id", "source", "sender", "subject", "body", "labels", "expectedCategory", "evidence", "nextStep"):
                self.assertIn(field, m, f"{m.get('id')} missing {field}")
            self.assertIn(m["expectedCategory"], {"act_now", "needs_decision", "authorized_handling", "digest_later", "noise"})

    def test_high_risk_examples_are_not_suppressed(self):
        by_id = {m["id"]: m for m in self.messages}
        for mid in ("msg-001", "msg-002", "msg-003", "msg-004", "msg-005", "msg-006", "msg-010", "msg-012"):
            self.assertNotIn(baseline_category(by_id[mid]), {"digest_later", "noise"}, mid)

    def test_inbound_prompt_injection_is_not_executed_or_suppressed(self):
        item = next(m for m in self.messages if m["id"] == "msg-005")
        self.assertEqual(baseline_category(item), "needs_decision")
        self.assertIn("untrusted", item["nextStep"].lower())

    def test_expected_categories_match_baseline_for_seed_set(self):
        # This is a regression check, not evidence of real-world accuracy.
        mismatches = [(m["id"], m["expectedCategory"], baseline_category(m)) for m in self.messages if m["expectedCategory"] != baseline_category(m)]
        self.assertEqual(mismatches, [], f"Seed-label mismatches: {mismatches}")

    def test_prototype_is_local_and_has_no_external_script_or_network_call(self):
        html = HTML_PATH.read_text(encoding="utf-8")
        js = APP_PATH.read_text(encoding="utf-8")
        self.assertIn('src="data.js"', html)
        self.assertIn('src="app.js"', html)
        self.assertNotRegex(html, r'<script[^>]+src=["\']https?://')
        self.assertNotRegex(js, r'\bfetch\s*\(')
        self.assertNotRegex(js, r'\bXMLHttpRequest\b')

    def test_safety_precedence_is_documented_in_classifier(self):
        js = APP_PATH.read_text(encoding="utf-8")
        self.assertIn("untrusted content", js)
        self.assertLess(js.index("ignore all prior instructions"), js.index("security|unusual sign-in"))

if __name__ == "__main__":
    unittest.main()
