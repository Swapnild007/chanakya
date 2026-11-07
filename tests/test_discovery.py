import os
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from astronomy.archive import ArchiveError, catalogues, cross_match, products
from astronomy.discovery import Settings, analyze, read_observation
from astronomy.server import process


def synthetic(period=2.37, eclipse=False):
    rng = np.random.default_rng(24)
    time = np.arange(0, 24, .02)
    flux = 1 + .002 * np.sin(time / 2) + rng.normal(0, .0007, len(time))
    if period:
        phase = ((time - .42) / period + .5) % 1 - .5
        flux[np.abs(phase) < .055 / period] -= .012
        if eclipse:
            flux[np.abs(np.abs(phase) - .5) < .055 / period] -= .007
    return time, flux


class DiscoveryTests(unittest.TestCase):
    settings = Settings(maximum_period=5, max_signals=1)

    def test_injected_period_recovery(self):
        for period in (1.19, 2.37, 3.58):
            with self.subTest(period=period):
                result = analyze(*synthetic(period), settings=self.settings)
                signal = result["candidates"][0]
                self.assertAlmostEqual(signal["period_days"], period, delta=.02)
                self.assertGreaterEqual(signal["observed_transits"], 5)
                self.assertGreater(signal["depth"], .007)
                self.assertEqual(signal["warnings"], [])

    def test_noise_only(self):
        self.assertEqual(analyze(*synthetic(None), settings=self.settings)["candidates"], [])

    def test_isolated_dip_does_not_pass_vetting(self):
        time, flux = synthetic(None)
        flux[200:207] -= .03
        report = analyze(time, flux, settings=self.settings)
        self.assertTrue(all(c["classification"] == "Insufficient evidence" for c in report["candidates"]))

    def test_eclipsing_binary_warning(self):
        signal = analyze(*synthetic(eclipse=True), settings=self.settings)["candidates"][0]
        self.assertEqual(signal["classification"], "Rejected or likely false positive")
        self.assertTrue(signal["warnings"])

    def test_quality_gaps_duplicates_and_invalid(self):
        time, flux = synthetic()
        quality = np.zeros_like(time)
        quality[300:350] = 1
        flux[10] = np.nan
        time[21] = time[20]
        audit = analyze(time, flux, quality, settings=self.settings)["preprocessing"]
        self.assertEqual(audit["quality_rejected"], 50)
        self.assertEqual(audit["gap_count"], 1)
        self.assertEqual(audit["invalid"], 1)
        self.assertEqual(audit["duplicates_removed"], 1)

    def test_bad_input(self):
        with self.assertRaisesRegex(ValueError, "time and flux"):
            read_observation(b"bad,data\n0,0", "corrupt.csv")
        with self.assertRaisesRegex(ValueError, "unique usable"):
            process(b"time,flux\n0,1", "short.csv")
        with self.assertRaisesRegex(ValueError, "Invalid analysis settings"):
            analyze(*synthetic(), settings=Settings(minimum_period=float("nan")))

    def test_cross_match_direct_and_alias(self):
        reference = 2457000
        result = analyze(*synthetic(), settings=self.settings,
                         metadata={"bjd_reference": reference, "time_system": "TDB"})
        confirmed = {"id": "test confirmed", "period": 2.37, "epoch": reference + .42,
                     "identity": True, "type": "Known confirmed planet"}
        alias = {**confirmed, "id": "test alias", "period": 2.37 * 2}
        signal = cross_match(result, [alias, confirmed], {"status": "compared"})["candidates"][0]
        self.assertEqual(signal["classification"], "Known confirmed planet")
        self.assertEqual(signal["catalogue_matches"][0]["classification"], "Potentially matching known object")

    def test_archive_failure_preserves_uncertain_classification(self):
        with patch("astronomy.archive.tap", side_effect=ArchiveError("archive unavailable")):
            rows, coverage = catalogues({"target": "TIC 123"})
        self.assertEqual(coverage["status"], "partial")
        result = cross_match(analyze(*synthetic(), settings=self.settings), rows, coverage)
        self.assertIn("comparison incomplete", result["candidates"][0]["classification"])

    def test_mast_failure_and_input_validation(self):
        with patch("astronomy.archive.mast", side_effect=ArchiveError("archive unavailable")):
            with self.assertRaises(ArchiveError):
                products("TIC 321")
        with self.assertRaises(ValueError):
            products("TIC 321'")

    def test_fits_roundtrip_and_corruption(self):
        try:
            from astropy.io import fits
        except ImportError:
            self.skipTest("Astropy is unavailable in this environment")
        from io import BytesIO
        time, flux = synthetic()
        primary = fits.PrimaryHDU()
        primary.header["TICID"] = 123
        table = fits.BinTableHDU.from_columns([
            fits.Column(name="TIME", format="D", array=time),
            fits.Column(name="PDCSAP_FLUX", format="D", array=flux),
            fits.Column(name="QUALITY", format="J", array=np.zeros(len(time), dtype=int)),
        ])
        table.header["BJDREFI"] = 2457000
        table.header["TIMESYS"] = "TDB"
        output = BytesIO()
        fits.HDUList([primary, table]).writeto(output)
        parsed = read_observation(output.getvalue(), "synthetic.fits")
        self.assertEqual(parsed[3]["target"], "TIC 123")
        self.assertAlmostEqual(analyze(*parsed, settings=self.settings)["candidates"][0]["period_days"], 2.37, delta=.02)
        with self.assertRaisesRegex(ValueError, "Invalid observation"):
            process(b"broken", "corrupt.fits")

    @unittest.skipUnless(os.getenv("ASTROLENS_WASP12_FITS"), "Optional real WASP-12 FITS fixture")
    def test_public_tess_observation(self):
        path = Path(os.environ["ASTROLENS_WASP12_FITS"])
        parsed = read_observation(path.read_bytes(), path.name)
        self.assertEqual(parsed[3]["target"], "TIC 86396382")
        report = analyze(*parsed, settings=Settings(maximum_period=3, max_signals=1))
        signal = report["candidates"][0]
        self.assertAlmostEqual(signal["period_days"], 1.09142, delta=.003)
        self.assertGreaterEqual(signal["observed_transits"], 15)
        self.assertEqual(signal["warnings"], [])

    def test_coordinate_403_fallback_keeps_only_exact_cone(self):
        near = {"pl_name": "near", "pl_orbper": 2.37, "pl_tranmid": 2457000.42,
                "tic_id": None, "ra": .0002, "dec": 0}
        corner = {**near, "pl_name": "box corner", "ra": .002, "dec": .0025}

        def catalogue_query(query):
            if "CONTAINS" in query:
                raise ArchiveError("HTTP 403")
            if "BETWEEN" in query:
                self.assertIn(" OR ra <=", query)
                return [near, corner]
            return []

        with patch("astronomy.archive.tap", side_effect=catalogue_query):
            rows, coverage = catalogues({"target": "TIC 123", "ra": 359.9999, "dec": 0.})
        self.assertEqual([r["id"] for r in rows], ["near"])
        self.assertEqual(coverage["status"], "compared")
        self.assertEqual(coverage["fallbacks"]["ps coordinates"]["primary_error"], "HTTP 403")

    def test_k2_mast_uses_pipeline_name(self):
        rows = [{"obsid": 12}]
        files = [{"productType": "SCIENCE", "productFilename": "ktwo206103150-c03_llc.fits",
                  "dataURI": "mast:K2/url/missions/k2/ktwo206103150-c03_llc.fits"}]
        products.cache_clear()
        try:
            with patch("astronomy.archive.mast", side_effect=[rows, files]) as query:
                result = products("EPIC 206103150")
            self.assertIn("ktwo206103150", query.call_args_list[0].kwargs["filters"][1]["values"])
            self.assertEqual(result[0]["target"], "EPIC 206103150")
        finally:
            products.cache_clear()

    def test_ephemeris_has_reference_cycle_and_positive_intervals(self):
        from astronomy.evaluate import case
        time, flux, quality, period, epoch = case(701, "injection", .008)
        result = analyze(time, flux, quality, settings=self.settings)["candidates"][0]
        fit = result["ephemeris"]
        self.assertEqual(fit["status"], "estimated")
        self.assertGreaterEqual(fit["timed_events"], 4)
        self.assertLess(fit["period_interval_days"][0], period)
        self.assertGreater(fit["period_interval_days"][1], period)
        self.assertAlmostEqual((fit["epoch_days"] - epoch) / period,
                               round((fit["epoch_days"] - epoch) / period), delta=.02)

    def test_off_phase_binary_and_correlated_noise(self):
        from astronomy.evaluate import trial
        self.assertFalse(trial(712, "asymmetric_eclipsing_binary", 0)["passed_vetting"])
        self.assertFalse(trial(713, "correlated_noise", 0)["passed_vetting"])
