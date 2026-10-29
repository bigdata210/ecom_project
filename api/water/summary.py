"""GET /api/water/summary — item average for a day across the selected stations."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for candidate in (HERE, os.path.dirname(HERE)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from _shared import json_route  # noqa: E402
from _water import summary  # noqa: E402

handler = json_route(summary)
