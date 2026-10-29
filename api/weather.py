"""GET /api/weather?lat&lon — current KMA observation near a coordinate."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _kma import current  # noqa: E402
from _shared import json_route  # noqa: E402

handler = json_route(current)
