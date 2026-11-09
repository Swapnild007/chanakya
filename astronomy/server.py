"""Same-origin AstroLens workstation and bounded analysis API."""
import argparse
import json
import logging
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore
from urllib.parse import parse_qs, urlsplit

from .archive import MAX_FILE, ArchiveError, catalogues, cross_match, download, products
from .discovery import Settings, analyze, read_observation

ROOT = Path(__file__).resolve().parent.parent
SLOTS = BoundedSemaphore(2)


def process(data, filename, selected=None, url=None, settings=Settings(), *, catalogue_snapshot=None):
    ancillary = {}
    try:
        time, flux, quality, meta = read_observation(data, filename, ancillary=ancillary)
    except ImportError as exc:
        raise ArchiveError("FITS analysis requires Astropy. Install requirements.txt.") from exc
    except (OSError, ValueError, TypeError, IndexError) as exc:
        raise ValueError(f"Invalid observation: {exc}") from exc
    if selected:
        if meta["target"] != selected["target"]:
            raise ValueError("FITS target does not agree with the selected archive target")
        meta.update(provenance="NASA MAST", source_url=url, product=selected)
    result = analyze(time, flux, quality, meta, settings, ancillary=ancillary)
    if not result["candidates"]:
        return cross_match(result, [], {"status": "not needed", "reason": "No candidate to compare"})
    if catalogue_snapshot is None:
        rows, coverage = catalogues(meta)
    else:
        coverage = catalogue_snapshot.get(meta["target"])
        if coverage is None:
            raise ValueError("Target is absent from the catalogue snapshot")
        rows = coverage["records_compared"]
    return cross_match(result, rows, coverage)


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def reply(self, status, data, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def json(self, status, value):
        self.reply(status, json.dumps(value, allow_nan=False).encode(), "application/json")

    def do_GET(self):
        route = urlsplit(self.path)
        if route.path == "/api/health":
            self.json(200, {"analysis": "available"})
            return
        if route.path == "/api/products":
            self.run_api(lambda: {"products": products(parse_qs(route.query).get("target", [""])[0])})
            return
        name = route.path.lstrip("/") or "index.html"
        # Only serve top-level public UI files. Keep Python, git and tests private.
        types = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8"}
        path = ROOT / name
        if "/" in name or name.startswith(".") or path.suffix not in types or not path.is_file():
            self.json(404, {"error": "Resource not found"})
            return
        self.reply(200, path.read_bytes(), types[path.suffix])

    def do_POST(self):
        route = urlsplit(self.path)
        if route.path != "/api/analyze":
            self.json(404, {"error": "Resource not found"})
            return
        if (origin := self.headers.get("Origin")) and urlsplit(origin).netloc != self.headers.get("Host"):
            self.json(403, {"error": "Use the same origin as the AstroLens server"})
            return
        self.run_api(lambda: self.analyze_request(parse_qs(route.query)))

    def analyze_request(self, query):
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= MAX_FILE:
            raise ValueError("Observation must be between 1 byte and 25 MiB")
        body = self.rfile.read(length)
        if len(body) != length:
            raise ValueError("Incomplete request body")
        def option(name, default):
            return float(query.get(name, [default])[0])
        settings = Settings(minimum_period=option("minimum_period", .5),
                            maximum_period=option("maximum_period", 5),
                            trend_days=option("trend_days", 2))
        if self.headers.get_content_type() == "application/json":
            options = json.loads(body)
            if not isinstance(options, dict) or not all(isinstance(options.get(k), str) for k in ("target", "uri")):
                raise ValueError("Select a target and archive product")
            data, selected, url = download(options["target"], options["uri"])
            return process(data, selected["file"], selected, url, settings)
        filename = query.get("filename", [""])[0]
        return process(body, filename, settings=settings)

    def run_api(self, action):
        if not SLOTS.acquire(blocking=False):
            self.json(503, {"error": "Analysis slots are busy. Try again shortly."})
            return
        try:
            self.json(200, action())
        except (ValueError, UnicodeError) as exc:
            self.json(400, {"error": str(exc)})
        except (ArchiveError, socket.timeout) as exc:
            self.json(502, {"error": str(exc)})
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            logging.exception("AstroLens request failed")
            self.json(500, {"error": "Analysis failed. Consult the server log."})
        finally:
            SLOTS.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), Handler) as server:
        print(f"AstroLens listening at http://{args.host}:{args.port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
