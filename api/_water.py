"""NIER automatic network dashboard; public reference codes, server-only key."""
import json
import math
import os
import re
import time
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode, unquote
from urllib.request import urlopen
from xml.etree import ElementTree as ET

from _shared import ApiError

ROOT = Path(__file__).resolve().parent / '_data'
STATIONS = json.loads((ROOT / 'water_auto_stations.json').read_text(encoding='utf-8'))
ITEMS = json.loads((ROOT / 'water_auto_items.json').read_text(encoding='utf-8'))
ITEM_MAP = {i['id']: i for i in ITEMS}
KST = timezone(timedelta(hours=9))
ENDPOINT = 'https://apis.data.go.kr/1480523/WaterQualityService/getRealTimeWaterQualityList'
NOTICE = '제공 가이드(2022): 자동측정망은 월 1회, 약 3개월 전 자료 공개. 현재 시각 실시간 자료를 보장하지 않습니다.'
REFERENCE = '사용자 제공 2022 코드표 / 환경부 물환경측정망 설치·운영계획(2024 게시본) 소재지 연결'


def catalog(params=None):
    today = datetime.now(KST).date()
    return dict(stations=STATIONS, items=ITEMS, today=today.isoformat(),
        defaultDate=(today - timedelta(days=100)).isoformat(), notice=NOTICE,
        reference=REFERENCE)


def parse_page(raw):
    try:
        root = ET.fromstring(raw)
        code = root.findtext('.//resultCode') or root.findtext('.//returnReasonCode')
        if code not in ('00', '0'):
            raise ApiError(502, '수질 DB API 조회 실패: water_api_key의 수질 DB 활용승인·호출한도를 확인하세요.')
        total = int(root.findtext('.//totalCount') or 0)
        items = [{field.tag: field.text or '' for field in row} for row in root.findall('.//items/item')]
        if total < 0 or (items and total == 0):
            raise ValueError('invalid count')
        return items, total
    except ApiError:
        raise
    except Exception:
        raise ApiError(502, '수질 DB 응답 형식을 확인할 수 없습니다. 잠시 후 다시 조회하세요.') from None


@lru_cache(maxsize=64)
def fetch_records(day, site_ids, bucket):
    key = os.getenv('water_api_key', '').strip()
    if not key:
        raise ApiError(503, '환경변수 water_api_key를 Production에 설정한 후 재배포하세요.')
    result = []
    expected = None
    deadline = time.monotonic() + 50
    # The supplied guide limits siteId to six characters but permits comma lists.
    # Keep URLs short and retrieve every page; never average a truncated result.
    for start in range(0, len(site_ids), 10):
        group = site_ids[start:start + 10]
        count = 0
        expected = None
        for page in range(1, 51):
            if time.monotonic() > deadline:
                raise ApiError(504, '전체 자료 조회 시간이 초과되었습니다. 지역 또는 측정소를 좁혀 다시 조회하세요.')
            stamp = day.replace('-', '')
            params = dict(serviceKey=unquote(key), resultType='xml', numOfRows=1000, pageNo=page,
                siteId=','.join(group), startDate=stamp + '000000', endDate=stamp + '235959')
            try:
                with urlopen(ENDPOINT + '?' + urlencode(params), timeout=12) as response:
                    raw = response.read(8_000_001)
                if len(raw) > 8_000_000:
                    raise ApiError(502, '수질 DB 응답이 너무 큽니다. 측정소를 좁혀 조회하세요.')
                rows, total = parse_page(raw)
            except ApiError:
                raise
            except Exception:
                # Upstream exception URLs can contain the API key.
                raise ApiError(502, '수질 DB 연결에 실패했습니다. 키의 활용승인 또는 API 장애를 확인하세요.') from None
            if expected is None:
                expected = total
            if total != expected:
                raise ApiError(503, '조회 중 원본 자료 건수가 변경되었습니다. 다시 조회하세요.')
            if not rows and count < total:
                raise ApiError(502, '수질 DB 일부 페이지가 누락되어 평균을 계산하지 않았습니다.')
            result.extend(rows)
            count += len(rows)
            if count >= total:
                break
        else:
            raise ApiError(413, '조회 건수가 많습니다. 지역 또는 측정소를 좁혀 조회하세요.')
        if count != expected:
            raise ApiError(502, '수질 DB 전체 건수와 조회 건수가 달라 평균을 계산하지 않았습니다.')
    return result


