'use client';

import { useState } from 'react';
import DomainTabs from '@/components/DomainTabs';
import Icon from '@/components/Icon';
import PageTitle from '@/components/PageTitle';
import TrendChart from '@/components/TrendChart';
import { sampleSite } from '@/lib/data';
import { useAppState } from '@/lib/app-state';
import type { Domain } from '@/lib/types';

const parameterOptions: Record<Domain, string[]> = {
  water: ['총질소', 'BOD'],
  air: ['먼지'],
  sediment: ['구리'],
};

export default function AnalyticsPage() {
  const { domain, showDialog } = useAppState();
  const [parameter, setParameter] = useState('총질소');
  const [period, setPeriod] = useState<'month' | 'event'>('month');

  const options = parameterOptions[domain];
  const active = options.includes(parameter) ? parameter : options[0];

  return (
    <>
      <PageTitle heading="데이터 조회·추이"
        subtitle="확정된 데이터를 조건별로 조회하고 변화 추이를 살펴봅니다." />
      <DomainTabs />
      <section className="card card-pad">
        <div className="toolbar">
          <select className="control" aria-label="분석 지점" defaultValue={sampleSite[domain]}>
            <option>{sampleSite[domain]}</option>
          </select>
          <select className="control" aria-label="측정항목" value={active}
            onChange={(event) => setParameter(event.target.value)}>
            {options.map((name) => <option key={name}>{name}</option>)}
          </select>
          <span className="control">2026.05.01 — 2026.10.28</span>
          <div className="segmented" aria-label="집계 단위">
            <button type="button" className={period === 'month' ? 'active' : ''}
              onClick={() => setPeriod('month')}>월별 예시</button>
            <button type="button" className={period === 'event' ? 'active' : ''}
              onClick={() => setPeriod('event')}>건별 예시</button>
          </div>
          <button type="button" className="button secondary small"
            onClick={() => showDialog('엑셀 내보내기',
              '실제 확정 데이터 조회와 XLSX 생성 API 연결 후 사용할 수 있습니다. 현재 그래프는 예시입니다.')}>
            <Icon name="download" />엑셀 내보내기
          </button>
        </div>
        <div className="card-heading">
          <h2>{active} 측정 추이</h2>
          <span className="legend"><span><i />측정값 예시</span></span>
        </div>
        <div className="chart-container">
          <TrendChart parameter={active} period={period} />
        </div>
        <div className="panel-note">
          <Icon name="alert" />
          예시 그래프입니다. 실제 집계·기간 검색·기상 겹쳐보기는 데이터 API 연결 후 지원됩니다.
          불검출 처리 방식 예시: 통계에서 제외.
        </div>
      </section>
    </>
  );
}
