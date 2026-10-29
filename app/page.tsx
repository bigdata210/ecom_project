'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DomainTabs from '@/components/DomainTabs';
import Icon from '@/components/Icon';
import JobTable from '@/components/JobTable';
import PageTitle from '@/components/PageTitle';
import WaterMapPanel from '@/components/WaterMapPanel';
import WeatherPanel from '@/components/WeatherPanel';
import { domains, jobs } from '@/lib/data';
import { useAppState } from '@/lib/app-state';

const monthlyCount = { water: 128, air: 56, sediment: 18 };

export default function DashboardPage() {
  const { domain } = useAppState();
  const [today, setToday] = useState('');
  const [showMap, setShowMap] = useState(false);
  const visible = jobs.filter((job) => job.domain === domain);
  const pending = visible.filter((job) => job.status === 'review');

  // Rendered after mount so server and client markup agree on the date.
  useEffect(() => {
    setToday(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date()));
  }, []);

  const kpis: [string, string, string, string, string][] = [
    ['file', '이번 달 변환', `${monthlyCount[domain]}건`, '2026년 10월', ''],
    ['chart', '기준 초과 항목', domain === 'water' ? '3건' : '1건', '등록 기준 대비 · 예시', 'red'],
    ['database', '이번 달 LLM 사용량', '43%', '월 한도 대비', 'purple'],
  ];

  return (
    <>
      <PageTitle heading="대시보드" subtitle="오늘 처리할 변환과 검수를 먼저 확인하세요."
        actions={<span className="date">{today}</span>} />
      <DomainTabs />

      {/* The daily work comes first: the reference panels below are for looking
          things up, not for getting the day's conversions done. */}
      <section className="today-grid" aria-label="오늘 할 일">
        <Link href="/jobs" className="card today-card primary">
          <span className="kpi-symbol amber"><Icon name="alert" /></span>
          <div>
            <div className="kpi-label">검수 대기</div>
            <div className="kpi-value">{pending.length}건</div>
            <div className="kpi-note">
              {pending.length ? '원본과 대조해 확정하세요' : '대기 중인 검수가 없습니다'}
            </div>
          </div>
          <Icon name="arrow" className="today-go" />
        </Link>

        <Link href="/convert" className="card today-card">
          <span className="kpi-symbol"><Icon name="plus" /></span>
          <div>
            <div className="kpi-label">변환하기</div>
            <div className="kpi-value">새 작업</div>
            <div className="kpi-note">측정 원본 PDF를 업체 양식으로</div>
          </div>
          <Icon name="arrow" className="today-go" />
        </Link>
      </section>

      <section className="kpi-grid three" aria-label="이번 달 요약">
        {kpis.map(([icon, label, value, note, tone]) => (
          <div className="card kpi" key={label}>
            <span className={`kpi-symbol ${tone}`}><Icon name={icon} /></span>
            <div>
              <div className="kpi-label">{label}</div>
              <div className="kpi-value">{value}</div>
              {icon === 'database' && <div className="progress"><span style={{ width: '43%' }} /></div>}
              <div className="kpi-note">{note}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="card card-pad">
        <div className="card-heading">
          <h2>최근 작업 <span className="pill demo">예시 데이터</span></h2>
          <Link href="/jobs" className="link-button">전체 보기 <Icon name="arrow" /></Link>
        </div>
        <JobTable jobs={visible.slice(0, 4)} />
        <div className="table-note">
          예시 작업 {visible.length}건 · 선택 분야: {domains[domain].name}
        </div>
      </div>

      <h2 className="section-divider">
        참고 정보 <small className="muted">공공 데이터 · 업체 측정값이 아닙니다</small>
      </h2>

      <WeatherPanel />

      {domain === 'water' && (
        showMap ? (
          <WaterMapPanel />
        ) : (
          <button type="button" className="card reference-toggle" onClick={() => setShowMap(true)}>
            <span className="kpi-symbol"><Icon name="drop" /></span>
            <div>
              <h3>전국 수질자동측정망</h3>
              <p className="muted">
                지역·항목별 참고용 평균을 조회합니다. 공공 측정망 자료이며 업체 측정값과 직접 비교 대상이
                아닙니다.
              </p>
            </div>
            <span className="link-button">펼치기 <Icon name="arrow" /></span>
          </button>
        )
      )}
    </>
  );
}
