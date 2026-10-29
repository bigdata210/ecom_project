/** NIER automatic network dashboard; public reference codes, server-only key. */
import { ApiError } from './api-error.ts';
import { kstToday } from './kma.ts';
import { WATER_STATIONS } from '../water-stations.ts';
import { WATER_PARAMETERS } from '../water-parameters.ts';
import type { WaterCatalog, WaterItem, WaterStation, WaterSummary, WaterStationResult } from '../types';

export const STATIONS = WATER_STATIONS;
export const ITEMS = WATER_PARAMETERS;
const ITEM_MAP = new Map(ITEMS.map((item) => [item.id, item]));

const ENDPOINT =
  'https://apis.data.go.kr/1480523/WaterQualityService/getRealTimeWaterQualityList';
const NOTICE =
  '제공 가이드(2022): 자동측정망은 월 1회, 약 3개월 전 자료 공개. 현재 시각 실시간 자료를 보장하지 않습니다.';
const REFERENCE =
  '사용자 제공 2022 코드표 / 환경부 물환경측정망 설치·운영계획(2024 게시본) 소재지 연결';

type Row = Record<string, string>;

function shiftDays(day: string, delta: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + delta);
  return at.toISOString().slice(0, 10);
}

export function catalog(): WaterCatalog {
  const today = kstToday();
  return {
    stations: STATIONS,
    items: ITEMS,
    today,
    defaultDate: shiftDays(today, -100),
    notice: NOTICE,
    reference: REFERENCE,
  };
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

function firstTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? decode(match[1]).trim() : null;
}

/**
 * Minimal reader for this endpoint's flat XML: <item> blocks of text-only
 * elements. It is deliberately not a general XML parser — the payload shape is
 * fixed by the provider and covered by the tests in test/water.test.ts.
 */
export function parsePage(raw: string): { items: Row[]; total: number } {
  if (!raw.includes('<')) {
    throw new ApiError(502, '수질 DB 응답 형식을 확인할 수 없습니다. 잠시 후 다시 조회하세요.');
  }
  const code = firstTag(raw, 'resultCode') ?? firstTag(raw, 'returnReasonCode');
  if (code !== '00' && code !== '0') {
    throw new ApiError(
      502,
      '수질 DB API 조회 실패: water_api_key의 수질 DB 활용승인·호출한도를 확인하세요.',
    );
  }
  const total = Number(firstTag(raw, 'totalCount') ?? '0');
  const items: Row[] = [];
  for (const block of raw.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const row: Row = {};
    for (const field of block[1].matchAll(/<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      row[field[1]] = decode(field[2]);
    }
    for (const empty of block[1].matchAll(/<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?\/>/g)) {
      row[empty[1]] ??= '';
    }
    items.push(row);
  }
  if (!Number.isInteger(total) || total < 0 || (items.length > 0 && total === 0)) {
    throw new ApiError(502, '수질 DB 응답 형식을 확인할 수 없습니다. 잠시 후 다시 조회하세요.');
  }
  return { items, total };
}

export function numeric(value: unknown): number | null {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  // -999 is explicitly below quantification in the supplied automatic codebook.
  return Number.isFinite(parsed) && parsed !== -999 ? parsed : null;
}

const STAMP_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\.\d+$/,
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/,
  /^(\d{4})-(\d{2})-(\d{2})$/,
  /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
  /^(\d{4})(\d{2})(\d{2})$/,
  /^(\d{4})\.(\d{2})\.(\d{2})$/,
];

/** Parse a provider timestamp as a wall-clock instant; null when unusable. */
export function timestamp(value: unknown): { ms: number; day: string } | null {
  const text = String(value ?? '').trim();
  for (const pattern of STAMP_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const [year, month, date, hour = '0', minute = '0', second = '0'] = match.slice(1);
    const ms = Date.UTC(+year, +month - 1, +date, +hour, +minute, +second);
    const at = new Date(ms);
    // Reject impossible dates such as month 13, which the regex alone allows.
    if (at.getUTCMonth() + 1 !== +month || at.getUTCDate() !== +date) return null;
    return { ms, day: at.toISOString().slice(0, 10) };
  }
  return null;
}

