"""Bounded public archive queries and conservative ephemeris comparison."""
import json
import math
import re
import time
from functools import lru_cache
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

MAST = "https://mast.stsci.edu/api/v0"
TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
MAX_FILE = 25 * 1024 * 1024
MISSIONS = {"TIC": "TESS", "KIC": "Kepler", "EPIC": "K2"}
TARGET = re.compile(r"(TIC|KIC|EPIC) ([1-9][0-9]{0,11})", re.I)
URI = re.compile(r"mast:(?:TESS|Kepler|K2)/[\w./-]+\.fits", re.I | re.ASCII)


class ArchiveError(RuntimeError):
    pass


def request(url, payload=None, limit=4 * 1024 * 1024):
    query = Request(url, data=urlencode(payload).encode() if payload else None,
                    headers={"User-Agent": "AstroLens/1.0 research"})
    for attempt in range(2):
        try:
            deadline = time.monotonic() + 20
            with urlopen(query, timeout=8) as response:
                data = bytearray()
                while chunk := response.read1(64 * 1024):
                    data.extend(chunk)
                    if len(data) > limit or time.monotonic() > deadline:
                        raise ArchiveError("Archive response exceeded its size or time limit")
            return bytes(data)
        except (OSError, URLError) as exc:
            retryable = not isinstance(exc, HTTPError) or exc.code in (429, 500, 502, 503, 504)
            if not retryable or attempt:
                detail = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else type(exc).__name__
                raise ArchiveError(f"Public archive request failed ({detail})") from exc
            time.sleep(1)


def archive_json(*args, **kwargs):
    try:
        return json.loads(request(*args, **kwargs))
    except ValueError as exc:
        raise ArchiveError("Archive returned unreadable data") from exc


def mast(service, **params):
    result = archive_json(f"{MAST}/invoke", {"request": json.dumps({
        "service": service, "params": params, "format": "json", "pagesize": 200, "page": 1})})
    if not isinstance(result, dict) or result.get("status") != "COMPLETE" or not isinstance(result.get("data"), list):
        raise ArchiveError("MAST query did not complete")
    return result["data"]


def target_id(target):
    match = TARGET.fullmatch(target.strip())
    if not match:
        raise ValueError("Use a mission identifier such as TIC 261136679, KIC 11446443 or EPIC followed by digits")
    kind, number = match.groups()
    return kind.upper(), number


@lru_cache(maxsize=32)
def products(target):
    kind, number = target_id(target)
    mission = MISSIONS[kind]
    names = [number, f"{kind} {number}", f"{kind.lower()}{number}"]
    if kind == "KIC":
        names.append(f"kplr{int(number):09d}")
    if kind == "EPIC":
        names.append(f"ktwo{number}")
    observations = mast("Mast.Caom.Filtered", columns="obsid,target_name,sequence_number",
                        filters=[{"paramName": "obs_collection", "values": [mission]},
                                 {"paramName": "target_name", "values": names},
                                 {"paramName": "dataproduct_type", "values": ["timeseries"]}])
    if not observations:
        return []
    ids = ",".join(str(row["obsid"]) for row in observations[:20])
    rows = mast("Mast.Caom.Products", obsid=ids)
    return [{"uri": row["dataURI"], "file": row["productFilename"], "mission": mission,
             "target": f"{kind} {number}", "size": row.get("size")}
            for row in rows if row.get("productType") == "SCIENCE"
            and str(row.get("productFilename", "")).lower().endswith(("_lc.fits", "_llc.fits", "_slc.fits"))
            and valid_uri(row.get("dataURI", ""))][:40]


def valid_uri(uri):
    return isinstance(uri, str) and URI.fullmatch(uri) and ".." not in uri


def download(target, uri):
    selected = next((p for p in products(target) if p["uri"] == uri), None)
    if not selected:
        raise ValueError("Select a public product returned for this target")
    url = "https://mast.stsci.edu/api/v0.1/Download/file?" + urlencode({"uri": uri})
    return request(url, limit=MAX_FILE), selected, url


