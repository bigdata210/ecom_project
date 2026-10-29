'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAppState } from '@/lib/app-state';
import Icon from './Icon';

const nav: [string, string, string][] = [
  ['/', '대시보드', 'grid'],
  ['/convert', '변환하기', 'file'],
  ['/jobs', '작업 목록', 'list'],
  ['/analytics', '데이터 조회·추이', 'chart'],
  ['/weather', '기상정보', 'cloud'],
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast, dialog, showDialog, showToast, closeDialog } = useAppState();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    if (!dialog && element.open) element.close();
  }, [dialog]);

  return (
    <>
      <a href="#main" className="skip-link">본문 바로가기</a>
      <header className="header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 30 34" fill="none">
                <path d="M5 2h13l8 8v22H5z" stroke="currentColor" strokeWidth="2.3" />
                <path d="M18 2v9h8M10 18h11M10 23h8M10 28h5" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <span>측정데이터 <strong>변환 플랫폼</strong></span>
          </Link>
          <span className="header-divider" />
          <label className="tenant-select">
            <span className="sr-only">업체</span>
            <select defaultValue="샘플 환경분석원"
              onChange={() => showToast('업체 전환 UI 예시입니다. 실제 권한과 데이터 분리는 인증 연결 후 적용됩니다.')}>
              <option>샘플 환경분석원</option>
              <option>샘플 측정연구소</option>
            </select>
          </label>
          <div className="header-tools">
            <Link className="weather-mini" href="/weather">현재 위치 날씨 조회</Link>
            <button type="button" className="avatar" aria-label="데모 사용자 안내"
              onClick={() => showDialog('데모 사용자',
                '현재는 로그인 없이 확인하는 화면 미리보기입니다. 실제 사용자 인증·업체 권한·개인정보 저장 기능은 후속 단계에서 연결합니다.')}>
              김
            </button>
          </div>
        </div>
        <nav className="nav" aria-label="주 메뉴">
          {nav.map(([href, name, icon]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}>
                <Icon name={icon} />{name}
              </Link>
            );
          })}
        </nav>
      </header>

      <main id="main" tabIndex={-1}>{children}</main>

      <footer className="page-footer">
        <span><i className="live-dot" />화면 미리보기</span>
        <span>
          변환 업무 데이터는 예시입니다. 공공 수질·날씨는 API 조회값을 표시합니다. 로그인·변환·DB는 연결
          예정입니다.
        </span>
      </footer>

      <div id="toast" className={toast ? 'visible' : ''} role="status" aria-live="polite">{toast}</div>

      <dialog ref={dialogRef} onClose={closeDialog}>
        <div>
          <h2>{dialog?.title}</h2>
          <p>{dialog?.text}</p>
        </div>
        <button type="button" className="button primary" onClick={closeDialog}>확인</button>
      </dialog>
    </>
  );
}