const digitsOnly = (text: string) => text.replace(/\D/g, '');

interface Reading {
  value: number | null;
  ms: number;
  rawTime: string;
}

const atMs = (text: string) => timestamp(text)?.ms ?? 0;

export function aggregate(
  rows: Row[],
  stations: WaterStation[],
  item: string,
  day: string,
  mode: 'daily' | 'latest',
) {
  const allowed = new Set(stations.map((s) => s.id));
  const unique = new Map<string, Reading>();
  let outside = 0;
  let duplicates = 0;

  for (const row of rows) {
    const stamp = timestamp(row.msrDate ?? '');
    if (!allowed.has(row.siteId) || stamp === null || stamp.day !== day) {
      outside += 1;
      continue;
    }
    const key = `${row.siteId}|${stamp.ms}`;
    const value = numeric(row[item]);
    const seen = unique.get(key);
    if (seen) {
      if (seen.value !== value) {
        throw new ApiError(502, '동일 측정소·시각에 서로 다른 값이 있어 평균을 계산하지 않았습니다.');
      }
      duplicates += 1;
      continue;
    }
    unique.set(key, { value, ms: stamp.ms, rawTime: row.msrDate });
  }

  if (rows.length > 0 && unique.size === 0) {
    throw new ApiError(502, 'API 응답의 측정소 또는 날짜가 조회 조건과 달라 평균을 계산하지 않았습니다.');
  }

  const grouped = new Map<string, Reading[]>(stations.map((s) => [s.id, []]));
  for (const [key, record] of unique) {
    grouped.get(key.split('|')[0])!.push(record);
  }

  const details: WaterStationResult[] = [];
  const allValues: number[] = [];
  const allTimes: string[] = [];
  let excluded = 0;
  let dateOnly = false;

  for (const station of stations) {
    let records = grouped.get(station.id)!;
    if (mode === 'latest' && records.length > 0) {
      records = [records.reduce((a, b) => (b.ms > a.ms ? b : a))];
    }
    const missing = records.filter((r) => r.value === null).length;
    excluded += missing;
    const values = records.filter((r) => r.value !== null).map((r) => r.value as number);
    const times = records.filter((r) => r.value !== null).map((r) => r.rawTime);
    dateOnly ||= times.some((t) => digitsOnly(t).length === 8);
    allValues.push(...values);
    allTimes.push(...times);
    details.push({
      ...station,
      average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      count: values.length,
      excluded: missing,
      latest: times.length ? times.reduce((a, b) => (atMs(b) > atMs(a) ? b : a)) : null,
    });
  }

  const earliest = allTimes.length ? allTimes.reduce((a, b) => (atMs(b) < atMs(a) ? b : a)) : null;
  const newest = allTimes.length ? allTimes.reduce((a, b) => (atMs(b) > atMs(a) ? b : a)) : null;

  return {
    average: allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : null,
    validCount: allValues.length,
    excludedCount: excluded,
    outsideCount: outside,
    duplicateCount: duplicates,
    stationCount: details.filter((d) => d.count > 0).length,
    selectedStationCount: stations.length,
    stations: details,
    dateOnly,
    firstObserved: earliest,
    lastObserved: newest,
  };
}

const recordCache = new Map<string, Row[]>();

