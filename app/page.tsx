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
const pendingCount = { water: 8, air: 3, sediment: 1 };

export default function DashboardPage() {
  const { domain } = useAppState();
  const [today, setToday] = useState('');
  const visible = jobs.filter((job) => job.domain === domain);

  // Rendered after mount so server and client markup agree on the date.
  useEffect(() => {
    setToday(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date()));
  }, []);

  const kpis: [string, string, string, string, string][] = [
    ['file', '이번 달 변환', `${monthlyCount[domain]}건`, '2026년 10월', ''],
    ['alert', '검수 대기', `${pendingCount[domain]}건`, '확인이 필요합니다', 'amber'],
    ['chart', '기준 초과 항목', domain === 'water' ? '3건' : '1건', '등록 기준 대비 · 예시', 'red'],
    ['database', '이번 달 LLM 사용량', '43%', '월 한도 대비', 'purple'],
  ];

  return (
    <>
      <PageTitle heading="대시보드" subtitle="전국 수질과 측정·변환 업무를 확인하세요."
        actions={
          <>
            <span className="date">{today}</span>
            <Link className="button primary" href="/convert"><Icon name="plus" />새 변환</Link>
          </>
        } />
      <DomainTabs />
      {domain === 'water' && <WaterMapPanel />}

      <h2 className="work-preview-heading">변환 업무 현황 <small className="muted">예시 데이터</small></h2>
      <section className="kpi-grid" aria-label="업무 요약">
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

      <section className="dashboard-grid">
        <div className="card card-pad">
          <div className="card-heading">
            <h2>최근 작업</h2>
            <Link href="/jobs" className="link-button">전체 보기 <Icon name="arrow" /></Link>
          </div>
          <JobTable jobs={visible.slice(0, 4)} />
          <div className="table-note">
            예시 작업 {visible.length}건 · 선택 분야: {domains[domain].name}
          </div>
        </div>
        <WeatherPanel />
      </section>

      <div className="card help-strip">
        <span className="kpi-symbol"><Icon name="file" /></span>
        <div>
          <h3>업체 엑셀 양식으로 변환하세요</h3>
          <p>등록한 템플릿에 측정값을 채우고 검수 후 저장합니다.</p>
        </div>
        <Link className="button secondary" href="/convert">변환하기 <Icon name="arrow" /></Link>
      </div>
    </>
  );
}
