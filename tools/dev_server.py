"""Static test server, usage: python tools/dev_server.py 8069 [bind address]

Same as python -m http.server, with a longer accept queue: the default of 5
refuses connections on a cold load, when the page asks for dozens of files at once.

/status.json is written by the CheckMK puller in production. Here it comes from
tools/status.test.json, stamped with the current time so the page reads it as live.
"""
import json
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

STATUS = Path(__file__).with_name("status.test.json")


class Server(ThreadingHTTPServer):
    request_queue_size = 128


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path != "/status.json":
            return super().do_GET()
        feed = json.loads(STATUS.read_text("utf8"))
        feed["ts"] = int(time.time())
        body = json.dumps(feed).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8069
bind = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
Server((bind, port), Handler).serve_forever()
