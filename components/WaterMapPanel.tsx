'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { service } from '@/lib/services';
import type { MapRegion, WaterCatalog, WaterStation, WaterSummary } from '@/lib/types';

const valueText = (value: number | null | undefined) =>
  value == null ? '자료 없음' : new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 6 }).format(value);

const shortName = (name: string) =>
  name.replace('특별자치도', '').replace('특별자치시', '').replace('특별시', '')
    .replace('광역시', '').replace(/도$/, '');

interface Filters {
  province: string;
  district: string;
  basin: string;
  station: string;
  item: string;
  day: string;
  mode: 'daily' | 'latest';
}

export default function WaterMapPanel() {
  const [catalog, setCatalog] = useState<WaterCatalog | null>(null);
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [filters, setFilters] = useState<Filters>({
    province: '', district: '', basin: '', station: '', item: 'm05', day: '', mode: 'daily',
  });
  const [result, setResult] = useState<WaterSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const started = useRef(false);
  const sequence = useRef(0);

  const initialize = useCallback(async () => {
    setError('');
    try {
      const [catalogResult, regionResult] = await Promise.allSettled([
        service.getWaterCatalog(),
        fetch('/korea-regions.json', { cache: 'force-cache' }).then((r) => r.json() as Promise<MapRegion[]>),
      ]);
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      setCatalog(catalogResult.value);
      setFilters((current) => ({ ...current, day: catalogResult.value.defaultDate }));
      if (regionResult.status === 'fulfilled') setRegions(regionResult.value);
      else setError('지도 경계를 불러오지 못했습니다. 지역 선택 목록으로 조회할 수 있습니다.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '수질 코드표를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void initialize();
  }, [initialize]);

  const runQuery = useCallback(async (next: Filters) => {
    const token = ++sequence.current;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const summary = await service.getWaterSummary({
        day: next.day, item: next.item, mode: next.mode, province: next.province,
        district: next.district, basin: next.basin, station: next.station,
      });
      if (token === sequence.current) setResult(summary);
    } catch (cause) {
      if (token !== sequence.current) return;
      setError(cause instanceof Error && cause.name === 'TimeoutError'
        ? '수질 조회 시간이 초과되었습니다. 지역이나 측정소를 좁혀 다시 조회하세요.'
        : cause instanceof Error ? cause.message : '수질 자료 조회에 실패했습니다.');
    } finally {
      if (token === sequence.current) setLoading(false);
    }
  }, []);

  /** Any filter change invalidates an in-flight request and the shown result. */
  function update(patch: Partial<Filters>) {
    sequence.current++;
    setLoading(false);
    setResult(null);
    setError('');
    setFilters((current) => ({ ...current, ...patch }));
  }

  function selectRegion(province: string) {
    const next: Filters = { ...filters, province, district: '', station: '', basin: '' };
    sequence.current++;
    setResult(null);
    setError('');
    setFilters(next);
    void runQuery(next);
  }

  if (!catalog) {
    return (
      <section className="card card-pad">
        <h2>전국 수질자동측정망</h2>
        <p role="status">{error || '지도와 측정소 코드표를 불러오는 중…'}</p>
        {error && (
          <button type="button" className="button secondary" onClick={() => void initialize()}>
            다시 불러오기
          </button>
        )}
      </section>
    );
  }

  const { stations } = catalog;
  const matches = (s: WaterStation, ignore = '') =>
    (ignore === 'province' || !filters.province || s.province === filters.province)
    && (ignore === 'district' || !filters.district || s.district === filters.district)
    && (ignore === 'basin' || !filters.basin || s.basin === filters.basin);

  const provinces = [...new Set(regions.length ? regions.map((r) => r.name) : stations.map((s) => s.province).filter(Boolean))];
  const districts = [...new Set(stations.filter((s) => matches(s, 'district')).map((s) => s.district).filter(Boolean))].sort();
  const basins = [...new Set(stations.map((s) => s.basin))];
  const available = stations.filter((s) => matches(s));
  const place = [filters.province || '전국', filters.district, filters.basin].filter(Boolean).join(' · ');

  return (
    <section className="card card-pad water-map-panel">
      <div className="card-heading">
        <div>
          <h2>전국 수질자동측정망</h2>
          <p className="muted">지도에서 지역을 클릭해 항목별 평균을 조회하세요.</p>
        </div>
        <span className="pill">공공 수질 DB</span>
      </div>
      <div className="panel-note">{catalog.notice}</div>

      <div className="water-map-layout">
        <div className="water-map-column">
          <svg className="korea-map" viewBox="0 0 470 440" role="group"
            aria-label="대한민국 시도별 수질 조회 지도">
            {regions.map((region) => (
              <path key={region.name} d={region.path} fillRule="evenodd" tabIndex={0} role="button"
                aria-label={`${region.name} 평균 조회`} aria-pressed={region.name === filters.province}
                className={`water-region ${region.name === filters.province ? 'selected' : ''}`}
                onClick={() => selectRegion(region.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectRegion(region.name);
                  }
                }}>
                <title>{region.name}</title>
              </path>
            ))}
          </svg>
          <div className="water-region-list">
            <button type="button" className={`button ${filters.province ? 'secondary' : 'primary'} small`}
              onClick={() => selectRegion('')}>전국</button>
            {provinces.map((province) => (
              <button key={province} type="button"
                className={`button ${province === filters.province ? 'primary' : 'secondary'} small`}
                onClick={() => selectRegion(province)}>{shortName(province)}</button>
            ))}
          </div>
          <p className="muted map-source">
            지도: 통계청 SGIS 2018 경계,{' '}
            <a href="https://github.com/southkorea/southkorea-maps/tree/master/kostat/2018/json"
              target="_blank" rel="noopener noreferrer">southkorea-maps</a>{' '}
            가공 (공공누리 1유형). 경계는 참고용입니다.
          </p>
        </div>

        <div className="water-map-controls">
          <div className="water-filter-grid">
            <label className="field">시·도
              <select className="control" value={filters.province}
                onChange={(e) => update({ province: e.target.value, district: '', station: '' })}>
                <option value="">전체</option>
                {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">시·군·구
              <select className="control" value={filters.district}
                onChange={(e) => update({ district: e.target.value, station: '' })}>
                <option value="">전체</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="field">수계
              <select className="control" value={filters.basin}
                onChange={(e) => update({ basin: e.target.value, station: '' })}>
                <option value="">전체</option>
                {basins.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="field">측정소
              <select className="control" value={filters.station}
                onChange={(e) => update({ station: e.target.value })}>
                <option value="">전체</option>
                {available.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
              </select>
            </label>
            <label className="field">측정항목
              <select className="control" value={filters.item}
                onChange={(e) => update({ item: e.target.value })}>
                {catalog.items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
            </label>
            <label className="field">조회일 (KST)
              <input type="date" className="control" min="2000-01-01" max={catalog.today}
                value={filters.day} onChange={(e) => update({ day: e.target.value })} />
            </label>
            <label className="field">집계 방식
              <select className="control" value={filters.mode}
                onChange={(e) => update({ mode: e.target.value as Filters['mode'] })}>
                <option value="daily">일간 평균</option>
                <option value="latest">선택일 최종값 평균</option>
              </select>
            </label>
          </div>

          <div className="toolbar">
            <button type="button" className="button primary" disabled={loading}
              onClick={() => void runQuery(filters)}>{loading ? '조회 중…' : '평균 조회'}</button>
            <button type="button" className="button secondary"
              onClick={() => update({ day: catalog.today })}>오늘로 설정</button>
          </div>

          <p className="muted">
            {available.length}개 측정소 · 기본 조회일은 공개 지연을 고려한 100일 전입니다. 오늘 자료는 없을 수
            있습니다. 센서 1·2·3 및 ECD는 별도 항목으로 조회합니다.
          </p>
          {error && <p className="panel-note warning" role="alert">{error}</p>}

          {loading ? (
            <div className="empty-state" role="status">선택한 날짜의 모든 페이지를 조회하고 있습니다…</div>
          ) : !result ? (
            <div className="empty-state">지도에서 지역을 선택하거나 조건을 설정한 뒤 평균 조회를 누르세요.</div>
          ) : (
            <div className="water-result">
              <p className="muted">
                {place} · {result.day} ·{' '}
                {result.mode === 'daily' ? '일간 유효 관측값 평균' : '측정소별 해당 날짜 최종 관측값 평균'}
              </p>
              <h3>{result.item.name}</h3>
              <div className="water-average">
                {valueText(result.average)} <small>{result.item.unit}</small>
              </div>
              <div className="water-statistics">
                <span>유효 관측 <b>{result.validCount}건</b></span>
                <span>자료 있는 측정소 <b>{result.stationCount}/{result.selectedStationCount}개</b></span>
                <span>제외 <b>{result.excludedCount}건</b></span>
              </div>
              {result.message && <p role="status">{result.message}</p>}
              {result.lastObserved && (
                <p className="muted">실제 자료시각: {result.firstObserved} ~ {result.lastObserved} (KST)</p>
              )}
              {result.dateOnly && (
                <p className="panel-note warning">
                  원본이 날짜까지만 제공되어 시·분 단위 실시간 여부는 확인할 수 없습니다.
                </p>
              )}
              <details open>
                <summary>측정소별 결과</summary>
                <div className="table-wrap water-station-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>측정소</th><th>지역</th><th>수계</th>
                        <th>{result.mode === 'daily' ? '일간 평균' : '최종값'}</th>
                        <th>유효/제외</th><th>자료시각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stations.length ? result.stations.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}<small className="muted"> {s.id}</small></td>
                          <td>{[s.province, s.district].filter(Boolean).join(' ') || '소재지 미연결'}</td>
                          <td>{s.basin}</td>
                          <td>{valueText(s.average)}</td>
                          <td>{s.count} / {s.excluded}</td>
                          <td>{s.latest || '자료 없음'}</td>
                        </tr>
                      )) : <tr><td colSpan={6}>연결된 측정소 없음</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="muted">
                출처: {result.source}
                {result.retrievedAt ? ` · 조회 ${result.retrievedAt.replace('T', ' ').slice(0, 19)} KST` : ''}<br />
                선택 항목의 유효 숫자만 산술평균합니다. -999(정량한계 미만)·ND·빈값은 제외하고 실제 0은
                포함합니다. 측정소별 관측 건수에 따라 가중치가 달라지며 공식 지역 대표 수질이나 판정등급이
                아닙니다.
                {result.duplicateCount ? ` 동일 값 중복 ${result.duplicateCount}건 제외.` : ''}
                {result.outsideCount ? ` 조건 외 자료 ${result.outsideCount}건 제외.` : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      <details>
        <summary>자료 범위와 지역 연결 기준</summary>
        <p className="muted">
          {catalog.reference}. 코드표에 있는 71개 측정소 중 주소를 확인한 69개를 지역에 연결했습니다.
          미호천·임하호는 소재지가 미연결되어 전국·수계·측정소 조회에만 포함됩니다. 목록에 없는 신규
          측정소는 포함되지 않습니다. 방사성·먹는물·일반 수질측정망은 자동측정망 평균에 섞지 않습니다.
          자동측정망에 없는 BOD 등은 이 화면에서 제공하지 않습니다.
        </p>
      </details>
    </section>
  );
}