def numeric(value):
    text = '' if value is None else str(value).strip()
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?', text):
        return None
    number = float(text)
    # -999 is explicitly below quantification in the supplied automatic codebook.
    return number if math.isfinite(number) and number != -999 else None


def timestamp(value):
    value = str(value).strip()
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d',
                '%Y%m%d%H%M%S', '%Y%m%d', '%Y.%m.%d'):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    return None


def aggregate(rows, stations, item, day, mode):
    allowed = {s['id'] for s in stations}
    unique = {}
    outside = 0
    duplicates = 0
    for row in rows:
        stamp = timestamp(row.get('msrDate', ''))
        if row.get('siteId') not in allowed or stamp is None or stamp.date().isoformat() != day:
            outside += 1
            continue
        key = (row['siteId'], stamp.isoformat())
        value = numeric(row.get(item))
        if key in unique:
            if unique[key]['value'] != value:
                raise ApiError(502, '동일 측정소·시각에 서로 다른 값이 있어 평균을 계산하지 않았습니다.')
            duplicates += 1
            continue
        unique[key] = dict(value=value, stamp=stamp, rawTime=row['msrDate'])
    if rows and not unique:
        raise ApiError(502, 'API 응답의 측정소 또는 날짜가 조회 조건과 달라 평균을 계산하지 않았습니다.')
    grouped = {s['id']: [] for s in stations}
    for (site, _), record in unique.items():
        grouped[site].append(record)
    details = []
    all_values = []
    all_times = []
    excluded = 0
    date_only = False
    for station in stations:
        records = grouped[station['id']]
        if mode == 'latest' and records:
            records = [max(records, key=lambda r: r['stamp'])]
        excluded += sum(r['value'] is None for r in records)
        values = [r['value'] for r in records if r['value'] is not None]
        times = [r['rawTime'] for r in records if r['value'] is not None]
        date_only |= any(len(re.sub(r'\D', '', t)) == 8 for t in times)
        all_values.extend(values)
        all_times.extend(times)
        details.append(dict(**station, average=sum(values) / len(values) if values else None,
            count=len(values), excluded=sum(r['value'] is None for r in records),
            latest=max(times, key=lambda t: timestamp(t)) if times else None))
    return dict(average=sum(all_values) / len(all_values) if all_values else None,
        validCount=len(all_values), excludedCount=excluded, outsideCount=outside,
        duplicateCount=duplicates, stationCount=sum(d['count'] > 0 for d in details),
        selectedStationCount=len(stations), stations=details, dateOnly=date_only,
        firstObserved=min(all_times, key=lambda t: timestamp(t)) if all_times else None,
        lastObserved=max(all_times, key=lambda t: timestamp(t)) if all_times else None)


def summary(params):
    item = params.get('item') or 'm05'
    mode = params.get('mode') or 'daily'
    province = params.get('province', '')
    district = params.get('district', '')
    basin = params.get('basin', '')
    station = params.get('station', '')
    if item not in ITEM_MAP or mode not in ('daily', 'latest'):
        raise ApiError(422, '지원하지 않는 항목 또는 집계 방식입니다.')
    try:
        day = date.fromisoformat(params.get('day', ''))
    except ValueError:
        raise ApiError(422, '조회일을 YYYY-MM-DD 형식으로 전달하세요.') from None
    if day > datetime.now(KST).date() or day.year < 2000:
        raise ApiError(422, '2000년 이후부터 오늘까지의 날짜를 선택하세요.')
    stations = [s for s in STATIONS if (not province or s['province'] == province)
        and (not district or s['district'] == district) and (not basin or s['basin'] == basin)
        and (not station or s['id'] == station)]
    if not stations:
        return dict(**aggregate([], [], item, day.isoformat(), mode), day=day.isoformat(),
            mode=mode, item=ITEM_MAP[item], notice=NOTICE, source='국립환경과학원 수질 DB',
            message='제공 코드표와 소재지 연결 자료에서 해당 지역의 자동측정소를 찾지 못했습니다.')
    rows = fetch_records(day.isoformat(), tuple(s['id'] for s in stations), int(time.time() // 600))
    result = aggregate(rows, stations, item, day.isoformat(), mode)
    return dict(**result, day=day.isoformat(), mode=mode, item=ITEM_MAP[item], notice=NOTICE,
        source='국립환경과학원 수질 DB', retrievedAt=datetime.now(KST).isoformat(),
        message='' if result['validCount'] else '선택한 날짜·항목의 유효 자료가 없습니다. 공개 지연 또는 미측정 항목인지 확인하세요.')
