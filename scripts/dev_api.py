"""Serve the api/ Python Functions locally, the way Vercel routes them.

`next dev` does not run the Python runtime, so run this alongside it and let
next.config.mjs proxy /api/* here. Production routing is Vercel's; this script
only mirrors it for development.

    python scripts/dev_api.py          # http://127.0.0.1:8000
"""
import importlib.util
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

API = Path(__file__).resolve().parent.parent / 'api'
sys.path.insert(0, str(API))


def load_routes():
    """Map every api/**/*.py that is not private to its request path."""
    routes = {}
    for path in sorted(API.rglob('*.py')):
        relative = path.relative_to(API)
        if any(part.startswith('_') for part in relative.parts):
            continue
        spec = importlib.util.spec_from_file_location(
            'api_' + '_'.join(relative.with_suffix('').parts), path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        routes['/api/' + relative.with_suffix('').as_posix()] = module.handler
    return routes


ROUTES = load_routes()


class Router(BaseHTTPRequestHandler):
    def do_GET(self):
        route = ROUTES.get(urlparse(self.path).path)
        if route is None:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'{"detail":"not found"}')
            return
        # Reuse the function's own handler against this already-open connection.
        route.do_GET(self)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.path, args[1] if len(args) > 1 else ''))


if __name__ == '__main__':
    port = int(os.getenv('PORT', '8000'))
    print('routes: ' + ', '.join(sorted(ROUTES)))
    print(f'listening on http://127.0.0.1:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), Router).serve_forever()
