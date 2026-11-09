import unittest

from astronomy.ephemeris import estimate


class EphemerisTests(unittest.TestCase):
    def test_coverage_limited_event_cannot_supply_fourth_timing(self):
        candidate = {"period_days": 2., "epoch_days": 1.}
        events = [
            {"cycle": cycle, "two_sided_coverage": True,
             "timing_days": 1. + 2. * cycle, "timing_error_days": .01}
            for cycle in range(4)
        ]
        events[3]["two_sided_coverage"] = False
        evidence = {"events": events}
        self.assertEqual(estimate(candidate, evidence)["status"], "unavailable")
        events.append({"cycle": 4, "two_sided_coverage": True,
                       "timing_days": 9., "timing_error_days": .01})
        fit = estimate(candidate, evidence)
        self.assertEqual(fit["status"], "estimated")
        self.assertEqual(fit["timed_events"], 4)
        self.assertAlmostEqual(fit["period_days"], 2.)
