/** KMA ultra-short observations. The credential never leaves this module. */
import { ApiError } from './api-error.ts';
import type { Observation } from '../types';

const ENDPOINT =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

/** Lambert conformal conic projection onto the KMA forecast grid. */
export function grid(latitude: number, longitude: number): [number, number] {
  const rad = Math.PI / 180;
  const re = 6371.00877 / 5;
  const slat1 = 30 * rad;
  const slat2 = 60 * rad;
  const sn =
    Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(Math.tan(Math.PI / 4 + slat2 / 2) / Math.tan(Math.PI / 4 + slat1 / 2));
  const sf = Math.tan(Math.PI / 4 + slat1 / 2) ** sn * Math.cos(slat1) / sn;
  const ro = (re * sf) / Math.tan(Math.PI / 4 + (38 * rad) / 2) ** sn;
  const ra = (re * sf) / Math.tan(Math.PI / 4 + (latitude * rad) / 2) ** sn;
  const theta = (longitude - 126) * rad * sn;
  return [
    Math.floor(ra * Math.sin(theta) + 43.5),
    Math.floor(ro - ra * Math.cos(theta) + 136.5),
  ];
}

/** KST wall-clock parts for an instant, independent of the server timezone. */
function kstParts(at: Date) {
  const kst = new Date(at.getTime() + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    hour: `${pad(kst.getUTCHours())}00`,
  };
}

export function kstToday(at: Date = new Date()): string {
  const kst = new Date(at.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

interface ObservationItem {
  category: string;
  obsrValue: string;
  baseDate: string;
  baseTime: string;
}

/**
 * One cache entry per grid cell per ten-minute bucket, matching the upstream
 * publication cadence. Serverless instances do not share this.
 */
const cache = new Map<string, Observation>();

export async function observation(nx: number, ny: number, bucket: number): Promise<Observation> {
  const cacheKey = `${nx}:${ny}:${bucket}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const key = (process.env.data_api_key ?? '').trim();
  if (!key) throw new ApiError(503, '환경변수 data_api_key 설정 후 재배포가 필요합니다.');

  // Ask for the hour that should already be published, then walk backwards.
  const base = bucket * 600_000 - 40 * 60_000;
  for (let offset = 0; offset < 3; offset++) {
    const { date, hour } = kstParts(new Date(base - offset * 3600_000));
    const params = new URLSearchParams({
      serviceKey: decodeURIComponent(key),
      pageNo: '1',
      numOfRows: '20',
      dataType: 'JSON',
      base_date: date,
      base_time: hour,
      nx: String(nx),
      ny: String(ny),
    });

    let payload: { header?: { resultCode?: string }; body?: { items?: { item?: ObservationItem[] } } };
    try {
      const response = await fetch(`${ENDPOINT}?${params}`, {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      });
      payload = (await response.json()).response;
    } catch {
      // Never surface the upstream error: its message can contain the key.
      throw new ApiError(
        502,
        '기상청 응답을 확인할 수 없습니다. 단기예보 조회서비스 키·활용승인 또는 일시 장애를 확인하세요.',
      );
    }

    const code = String(payload?.header?.resultCode);
    if (code === '03') continue;
    if (code !== '00') {
      throw new ApiError(
        502,
        '기상청 API 조회 실패: 키의 단기예보 조회서비스 활용승인·호출한도를 확인하세요.',
      );
    }

    const items = payload.body?.items?.item ?? [];
    const values = new Map(items.map((item) => [item.category, item.obsrValue]));
    const number = (category: string): number | null => {
      const raw = values.get(category);
      if (raw === undefined) return null;
      const value = Number(raw);
      // The KMA uses large negative sentinels for "not measured".
      return Number.isFinite(value) && value > -900 ? value : null;
    };

    if (number('T1H') === null) continue;
    const result: Observation = {
      source: '기상청 초단기실황',
      observedAt: `${items[0].baseDate} ${items[0].baseTime}`,
      nx,
      ny,
      temperature: number('T1H'),
      humidity: number('REH'),
      windSpeed: number('WSD'),
      precipitation: number('RN1'),
      precipitationType: number('PTY'),
    };
    cache.set(cacheKey, result);
    return result;
  }
  throw new ApiError(503, '해당 격자의 최근 관측자료가 없습니다. 잠시 후 다시 조회하세요.');
}

export async function current(params: URLSearchParams): Promise<Observation> {
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ApiError(422, 'lat, lon을 숫자로 전달하세요.');
  }
  if (lat < 32 || lat > 40 || lon < 123 || lon > 133) {
    throw new ApiError(422, '국내 기상 조회 지원 범위를 벗어난 좌표입니다.');
  }
  const [nx, ny] = grid(lat, lon);
  return observation(nx, ny, Math.floor(Date.now() / 600_000));
}