export async function fetchRecords(day: string, siteIds: string[], bucket: number): Promise<Row[]> {
  const cacheKey = `${day}|${siteIds.join(',')}|${bucket}`;
  const hit = recordCache.get(cacheKey);
  if (hit) return hit;

  const key = (process.env.water_api_key ?? '').trim();
  if (!key) {
    throw new ApiError(503, '환경변수 water_api_key를 Production에 설정한 후 재배포하세요.');
  }

  const result: Row[] = [];
  const deadline = Date.now() + 50_000;
  const stamp = day.replace(/-/g, '');

  // The supplied guide limits siteId to six characters but permits comma lists.
  // Keep URLs short and retrieve every page; never average a truncated result.
  for (let start = 0; start < siteIds.length; start += 10) {
    const group = siteIds.slice(start, start + 10);
    let count = 0;
    let expected: number | null = null;
    let complete = false;

    for (let page = 1; page <= 50; page++) {
      if (Date.now() > deadline) {
        throw new ApiError(504, '전체 자료 조회 시간이 초과되었습니다. 지역 또는 측정소를 좁혀 다시 조회하세요.');
      }
      const params = new URLSearchParams({
        serviceKey: decodeURIComponent(key),
        resultType: 'xml',
        numOfRows: '1000',
        pageNo: String(page),
        siteId: group.join(','),
        startDate: `${stamp}000000`,
        endDate: `${stamp}235959`,
      });

      let raw: string;
      try {
        const response = await fetch(`${ENDPOINT}?${params}`, {
          signal: AbortSignal.timeout(12_000),
          cache: 'no-store',
        });
        raw = await response.text();
      } catch {
        // Upstream exception messages can contain the API key in a URL.
        throw new ApiError(502, '수질 DB 연결에 실패했습니다. 키의 활용승인 또는 API 장애를 확인하세요.');
      }
      if (raw.length > 8_000_000) {
        throw new ApiError(502, '수질 DB 응답이 너무 큽니다. 측정소를 좁혀 조회하세요.');
      }

      const { items, total } = parsePage(raw);
      expected ??= total;
      if (total !== expected) {
        throw new ApiError(503, '조회 중 원본 자료 건수가 변경되었습니다. 다시 조회하세요.');
      }
      if (items.length === 0 && count < total) {
        throw new ApiError(502, '수질 DB 일부 페이지가 누락되어 평균을 계산하지 않았습니다.');
      }
      result.push(...items);
      count += items.length;
      if (count >= total) {
        complete = true;
        break;
      }
    }
    if (!complete) {
      throw new ApiError(413, '조회 건수가 많습니다. 지역 또는 측정소를 좁혀 조회하세요.');
    }
    if (count !== expected) {
      throw new ApiError(502, '수질 DB 전체 건수와 조회 건수가 달라 평균을 계산하지 않았습니다.');
    }
  }

  recordCache.set(cacheKey, result);
  return result;
}

export async function summary(params: URLSearchParams): Promise<WaterSummary> {
  const item = params.get('item') || 'm05';
  const mode = (params.get('mode') || 'daily') as WaterSummary['mode'];
  const province = params.get('province') ?? '';
  const district = params.get('district') ?? '';
  const basin = params.get('basin') ?? '';
  const station = params.get('station') ?? '';

  if (!ITEM_MAP.has(item) || (mode !== 'daily' && mode !== 'latest')) {
    throw new ApiError(422, '지원하지 않는 항목 또는 집계 방식입니다.');
  }
  const day = params.get('day') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || timestamp(day) === null) {
    throw new ApiError(422, '조회일을 YYYY-MM-DD 형식으로 전달하세요.');
  }
  if (day > kstToday() || Number(day.slice(0, 4)) < 2000) {
    throw new ApiError(422, '2000년 이후부터 오늘까지의 날짜를 선택하세요.');
  }

  const stations = STATIONS.filter(
    (s) =>
      (!province || s.province === province) &&
      (!district || s.district === district) &&
      (!basin || s.basin === basin) &&
      (!station || s.id === station),
  );

  const shared = { day, mode, item: ITEM_MAP.get(item)!, notice: NOTICE, source: '국립환경과학원 수질 DB' };
  if (stations.length === 0) {
    return {
      ...aggregate([], [], item, day, mode),
      ...shared,
      message: '제공 코드표와 소재지 연결 자료에서 해당 지역의 자동측정소를 찾지 못했습니다.',
    };
  }

  const rows = await fetchRecords(day, stations.map((s) => s.id), Math.floor(Date.now() / 600_000));
  const result = aggregate(rows, stations, item, day, mode);
  return {
    ...result,
    ...shared,
    retrievedAt: new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00'),
    message: result.validCount
      ? ''
      : '선택한 날짜·항목의 유효 자료가 없습니다. 공개 지연 또는 미측정 항목인지 확인하세요.',
  };
}
