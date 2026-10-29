import type { Metadata } from 'next';
import PageTitle from '@/components/PageTitle';
import WeatherPanel from '@/components/WeatherPanel';

export const metadata: Metadata = { title: '기상정보' };

export default function WeatherPage() {
  return (
    <>
      <PageTitle heading="기상정보"
        subtitle="오늘의 주요 지역 날씨와 현재 위치 주변 관측값을 확인합니다." />
      <WeatherPanel />
    </>
  );
}
