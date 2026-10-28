import io
import json
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from weather_api import grid, observation

class WeatherTests(unittest.TestCase):
    def setUp(self):
        observation.cache_clear()

    def test_seoul_grid(self):
        self.assertEqual(grid(37.5665, 126.9780), (60, 127))

    @patch.dict('os.environ', {'data_api': ''})
    def test_missing_key(self):
        with self.assertRaises(HTTPException) as error:
            observation(60, 127, 2988000)
        self.assertEqual(error.exception.status_code, 503)

    @patch.dict('os.environ', {'data_api': 'test-only-secret%2B'})
    @patch('weather_api.urlopen')
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

    @patch.dict('os.environ', {'data_api': 'test-only-secret'})
    @patch('weather_api.urlopen', side_effect=ValueError('URL with test-only-secret'))
    def test_upstream_errors_do_not_leak_key(self, request):
        with self.assertRaises(HTTPException) as error:
            observation(60,127,2988000)
        self.assertNotIn('test-only-secret',error.exception.detail)

if __name__=='__main__':
    unittest.main()
