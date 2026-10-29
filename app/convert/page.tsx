import type { Metadata } from 'next';
import ConvertFlow from '@/components/ConvertFlow';

export const metadata: Metadata = { title: '변환하기' };

export default function ConvertPage() {
  return <ConvertFlow />;
}
