import unittest
from astronomy.candidate_engine import Observation, score_candidate


class CandidateEngineTests(unittest.TestCase):
    def test_high_quality_repeatable_signal_ranks_high(self):
        result = score_candidate(Observation("A1", "transit", 15, 1, 1, False))
        self.assertEqual(result.score, 100)
        self.assertEqual(result.priority, "high")

    def test_weak_signal_ranks_low(self):
        result = score_candidate(Observation("A2", "transient", 1, 0.2, 0.1, None))
        self.assertEqual(result.priority, "low")
        self.assertTrue(any("not been performed" in c for c in result.caveats))

    def test_known_match_reduces_score(self):
        base = score_candidate(Observation("A3", "stellar_variability", 12, .8, .8, False))
        matched = score_candidate(Observation("A3", "stellar_variability", 12, .8, .8, True))
        self.assertEqual(base.score - matched.score, 25)

    def test_invalid_quality_rejected(self):
        with self.assertRaises(ValueError):
            score_candidate(Observation("A4", "transit", 10, 1.2, .5, None))

    def test_negative_snr_rejected(self):
        with self.assertRaises(ValueError):
            score_candidate(Observation("A5", "other", -1, .5, .5, None))

    def test_unknown_type_rejected(self):
        with self.assertRaises(ValueError):
            score_candidate(Observation("A6", "alien", 1, .5, .5, None))

    def test_empty_id_rejected(self):
        with self.assertRaises(ValueError):
            score_candidate(Observation(" ", "other", 1, .5, .5, None))


if __name__ == "__main__":
    unittest.main()
