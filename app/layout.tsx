import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/AppShell';
import { AppStateProvider } from '@/lib/app-state';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '측정데이터 변환 플랫폼', template: '%s · 측정데이터 변환 플랫폼' },
  description: '환경 측정대행업을 위한 PDF·Excel 변환과 검수 플랫폼 화면 미리보기',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppStateProvider>
          <AppShell>{children}</AppShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
