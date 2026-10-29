import io
import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'api'))

from _kma import grid, observation  # noqa: E402
from _shared import ApiError  # noqa: E402

class WeatherTests(unittest.TestCase):
    def setUp(self):
        observation.cache_clear()

    def test_seoul_grid(self):
        self.assertEqual(grid(37.5665, 126.9780), (60, 127))

    @patch.dict('os.environ', {'data_api_key': ''})
    def test_missing_key(self):
        with self.assertRaises(ApiError) as error:
            observation(60, 127, 2988000)
        self.assertEqual(error.exception.status, 503)

    @patch.dict('os.environ', {'data_api_key': 'test-only-secret%2B'})
    @patch('_kma.urlopen')
    def test_values_and_cache(self, request):
        items=[dict(category=c, obsrValue=v, baseDate='20261028', baseTime='1300')
               for c,v in [('T1H','21.5'),('REH','58'),('WSD','2.1'),('RN1','0')]]
        request.return_value=io.BytesIO(json.dumps({'response':{'header':{'resultCode':'00'},
            'body':{'items':{'item':items}}}}).encode())
        result=observation(60,127,2988000)
        self.assertEqual(result['temperature'],21.5)
        self.assertEqual(result['precipitation'],0)
        self.assertIsNone(result['precipitationType'])
        self.assertNotIn('secret',json.dumps(result))
        observation(60,127,2988000)
        self.assertEqual(request.call_count,1)
        self.assertIn('serviceKey=test-only-secret%2B',request.call_args.args[0])

    @patch.dict('os.environ', {'data_api_key': 'test-only-secret'})
    @patch('_kma.urlopen', side_effect=ValueError('URL with test-only-secret'))
    def test_upstream_errors_do_not_leak_key(self, request):
        with self.assertRaises(ApiError) as error:
            observation(60,127,2988000)
        self.assertNotIn('test-only-secret',error.exception.detail)

if __name__=='__main__':
    unittest.main()
