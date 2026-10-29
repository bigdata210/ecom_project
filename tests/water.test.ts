import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ApiError } from '../lib/server/api-error.ts';
import {
  aggregate, catalog, fetchRecords, numeric, parsePage, summary, timestamp,
} from '../lib/server/water.ts';
import type { WaterStation } from '../lib/types.ts';

const STATIONS: WaterStation[] = [
  { id: 'S01001', name: '가평', province: '경기도', district: '가평군', basin: '한강', address: '' },
  { id: 'S01002', name: '흥천', province: '경기도', district: '여주시', basin: '한강', address: '' },
];

const row = (site: string, stamp: string, value: string) =>
  ({ siteId: site, msrDate: stamp, m05: value });

const xml = (items: Record<string, string>[], total: number) =>
  '<response><header><resultCode>00</resultCode></header><body><items>' +
  items.map((r) =>
    '<item>' + Object.entries(r).map(([k, v]) => `<${k}>${v}</${k}>`).join('') + '</item>',
  ).join('') +
  `</items><totalCount>${total}</totalCount></body></response>`;

const realFetch = globalThis.fetch;
/** Serve the queued bodies in order and record every requested URL. */
function stubFetch(bodies: (string | Error)[]) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const next = bodies.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    if (next instanceof Error) throw next;
    return { text: async () => next } as Response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.water_api_key;
});

describe('reference data', () => {
  it('keeps the supplied codebook intact', () => {
    const c = catalog();
    assert.equal(c.stations.length, 71);
    assert.equal(new Set(c.stations.map((s) => s.id)).size, 71);
    assert.equal(c.stations.filter((s) => s.province).length, 69);
    assert.equal(c.items.length, 44);
    assert.equal(c.items.find((i) => i.id === 'm77')?.unit, 'µg/L');
    assert.ok(!JSON.stringify(c).includes('water_api_key'));
  });

  it('defaults to a date old enough to be published', () => {
    const c = catalog();
    const gap = (Date.parse(`${c.today}T00:00:00Z`) - Date.parse(`${c.defaultDate}T00:00:00Z`))
      / 86_400_000;
    assert.equal(gap, 100);
  });
});

describe('value parsing', () => {
  it('treats missing, non-numeric and -999 as no value', () => {
    for (const value of [null, undefined, '', 'ND', '불검출', '<0.01', '-999', 'NaN', 'inf', '1,234']) {
      assert.equal(numeric(value), null, `${value}`);
    }
  });

  it('keeps a real zero', () => {
    assert.equal(numeric('0'), 0);
    assert.equal(numeric(0), 0);
    assert.equal(numeric('1.2e-3'), 0.0012);
  });

  it('reads every timestamp shape the provider emits', () => {
    assert.equal(timestamp('2026-07-20 10:00')?.day, '2026-07-20');
    assert.equal(timestamp('2026-07-20 10:00:30')?.day, '2026-07-20');
    assert.equal(timestamp('2026-07-20 10:00:30.5')?.day, '2026-07-20');
    assert.equal(timestamp('20260720')?.day, '2026-07-20');
    assert.equal(timestamp('20260720100030')?.day, '2026-07-20');
    assert.equal(timestamp('2026.07.20')?.day, '2026-07-20');
    assert.equal(timestamp('2026-13-01'), null);
    assert.equal(timestamp('nonsense'), null);
  });
});

describe('xml reading', () => {
  it('reads items, decodes entities and reports the total', () => {
    const { items, total } = parsePage(xml([row('S01001', '2026-07-20 10:00', '1')], 1));
    assert.equal(total, 1);
    assert.deepEqual(items, [{ siteId: 'S01001', msrDate: '2026-07-20 10:00', m05: '1' }]);
    const decoded = parsePage(
      '<response><header><resultCode>00</resultCode></header><body><items>' +
      '<item><name>&#44032;&#54217;</name><note>a &amp; b</note><empty/></item>' +
      '</items><totalCount>1</totalCount></body></response>',
    );
    assert.equal(decoded.items[0].name, '가평');
    assert.equal(decoded.items[0].note, 'a & b');
    assert.equal(decoded.items[0].empty, '');
  });

  it('rejects an error code and a non-xml body', () => {
    assert.throws(
      () => parsePage('<response><header><resultCode>30</resultCode></header></response>'),
      ApiError,
    );
    assert.throws(() => parsePage('upstream is down'), ApiError);
  });
});

