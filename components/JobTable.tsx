'use client';

import { useRouter } from 'next/navigation';
import { statuses } from '@/lib/data';
import { useAppState } from '@/lib/app-state';
import type { Job } from '@/lib/types';
import Icon from './Icon';

const actionLabel: Record<Job['status'], string> = {
  review: '검수하기',
  processing: '진행 보기',
  failed: '실패 사유',
  confirmed: '결과 보기',
};

const infoText: Record<Job['status'], string> = {
  failed: '실패 사유 예시: 텍스트를 읽을 수 없는 PDF. 실제 재시도는 변환 API 연결 후 제공됩니다.',
  processing: '처리 상태 예시입니다. 실제 작업 서버는 연결되지 않았습니다.',
  confirmed: '예시 작업입니다. 실제 원본·XLSX 파일은 보관되어 있지 않습니다.',
  review: '예시 작업입니다. 실제 원본·XLSX 파일은 보관되어 있지 않습니다.',
};

export function Badge({ status }: { status: Job['status'] }) {
  const info = statuses[status];
  return <span className={`pill ${info.tone}`}>{info.text}</span>;
}

export default function JobTable({ jobs, full = false }: { jobs: Job[]; full?: boolean }) {
  const router = useRouter();
  const { setDomain, setStep, showDialog, showToast } = useAppState();

  function openReview(job: Job) {
    setDomain(job.domain);
    setStep(3);
    router.push('/convert');
    showToast('선택한 분야의 예시 검수 화면입니다.');
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>파일명</th><th>측정지점</th><th>등록일</th>
            {full && <th>작성자</th>}
            <th>상태</th><th>작업</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length ? jobs.map((job) => (
            <tr key={job.id}>
              <td><span className="file-cell"><Icon name="file" />{job.file}</span></td>
              <td>{job.site}</td>
              <td>{job.time}</td>
              {full && <td>{job.author}</td>}
              <td><Badge status={job.status} /></td>
              <td>
                <button type="button" className="link-button"
                  onClick={() => (job.status === 'review'
                    ? openReview(job)
                    : showDialog(job.file, infoText[job.status]))}>
                  {actionLabel[job.status]}
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={full ? 6 : 5}>
                <div className="empty-state">
                  <Icon name="folder" />
                  <p>조건에 맞는 예시 작업이 없습니다.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
