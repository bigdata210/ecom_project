"""Shared helpers for the Vercel Python Functions. Standard library only.

Keeping these functions dependency-free keeps each serverless bundle small and
avoids the unzipped size limit that a pdfplumber/openpyxl worker would hit.
"""
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


class ApiError(Exception):
    """A failure that is safe to show the caller. Never carries upstream URLs."""

    def __init__(self, status, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def query(handler):
    return {key: values[0] for key, values in parse_qs(urlparse(handler.path).query).items()}


def respond(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'no-store')
    handler.end_headers()
    handler.wfile.write(body)


def json_route(produce):
    """Build a BaseHTTPRequestHandler that serves `produce(params)` as JSON."""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                respond(self, 200, produce(query(self)))
            except ApiError as error:
                respond(self, error.status, {'detail': error.detail})
            except Exception:
                # Upstream exceptions can contain the credential in a URL.
                respond(self, 500, {'detail': '요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.'})

        def log_message(self, *args):
            return

    return Handler
