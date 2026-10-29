import io
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'api'))

from _shared import ApiError  # noqa: E402
from _water import aggregate, catalog, fetch_records, numeric, summary  # noqa: E402

STATIONS = [dict(id='S01001', name='가평', province='경기도', district='가평군', basin='한강', address=''),
            dict(id='S01002', name='흥천', province='경기도', district='여주시', basin='한강', address='')]

def row(site, stamp, value):
    return dict(siteId=site, msrDate=stamp, m05=value)

def xml(items, total):
    return ('<response><header><resultCode>00</resultCode></header><body><items>'+''.join(
        '<item>'+''.join(f'<{k}>{v}</{k}>' for k,v in r.items())+'</item>' for r in items)+
        f'</items><totalCount>{total}</totalCount></body></response>').encode()

class WaterTests(unittest.TestCase):
    def setUp(self):
        fetch_records.cache_clear()

    def test_reference_integrity(self):
        c=catalog()
        self.assertEqual(len(c['stations']),71)
        self.assertEqual(len({s['id'] for s in c['stations']}),71)
        self.assertEqual(sum(bool(s['province']) for s in c['stations']),69)
        self.assertEqual(len(c['items']),44)
        self.assertEqual(next(i['unit'] for i in c['items'] if i['id']=='m77'),'µg/L')
        self.assertNotIn('water_api_key',str(c))

    def test_numeric_missing_and_zero(self):
        for value in [None,'','ND','불검출','<0.01','-999','NaN','inf','1,234']:
            self.assertIsNone(numeric(value))
        self.assertEqual(numeric('0'),0)
        self.assertEqual(numeric(0),0)
        self.assertEqual(numeric('1.2e-3'),.0012)

    def test_weighted_daily_average_and_exclusions(self):
        rows=[row('S01001','2026-07-20 10:00','0'),row('S01001','2026-07-20 11:00','4'),
              row('S01002','2026-07-20 10:00','8'),row('S01002','2026-07-20 11:00','-999'),
              row('S01002','2026-07-19 11:00','999'),row('OTHER','2026-07-20 11:00','999')]
        r=aggregate(rows,STATIONS,'m05','2026-07-20','daily')
        self.assertEqual(r['average'],4)
        self.assertEqual(r['validCount'],3)
        self.assertEqual(r['excludedCount'],1)
        self.assertEqual(r['outsideCount'],2)
        self.assertEqual(r['stations'][0]['average'],2)

    def test_latest_does_not_backfill_invalid_latest(self):
        rows=[row('S01001','2026-07-20 10:00','2'),row('S01001','2026-07-20 11:00','-999'),
              row('S01002','2026-07-20 11:00','8')]
        r=aggregate(rows,STATIONS,'m05','2026-07-20','latest')
        self.assertEqual(r['average'],8)
        self.assertEqual(r['stationCount'],1)
        self.assertIsNone(r['stations'][0]['average'])

    def test_duplicates_conflicts_and_date_only(self):
        a=row('S01001','2026-07-20','2')
        r=aggregate([a,a],STATIONS,'m05','2026-07-20','daily')
        self.assertEqual(r['validCount'],1)
        self.assertEqual(r['duplicateCount'],1)
        self.assertTrue(r['dateOnly'])
        with self.assertRaises(ApiError):
            aggregate([a,row('S01001','2026-07-20','3')],STATIONS,'m05','2026-07-20','daily')

    @patch.dict('os.environ',{'water_api_key':'test-secret%2B'})
    @patch('_water.urlopen')
    def test_all_pages_and_key_encoding(self,request):
        request.side_effect=[io.BytesIO(xml([row('S01001','2026-07-20 10:00','1')],2)),
                             io.BytesIO(xml([row('S01001','2026-07-20 11:00','3')],2))]
        rows=fetch_records('2026-07-20',('S01001',),1234)
        self.assertEqual(len(rows),2)
        self.assertIn('pageNo=2',request.call_args.args[0])
        self.assertIn('serviceKey=test-secret%2B',request.call_args.args[0])
        self.assertIn('endDate=20260720235959',request.call_args.args[0])
        fetch_records('2026-07-20',('S01001',),1234)
        self.assertEqual(request.call_count,2)

    @patch.dict('os.environ',{'water_api_key':'test-secret'})
    @patch('_water.urlopen')
    def test_incomplete_pages_are_not_averaged(self,request):
        request.side_effect=[io.BytesIO(xml([row('S01001','2026-07-20','1')],2)),io.BytesIO(xml([],2))]
        with self.assertRaises(ApiError):
            fetch_records('2026-07-20',('S01001',),1)

    @patch.dict('os.environ',{'water_api_key':'test-secret'})
    @patch('_water.urlopen',side_effect=ValueError('URL contains test-secret'))
    def test_error_redaction(self,request):
        with self.assertRaises(ApiError) as error:
            fetch_records('2026-07-20',('S01001',),1)
        self.assertNotIn('test-secret',error.exception.detail)

    @patch.dict('os.environ',{'water_api_key':''})
    def test_missing_key(self):
        with self.assertRaises(ApiError) as error:
            fetch_records('2026-07-20',('S01001',),1)
        self.assertEqual(error.exception.status,503)

    @patch('_water.fetch_records')
    def test_region_without_stations_does_not_call_upstream(self,request):
        r=summary(dict(day='2026-07-20',province='서울특별시'))
        self.assertIsNone(r['average'])
        self.assertEqual(r['selectedStationCount'],0)
        request.assert_not_called()

    def test_summary_rejects_bad_parameters(self):
        for params in [dict(day='2026-07-20',item='nope'),dict(day='2026-07-20',mode='nope'),
                       dict(day='not-a-date'),dict(day='1999-01-01')]:
            with self.assertRaises(ApiError) as error:
                summary(params)
            self.assertEqual(error.exception.status,422)

if __name__=='__main__':
    unittest.main()
