"""KMA ultra-short observations. Credentials and upstream URLs stay server-side."""
import json
import math
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlencode, unquote
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
KST = timezone(timedelta(hours=9))

def grid(latitude, longitude):
    rad = math.pi / 180
    re = 6371.00877 / 5
    slat1, slat2 = 30 * rad, 60 * rad
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(
        math.tan(math.pi / 4 + slat2 / 2) / math.tan(math.pi / 4 + slat1 / 2))
    sf = math.tan(math.pi / 4 + slat1 / 2) ** sn * math.cos(slat1) / sn
    ro = re * sf / math.tan(math.pi / 4 + 38 * rad / 2) ** sn
    ra = re * sf / math.tan(math.pi / 4 + latitude * rad / 2) ** sn
    theta = (longitude - 126) * rad * sn
    return math.floor(ra * math.sin(theta) + 43.5), math.floor(ro - ra * math.cos(theta) + 136.5)

@lru_cache(maxsize=256)
def observation(nx, ny, bucket):
    key = os.getenv('data_api_key', '').strip()
    if not key:
        raise HTTPException(503, 'Vercel 환경변수 data_api_key 설정 후 재배포가 필요합니다.')
    base = datetime.fromtimestamp(bucket * 600, KST) - timedelta(minutes=40)
    for offset in range(3):
        when = base - timedelta(hours=offset)
        query = urlencode(dict(serviceKey=unquote(key), pageNo=1, numOfRows=20,
            dataType='JSON', base_date=when.strftime('%Y%m%d'),
            base_time=when.strftime('%H00'), nx=nx, ny=ny))
        try:
            with urlopen('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?' + query, timeout=10) as response:
                payload = json.load(response)['response']
            code = str(payload['header']['resultCode'])
            if code == '03':
                continue
            if code != '00':
                raise HTTPException(502, '기상청 API 조회 실패: 키의 단기예보 조회서비스 활용승인·호출한도를 확인하세요.')
            items = payload['body']['items']['item']
            values = {item['category']: item['obsrValue'] for item in items}
            def number(code):
                try:
                    value = float(values[code])
                    return value if math.isfinite(value) and value > -900 else None
                except (KeyError, ValueError, TypeError):
                    return None
            if number('T1H') is None:
                continue
            return dict(source='기상청 초단기실황', observedAt=items[0]['baseDate'] + ' ' + items[0]['baseTime'],
                nx=nx, ny=ny, temperature=number('T1H'), humidity=number('REH'),
                windSpeed=number('WSD'), precipitation=number('RN1'), precipitationType=number('PTY'))
        except HTTPException:
            raise
        except Exception:
            # Never return upstream errors: they can contain the credential URL.
            raise HTTPException(502, '기상청 응답을 확인할 수 없습니다. 단기예보 조회서비스 키·활용승인 또는 일시 장애를 확인하세요.') from None
    raise HTTPException(503, '해당 격자의 최근 관측자료가 없습니다. 잠시 후 다시 조회하세요.')

@router.get('/api/weather')
def weather(lat: float = Query(..., ge=32, le=40), lon: float = Query(..., ge=123, le=133)):
    nx, ny = grid(lat, lon)
    return observation(nx, ny, int(datetime.now(KST).timestamp() // 600))
