"""Acquire fixed public controls for independent timing and pixel review."""
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
from astropy.io import fits

from .archive import MAX_FILE, request
from .ephemeris import compare_observations
from .server import process

DOWNLOAD = "https://mast.stsci.edu/api/v0.1/Download/file?"
HAT_PREFIX = "mast:KEPLER/url/missions/kepler/lightcurves/0106/010666592/"
HAT_PRODUCTS = ((1, "kplr010666592-2009166043257_llc.fits"),
                (2, "kplr010666592-2009259160929_llc.fits"))
WASP12_PREFIX = "mast:TESS/product/tess2019357164649-s0020-0000000086396382-0165-s"
LIGHT_CURVE_HASHES = {
    HAT_PRODUCTS[0][1]: "37faa7dc82fa5d9ec6d794369d93def0d78a49c91e61cf19bb4cafe571bb8f6c",
    HAT_PRODUCTS[1][1]: "2a10ce0fa87e8a757e6d66a740669bcf94a704eecf0646bbf898ad91b402fc08",
    WASP12_PREFIX.rsplit("/", 1)[-1] + "_lc.fits": "bf74a16f6e0c40b693a66de922e142d446cb44cee5bb7f26843062e436957f63",
}
ROOT = Path(__file__).resolve().parent.parent


def get(uri, *, limit=MAX_FILE, deadline_seconds=20):
    url = DOWNLOAD + urlencode({"uri": uri})
    return request(url, limit=limit, deadline_seconds=deadline_seconds), url


def light_curve(uri, target, catalogue):
    data, url = get(uri)
    name = uri.rsplit("/", 1)[-1]
    if hashlib.sha256(data).hexdigest() != LIGHT_CURVE_HASHES[name]:
        raise ValueError("Public light curve differs from the pinned SHA-256")
    result = process(data, name, {"target": target, "uri": uri, "file": name}, url,
                     catalogue_snapshot=catalogue)
    del result["curve"]
    return result


def hat_comparison(catalogue):
    observations = []
    for quarter, name in HAT_PRODUCTS:
        result = light_curve(HAT_PREFIX + name, "KIC 10666592", catalogue)
        if result["observation"]["quarter"] != quarter:
            raise ValueError("Unexpected Kepler quarter")
        observations.append(result)
    return {"status": "analyzed", "products": [r["observation"] for r in observations],
            "comparison": compare_observations(*observations)}


def aperture_events(t, cube, aperture, period, epoch, duration):
    """Describe event differences for an aperture without a localization claim."""
    yy, xx = np.indices(aperture.shape)
    depth, dx, dy = [], [], []
    xcoord, ycoord = xx[aperture], yy[aperture]
    for cycle in range(int(np.ceil((t.min() - epoch) / period)), int(np.floor((t.max() - epoch) / period)) + 1):
        x = t - (epoch + cycle * period)
        inside = abs(x) < duration / 2
        left, right = (x > -1.5 * duration) & (x < -duration / 2), (x > duration / 2) & (x < 1.5 * duration)
        if min(inside.sum(), left.sum(), right.sum()) < 3:
            continue
        on = np.median(cube[inside][:, aperture], axis=0)
        off = (np.median(cube[left][:, aperture], axis=0) + np.median(cube[right][:, aperture], axis=0)) / 2
        if not np.all(np.isfinite(on) & np.isfinite(off)) or min(on.sum(), off.sum()) <= 0:
            continue
        on_weight, off_weight = np.maximum(on, 0), np.maximum(off, 0)
        shift = on_weight / on_weight.sum() - off_weight / off_weight.sum()
        depth.append(float(1 - on.sum() / off.sum()))
        dx.append(float(shift @ xcoord))
        dy.append(float(shift @ ycoord))
    return {"aperture_pixels": int(aperture.sum()), "events": len(depth),
            "median_fractional_depth": float(np.median(depth)) if depth else None,
            "median_centroid_shift_pixels": [float(np.median(dx)), float(np.median(dy))] if depth else None}


def wasp12_pixels(catalogue):
    light = light_curve(WASP12_PREFIX + "_lc.fits", "TIC 86396382", catalogue)
    candidate = next((c for c in light["candidates"] if c["classification"] == "Known confirmed planet"), None)
    if candidate is None:
        raise ValueError("WASP-12 b was not recovered in the light curve")
    uri = WASP12_PREFIX + "_tp.fits"
    # This fixed research product is larger than an interactive light-curve upload.
    data, url = get(uri, limit=48 * 1024 * 1024, deadline_seconds=90)
    digest = hashlib.sha256(data).hexdigest()
    if digest != "9ae97cb13270a84e2d20455612036e72a6ab0b359442c68d3b1927e4aef37687":
        raise ValueError("Public target-pixel product differs from the pinned SHA-256")
    with fits.open(io.BytesIO(data), memmap=False) as hdus:
        primary, table = hdus[0].header, hdus[1]
        if (primary.get("TICID"), primary.get("SECTOR")) != (86396382, 20):
            raise ValueError("Target-pixel identity mismatch")
        header = primary.copy()
        header.update(table.header)
        if header.get("TIMESYS") != "TDB" or str(header.get("TIMEUNIT", "")).lower() not in ("d", "day", "days"):
            raise ValueError("Unexpected pixel time system or unit")
        reference = float(header["BJDREFI"]) + float(header.get("BJDREFF", 0))
        time, cube = table.data["TIME"], table.data["FLUX"]
        aperture = np.asarray(hdus["APERTURE"].data, int)
        good = np.isfinite(time) & (table.data["QUALITY"] == 0)
        if good.sum() < 100 or cube.shape[1:] != aperture.shape:
            raise ValueError("Insufficient or inconsistent pixel data")
        epoch = candidate["epoch_days"] + (light["observation"]["bjd_reference"] - reference)
        subsets = {"optimal": (aperture & 2) != 0, "collected": (aperture & 1) != 0}
        results = {name: aperture_events(time[good], cube[good], mask,
                                         candidate["period_days"], epoch, candidate["duration_days"])
                   for name, mask in subsets.items() if mask.any()}
    return {"status": "analyzed" if any(r["events"] for r in results.values()) else "unavailable",
            "source_url": url, "sha256": digest,
            "light_curve_sha256": light["observation"]["sha256"], "apertures": results,
            "scope": "Same TESS sector and exposures. Descriptive aperture depths and flux-weighted centroids. "
                     "No PRF localization, uncertainty calibration or independent confirmation."}


def main():
    path = ROOT / "docs/validation/milestone4-catalogue-snapshot.json"
    catalogue = json.loads(path.read_text())
    results = {}
    for name, check in (("hat_p_7_kepler_quarters", hat_comparison), ("wasp_12_tess_pixels", wasp12_pixels)):
        try:
            results[name] = check(catalogue)
        except (ValueError, KeyError, OSError, RuntimeError) as exc:
            results[name] = {"status": "unavailable", "reason": str(exc)}
    print(json.dumps(results, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
