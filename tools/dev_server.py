"""Static test server, usage: python tools/dev_server.py 8069 [bind address]

Same as python -m http.server, with a longer accept queue: the default of 5
refuses connections on a cold load, when the page asks for dozens of files at once.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Server(ThreadingHTTPServer):
    request_queue_size = 128


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8069
bind = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
Server((bind, port), SimpleHTTPRequestHandler).serve_forever()
