import unittest
from copy import deepcopy

import numpy as np

from astronomy.discovery import analyze
from astronomy.ephemeris import compare_observations, project_epoch
from astronomy.observation_validation import aperture_events
from test_discovery import synthetic


class ObservationVettingTests(unittest.TestCase):
    def test_coincident_background_veto_and_centroid_only_advisory(self):
        time, flux = synthetic()
        rng = np.random.default_rng(12)
        step = np.abs((time - .42 + 2.37 / 2) % 2.37 - 2.37 / 2) < .055
        witness = rng.normal(0, 1, len(time)) + 30 * step
        for column, expected in (("SAP_BKG", ["SAP_BKG"]), ("MOM_CENTR1", [])):
            signal = analyze(time, flux, ancillary={column: witness})["candidates"][0]
            evidence = signal["observation_vetting"]
            self.assertEqual(evidence["coincident_channels"], expected)
            self.assertTrue(evidence["channels"][column]["coincident"])
            self.assertEqual(bool(signal["warnings"]), bool(expected))
            self.assertEqual(evidence["pixel_evidence"], "unavailable")

    def test_missing_constant_and_misaligned_streams(self):
        time, flux = synthetic()
        signal = analyze(time, flux, ancillary={"SAP_BKG": np.ones(len(time))})["candidates"][0]
        evidence = signal["observation_vetting"]
        self.assertEqual(evidence["status"], "insufficiently validated")
        self.assertEqual(evidence["channels"]["SAP_BKG"]["measured_events"], 0)
        with self.assertRaisesRegex(ValueError, "must align"):
            analyze(time, flux, ancillary={"SAP_BKG": np.ones(10)})


class ObservationComparisonTests(unittest.TestCase):
    def test_disjoint_fit_comparison_and_reused_products(self):
        fit = {"status": "estimated", "timed_events": 8, "epoch_days": 10.,
               "period_days": 2., "epoch_interval_days": [9.99, 10.01],
               "period_interval_days": [1.999, 2.001], "epoch_period_covariance_days2": 0.}
        first = {"observation": {"target": "KIC 1", "bjd_reference": 2454833,
                                 "time_system": "TDB", "sha256": "a"},
                 "preprocessing": {"observed_time_range_days": [1., 20.]},
                 "candidates": [{"ephemeris": fit, "catalogue_matches": [
                     {"id": "planet", "classification": "Known confirmed planet"}]}]}
        second = deepcopy(first)
        self.assertEqual(compare_observations(first, second)["status"], "same product")
        second["observation"]["sha256"] = "b"
        self.assertEqual(compare_observations(first, second)["status"], "overlapping windows")
        second["observation"]["bjd_reference"] += 30
        result = compare_observations(first, second)
        self.assertEqual(result["status"], "compared")
        self.assertEqual(result["comparisons"][0]["epoch_difference_days"], 0)
        self.assertTrue(result["comparisons"][0]["epoch_intervals_overlap"])
        second["observation"]["bjd_reference"] += 10000
        self.assertEqual(compare_observations(first, second)["comparisons"][0]["cycle_pairing"], "ambiguous")

    def test_projection_carries_covariance(self):
        fit = {"timed_events": 8, "epoch_days": 10., "period_days": 2.,
               "epoch_interval_days": [9.99, 10.01], "period_interval_days": [1.999, 2.001],
               "epoch_period_covariance_days2": 0.000001}
        self.assertAlmostEqual(project_epoch(fit, 3)["epoch_days"], 16.)
        self.assertGreater(project_epoch(fit, 3)["half_width_days"], project_epoch(fit, -3)["half_width_days"])

class PixelSummaryTests(unittest.TestCase):
    def test_two_apertures_show_dilution_and_centroid_shift(self):
        time = np.arange(0, 10, .02)
        cube = np.full((len(time), 1, 2), 100.)
        inside = np.abs((time - .5 + 1) % 2 - 1) < .095
        cube[inside, 0, 0] = 90.
        central = aperture_events(time, cube, np.array([[True, False]]), 2., .5, .2)
        full = aperture_events(time, cube, np.array([[True, True]]), 2., .5, .2)
        self.assertEqual(central["events"], 5)
        self.assertAlmostEqual(central["median_fractional_depth"], .1)
        self.assertAlmostEqual(full["median_fractional_depth"], .05)
        self.assertGreater(full["median_centroid_shift_pixels"][0], 0)