def tap(query):
    result = archive_json(TAP + "?" + urlencode({"query": query, "format": "json"}))
    if not isinstance(result, list) or len(result) >= 500 or not all(isinstance(r, dict) for r in result):
        raise ArchiveError("Catalogue response invalid or at the 500-row safety limit")
    return result


CONE_RADIUS = 10 / 3600


def coordinate_fallback(ra, dec):
    """Use numeric TAP predicates, then apply the exact spherical cone locally."""
    low, high = max(-90, dec - CONE_RADIUS), min(90, dec + CONE_RADIUS)
    radius = math.radians(CONE_RADIUS)
    cos_dec = math.cos(math.radians(dec))
    where = f"dec BETWEEN {low:.10f} AND {high:.10f}"
    if low > -90 and high < 90 and cos_dec > math.sin(radius):
        half = math.degrees(math.asin(math.sin(radius) / cos_dec))
        west, east = (ra - half) % 360, (ra + half) % 360
        if west <= east:
            where += f" AND ra BETWEEN {west:.10f} AND {east:.10f}"
        else:
            where += f" AND (ra >= {west:.10f} OR ra <= {east:.10f})"
    query = ("SELECT TOP 500 pl_name,pl_orbper,pl_tranmid,tic_id,ra,dec "
             f"FROM ps WHERE default_flag=1 AND {where}")
    def within(row):
        dra = math.radians(float(row["ra"]) - ra)
        ddec = math.radians(float(row["dec"]) - dec)
        hav = math.sin(ddec / 2) ** 2 + cos_dec * math.cos(math.radians(float(row["dec"]))) * math.sin(dra / 2) ** 2
        return hav <= math.sin(radius / 2) ** 2

    return query, [row for row in tap(query) if within(row)]