describe('aggregation', () => {
  it('weights by observation count and excludes missing values', () => {
    const rows = [
      row('S01001', '2026-07-20 10:00', '0'), row('S01001', '2026-07-20 11:00', '4'),
      row('S01002', '2026-07-20 10:00', '8'), row('S01002', '2026-07-20 11:00', '-999'),
      row('S01002', '2026-07-19 11:00', '999'), row('OTHER', '2026-07-20 11:00', '999'),
    ];
    const r = aggregate(rows, STATIONS, 'm05', '2026-07-20', 'daily');
    assert.equal(r.average, 4);
    assert.equal(r.validCount, 3);
    assert.equal(r.excludedCount, 1);
    assert.equal(r.outsideCount, 2);
    assert.equal(r.stations[0].average, 2);
  });

  it('does not backfill when the latest reading is invalid', () => {
    const rows = [
      row('S01001', '2026-07-20 10:00', '2'), row('S01001', '2026-07-20 11:00', '-999'),
      row('S01002', '2026-07-20 11:00', '8'),
    ];
    const r = aggregate(rows, STATIONS, 'm05', '2026-07-20', 'latest');
    assert.equal(r.average, 8);
    assert.equal(r.stationCount, 1);
    assert.equal(r.stations[0].average, null);
  });

  it('collapses duplicates, flags date-only data and refuses conflicts', () => {
    const a = row('S01001', '2026-07-20', '2');
    const r = aggregate([a, { ...a }], STATIONS, 'm05', '2026-07-20', 'daily');
    assert.equal(r.validCount, 1);
    assert.equal(r.duplicateCount, 1);
    assert.equal(r.dateOnly, true);
    assert.throws(
      () => aggregate([a, row('S01001', '2026-07-20', '3')], STATIONS, 'm05', '2026-07-20', 'daily'),
      ApiError,
    );
  });

  it('reports the observed window', () => {
    const rows = [row('S01001', '2026-07-20 10:00', '1'), row('S01001', '2026-07-20 14:00', '3')];
    const r = aggregate(rows, STATIONS, 'm05', '2026-07-20', 'daily');
    assert.equal(r.firstObserved, '2026-07-20 10:00');
    assert.equal(r.lastObserved, '2026-07-20 14:00');
  });
});

describe('fetching', () => {
  it('reads every page and preserves the encoded key', async () => {
    process.env.water_api_key = 'test-secret%2B';
    const calls = stubFetch([
      xml([row('S01001', '2026-07-20 10:00', '1')], 2),
      xml([row('S01001', '2026-07-20 11:00', '3')], 2),
    ]);
    const rows = await fetchRecords('2026-07-20', ['S01001'], 1234);
    assert.equal(rows.length, 2);
    assert.ok(calls[1].includes('pageNo=2'));
    assert.ok(calls[1].includes('serviceKey=test-secret%2B'));
    assert.ok(calls[1].includes('endDate=20260720235959'));

    // The same query within the bucket is served from cache.
    await fetchRecords('2026-07-20', ['S01001'], 1234);
    assert.equal(calls.length, 2);
  });

  it('does not average an incomplete page set', async () => {
    process.env.water_api_key = 'test-secret';
    stubFetch([xml([row('S01001', '2026-07-20', '1')], 2), xml([], 2)]);
    await assert.rejects(() => fetchRecords('2026-07-20', ['S01001'], 1), ApiError);
  });

  it('never puts the key in an error message', async () => {
    process.env.water_api_key = 'test-secret';
    stubFetch([new Error('URL contains test-secret')]);
    await assert.rejects(
      () => fetchRecords('2026-07-20', ['S01001'], 2),
      (error: ApiError) => !error.detail.includes('test-secret'),
    );
  });

  it('reports a missing key instead of calling upstream', async () => {
    const calls = stubFetch([]);
    await assert.rejects(
      () => fetchRecords('2026-07-20', ['S01001'], 3),
      (error: ApiError) => error.status === 503,
    );
    assert.equal(calls.length, 0);
  });
});

describe('summary', () => {
  it('skips upstream when the region has no station', async () => {
    const calls = stubFetch([]);
    const r = await summary(new URLSearchParams({ day: '2026-07-20', province: '서울특별시' }));
    assert.equal(r.average, null);
    assert.equal(r.selectedStationCount, 0);
    assert.equal(calls.length, 0);
  });

  it('rejects bad parameters', async () => {
    const bad: Record<string, string>[] = [
      { day: '2026-07-20', item: 'nope' },
      { day: '2026-07-20', mode: 'nope' },
      { day: 'not-a-date' },
      { day: '1999-01-01' },
      { day: '2026-13-01' },
    ];
    for (const params of bad) {
      await assert.rejects(
        () => summary(new URLSearchParams(params)),
        (error: ApiError) => error.status === 422,
        JSON.stringify(params),
      );
    }
  });
});
