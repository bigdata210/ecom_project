import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ApiError } from '../lib/server/api-error.ts';
import { current, grid, observation } from '../lib/server/kma.ts';

const realFetch = globalThis.fetch;

function stubFetch(bodies: (unknown | Error)[]) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const next = bodies.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    if (next instanceof Error) throw next;
    return { json: async () => next } as Response;
  }) as typeof fetch;
  return calls;
}

const reading = (values: [string, string][]) => ({
  response: {
    header: { resultCode: '00' },
    body: {
      items: {
        item: values.map(([category, obsrValue]) => ({
          category, obsrValue, baseDate: '20261028', baseTime: '1300',
        })),
      },
    },
  },
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.data_api_key;
});

describe('grid projection', () => {
  it('places Seoul on the published cell', () => {
    assert.deepEqual(grid(37.5665, 126.978), [60, 127]);
  });
});

describe('observation', () => {
  it('reports a missing key without calling upstream', async () => {
    const calls = stubFetch([]);
    await assert.rejects(
      () => observation(60, 127, 2988000),
      (error: ApiError) => error.status === 503,
    );
    assert.equal(calls.length, 0);
  });

  it('reads the values, caches them and preserves the encoded key', async () => {
    process.env.data_api_key = 'test-only-secret%2B';
    const calls = stubFetch([
      reading([['T1H', '21.5'], ['REH', '58'], ['WSD', '2.1'], ['RN1', '0']]),
    ]);
    const result = await observation(60, 127, 2988001);
    assert.equal(result.temperature, 21.5);
    assert.equal(result.precipitation, 0);
    assert.equal(result.precipitationType, null);
    assert.ok(!JSON.stringify(result).includes('secret'));
    assert.ok(calls[0].includes('serviceKey=test-only-secret%2B'));

    await observation(60, 127, 2988001);
    assert.equal(calls.length, 1);
  });

  it('never puts the key in an error message', async () => {
    process.env.data_api_key = 'test-only-secret';
    stubFetch([new Error('URL with test-only-secret')]);
    await assert.rejects(
      () => observation(60, 127, 2988002),
      (error: ApiError) => !error.detail.includes('test-only-secret'),
    );
  });
});

describe('current', () => {
  it('rejects coordinates outside the supported area', async () => {
    for (const params of [{ lat: '99', lon: '99' }, { lat: 'x', lon: '126' }]) {
      await assert.rejects(
        () => current(new URLSearchParams(params)),
        (error: ApiError) => error.status === 422,
      );
    }
  });
});
