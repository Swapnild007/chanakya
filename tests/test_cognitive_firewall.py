import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "prototype" / "data" / "sample_messages.json"
APP_PATH = ROOT / "prototype" / "app.js"
CLASSIFIER_PATH = ROOT / "prototype" / "classifier.js"
HTML_PATH = ROOT / "prototype" / "index.html"


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

    def test_prototype_is_local_and_has_no_external_script_or_network_call(self):
        html = HTML_PATH.read_text(encoding="utf-8")
        js = APP_PATH.read_text(encoding="utf-8")
        classifier = CLASSIFIER_PATH.read_text(encoding="utf-8")
        self.assertIn('src="data.js"', html)
        self.assertIn('src="classifier.js"', html)
        self.assertIn('src="app.js"', html)
        self.assertLess(html.index('src="classifier.js"'), html.index('src="app.js"'))
        self.assertNotIn('src="https://', html)
        self.assertNotRegex(js, re.compile(r"\bfetch\s*\("))
        self.assertNotRegex(js, re.compile(r"\bXMLHttpRequest\b"))
        self.assertNotRegex(classifier, re.compile(r"\bfetch\s*\("))
        self.assertNotRegex(classifier, re.compile(r"\bXMLHttpRequest\b"))

    def test_classifier_has_one_runtime_owner(self):
        app = APP_PATH.read_text(encoding="utf-8")
        classifier = CLASSIFIER_PATH.read_text(encoding="utf-8")
        self.assertIn("window.ChanakyaClassifier", app)
        self.assertIn("function classify(m)", classifier)
        self.assertNotIn("function classify(m)", app)
        self.assertNotRegex(Path(__file__).read_text(encoding="utf-8"), re.compile(r"^\\s*def\\s+baseline_category\\s*\\(", re.MULTILINE))


if __name__ == "__main__":
    unittest.main()
