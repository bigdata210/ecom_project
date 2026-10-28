// API boundary: UI components consume this module, never provider credentials.
// The current adapter is entirely local. No file bytes leave the browser.
import {jobs, measurements, templates} from './data.js';
export const service = {
  mode:'demo',
  async listJobs(){return structuredClone(jobs);},
  async getMeasurements(domain){return structuredClone(measurements[domain]);},
  async listTemplates(){return structuredClone(templates);},
  async submitConversion(){throw new Error('실제 변환 API는 아직 연결되지 않았습니다. 아래 예시 검수 화면으로 동선을 확인하세요.');},
  async confirm(){throw new Error('현재는 화면 미리보기입니다. 검수 확정과 DB 저장은 API 연결 후 사용할 수 있습니다.');},
};
