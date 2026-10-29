'use client';

import { useState } from 'react';
import DomainTabs from '@/components/DomainTabs';
import JobTable from '@/components/JobTable';
import PageTitle from '@/components/PageTitle';
import { jobs, statuses } from '@/lib/data';
import { useAppState } from '@/lib/app-state';
import type { JobStatus } from '@/lib/types';

export default function JobsPage() {
  const { domain } = useAppState();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<JobStatus | 'all'>('all');

  const rows = jobs
    .filter((job) => job.domain === domain)
    .filter((job) => status === 'all' || job.status === status)
    .filter((job) => !query
      || (job.file + job.site + job.author).toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageTitle heading="작업 목록" subtitle="등록한 작업의 처리 상태와 검수 현황을 확인합니다." />
      <DomainTabs />
      <section className="card card-pad">
        <div className="toolbar">
          <input className="control search" placeholder="파일명, 지점, 작성자 검색" aria-label="작업 검색"
            value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="control" aria-label="작업 상태" value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus | 'all')}>
            <option value="all">전체 상태</option>
            {(Object.entries(statuses) as [JobStatus, { text: string }][]).map(([key, info]) => (
              <option key={key} value={key}>{info.text}</option>
            ))}
          </select>
          <span className="muted">예시 목록 · 실제 보관 파일 없음</span>
        </div>
        <JobTable jobs={rows} full />
        <div className="table-note">
          실제 원본과 결과 파일의 보관·다운로드는 파일 저장소 연결 후 제공합니다.
        </div>
      </section>
    </>
  );
}