def catalogues(meta):
    if not meta.get("target"):
        return [], {"status": "unavailable", "reason": "FITS target identifier is missing"}
    kind, number = target_id(meta["target"])
    ra, dec = meta.get("ra"), meta.get("dec")
    ps_columns = "pl_name,pl_orbper,pl_tranmid,tic_id"
    queries = {}
    if kind == "TIC":
        queries["ps identifier"] = (f"SELECT TOP 500 {ps_columns} FROM ps "
                                    f"WHERE default_flag=1 AND tic_id='TIC {number}'")
    if (isinstance(ra, (int, float)) and isinstance(dec, (int, float))
            and 0 <= ra < 360 and -90 <= dec <= 90):
        queries["ps coordinates"] = (
            f"SELECT TOP 500 {ps_columns} FROM ps WHERE default_flag=1 AND "
            f"CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',{ra:.8f},{dec:.8f},0.00277778))=1")
    if kind == "TIC":
        queries["toi"] = ("SELECT TOP 500 toi,pl_orbper,pl_tranmid,tfopwg_disp FROM toi "
                          f"WHERE tid={number}")
    if kind == "KIC":
        queries["cumulative"] = ("SELECT TOP 500 kepoi_name,koi_period,koi_time0bk,koi_disposition "
                                 f"FROM cumulative WHERE kepid={number}")
    if kind == "EPIC":
        queries["k2pandc"] = ("SELECT TOP 500 pl_name,epic_candname,disposition,pl_orbper,pl_tranmid,pl_tsystemref "
                              f"FROM k2pandc WHERE epic_hostname='EPIC {number}' AND default_flag=1")
    rows, failures, fallbacks = [], {}, {}
    for table, query in list(queries.items()):
        try:
            try:
                response = tap(query)
            except ArchiveError as exc:
                if table != "ps coordinates":
                    raise
                fallbacks[table] = {"primary_error": str(exc), "method": "TAP bounding box and exact local cone"}
                query, response = coordinate_fallback(ra, dec)
                queries["ps coordinates fallback"] = query
            for row in response:
                if table.startswith("ps "):
                    rows.append({"id": row["pl_name"], "period": row["pl_orbper"], "epoch": row["pl_tranmid"],
                                 "type": "Known confirmed planet",
                                 "identity": row.get("tic_id") == f"{kind} {number}"})
                elif table == "toi":
                    rows.append({"id": f"TOI {row['toi']}", "period": row["pl_orbper"],
                                 "epoch": row["pl_tranmid"], "identity": True,
                                 "type": "Rejected or likely false positive" if row["tfopwg_disp"] in ("FP", "FA")
                                 else "Previously reported candidate"})
                elif table == "k2pandc":
                    rows.append({"id": row["pl_name"] or row["epic_candname"] or f"EPIC {number}",
                                 "period": row["pl_orbper"],
                                 "epoch": row["pl_tranmid"] if row["pl_tsystemref"] == "BJD-TDB" else None,
                                 "identity": True,
                                 "type": {"FALSE POSITIVE": "Rejected or likely false positive",
                                          "CONFIRMED": "Known confirmed planet"}.get(
                                     row["disposition"], "Previously reported candidate")})
                else:
                    epoch = row["koi_time0bk"]
                    rows.append({"id": row["kepoi_name"], "period": row["koi_period"],
                                 "epoch": epoch + 2454833 if epoch is not None else None, "identity": True,
                                 "type": {"FALSE POSITIVE": "Rejected or likely false positive",
                                          "CONFIRMED": "Known confirmed planet"}.get(
                                     row["koi_disposition"], "Previously reported candidate")})
        except (ArchiveError, ValueError, KeyError, TypeError) as exc:
            failures[table] = str(exc)
    if "ps coordinates" not in queries:
        failures["ps coordinates"] = "FITS target coordinates are missing"
    rows = list({(r["id"], r["period"], r["epoch"], r["type"]): r for r in rows}.values())
    return rows, {"status": "partial" if failures else "compared", "queries": queries, "failures": failures,
                  "fallbacks": fallbacks,
                  "queried_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def cross_match(result, rows, coverage):
    meta = result["observation"]
    reference = meta.get("bjd_reference")
    result["catalogue_coverage"] = {**coverage, "records_compared": rows}
    for candidate in result["candidates"]:
        matches = []
        period = candidate["period_days"]
        for row in rows:
            known = row["period"]
            if not isinstance(known, (int, float)) or not math.isfinite(known) or known <= 0:
                continue
            ratio = min((.5, 1, 2, 3, 1 / 3), key=lambda r: abs(period / (known * r) - 1))
            if abs(period / (known * ratio) - 1) > .01:
                continue
            epoch_delta = None
            if reference is not None and meta.get("time_system", "").upper() == "TDB" and row["epoch"] is not None:
                epoch_delta = abs((candidate["epoch_days"] + reference - row["epoch"] + known / 2) % known - known / 2)
            direct = (ratio == 1 and row["identity"] and epoch_delta is not None
                      and epoch_delta <= max(.05, candidate["duration_days"]))
            matches.append({**row, "ratio": ratio, "epoch_delta_days": epoch_delta,
                            "classification": row["type"] if direct else "Potentially matching known object"})
        candidate["catalogue_matches"] = matches
        vetting_status = candidate["classification"]
        candidate["vetting_status"] = vetting_status
        if vetting_status != "Transit-like signal — catalogue comparison pending":
            # Archive identity and this product's photometric vetting are distinct.
            # Preserve every warning even if a secure ephemeris identifies the known source.
            if vetting_status != "Insufficient evidence" and any(
                m["classification"] == "Known confirmed planet" for m in matches
            ):
                candidate["classification"] = "Known confirmed planet"
            continue
        order = ["Known confirmed planet", "Previously reported candidate",
                 "Rejected or likely false positive", "Potentially matching known object"]
        candidate["classification"] = next(
            (status for status in order if any(m["classification"] == status for m in matches)),
            "Unmatched transit-like signal" if coverage["status"] == "compared" else
            "Transit-like signal — catalogue comparison incomplete")
    candidates = result["candidates"]
    candidates.sort(key=lambda c: (c["classification"] in ("Insufficient evidence", "Rejected or likely false positive"),
                                   -c["observed_transits"], -c["snr"]))
    for rank, candidate in enumerate(candidates, 1):
        candidate["review_rank"] = rank
        candidate["ranking_basis"] = "Vetting status, supported transit count, then white-noise SNR"
    return result
