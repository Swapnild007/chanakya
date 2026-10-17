import unittest
from astronomy.transit_scan import detect_low_flux_events


class LowFluxEventTests(unittest.TestCase):
    def test_detects_a_two_point_dip(self):
        flux = [1.0] * 30
        flux[14:16] = [0.90, 0.89]
        result = detect_low_flux_events(range(30), flux)
        self.assertTrue(result)
        self.assertEqual(result[0].point_count, 2)
        self.assertEqual(result[0].start_time, 14.0)

    def test_rejects_too_few_samples(self):
        with self.assertRaises(ValueError):
            detect_low_flux_events(range(10), [1.0] * 10)

    def test_no_event_in_constant_curve(self):
        result = detect_low_flux_events(range(25), [1.0] * 25)
        self.assertEqual(result, [])

    def test_invalid_threshold_rejected(self):
        with self.assertRaises(ValueError):
            detect_low_flux_events(range(25), [1.0] * 25, sigma_threshold=0)


if __name__ == "__main__":
    unittest.main()
