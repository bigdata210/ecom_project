// API boundary: UI components consume this module, never provider credentials.
// The business-data adapter is still entirely local; no file bytes leave the
// browser. Public-data calls go to the Python Functions under /api.
import { jobs, measurements, templates } from './data';
import type { Domain, Job, Measurement, Observation, Template, WaterCatalog, WaterSummary } from './types';

async function getJson<T>(url: string, timeoutMs: number, fallback: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('서버 응답을 읽을 수 없습니다. 배포 상태를 확인하세요.');
  }
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === 'string' ? detail : fallback);
  }
  return data as T;
}

export const service = {
  mode: 'demo' as const,

  async listJobs(): Promise<Job[]> {
    return structuredClone(jobs);
  },
  async getMeasurements(domain: Domain): Promise<Measurement[]> {
    return structuredClone(measurements[domain]);
  },
  async listTemplates(): Promise<Template[]> {
    return structuredClone(templates);
  },
  async submitConversion(): Promise<never> {
    throw new Error('실제 변환 API는 아직 연결되지 않았습니다. 아래 예시 검수 화면으로 동선을 확인하세요.');
  },
  async confirm(): Promise<never> {
    throw new Error('현재는 화면 미리보기입니다. 검수 확정과 DB 저장은 API 연결 후 사용할 수 있습니다.');
  },

  // Public data. These are live calls to the Vercel Python Functions.
  async getWeather(lat: number, lon: number): Promise<Observation> {
    return getJson<Observation>(
      `/api/weather?lat=${lat}&lon=${lon}`, 35000, '기상정보를 조회하지 못했습니다.');
  },
  async getWaterCatalog(): Promise<WaterCatalog> {
    return getJson<WaterCatalog>('/api/water/catalog', 30000, '수질 코드표를 불러오지 못했습니다.');
  },
  async getWaterSummary(params: Record<string, string>): Promise<WaterSummary> {
    const query = new URLSearchParams(params).toString();
    return getJson<WaterSummary>(
      `/api/water/summary?${query}`, 70000, '수질 자료 조회에 실패했습니다.');
  },
};
