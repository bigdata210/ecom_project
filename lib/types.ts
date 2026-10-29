export type Domain = 'water' | 'air' | 'sediment';
export type JobStatus = 'review' | 'processing' | 'confirmed' | 'failed';

export interface DomainInfo {
  name: string;
  icon: string;
  label: string;
  color: string;
}

export interface StatusInfo {
  text: string;
  tone: 'amber' | 'blue' | 'green' | 'red';
}

export interface Job {
  id: string;
  file: string;
  site: string;
  time: string;
  date: string;
  status: JobStatus;
  domain: Domain;
  author: string;
  type: string;
  pages: number;
}

export interface Measurement {
  name: string;
  value: string;
  unit: string;
  limit: string;
  warning: boolean;
  edited?: boolean;
}

export interface Template {
  name: string;
  domain: Domain;
  type: string;
  version: string;
  status: string;
}

export interface Change {
  name: string;
  before: string;
  after: string;
}

export interface PickedFile {
  name: string;
  size: number;
}

/** GET /api/weather */
export interface Observation {
  source: string;
  observedAt: string;
  nx: number;
  ny: number;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  precipitationType: number | null;
}

export interface WaterStation {
  id: string;
  name: string;
  province: string;
  district: string;
  basin: string;
  address: string;
}

export interface WaterItem {
  id: string;
  name: string;
  unit: string;
}

/** GET /api/water/catalog */
export interface WaterCatalog {
  stations: WaterStation[];
  items: WaterItem[];
  today: string;
  defaultDate: string;
  notice: string;
  reference: string;
}

export interface WaterStationResult extends WaterStation {
  average: number | null;
  count: number;
  excluded: number;
  latest: string | null;
}

/** GET /api/water/summary */
export interface WaterSummary {
  average: number | null;
  validCount: number;
  excludedCount: number;
  outsideCount: number;
  duplicateCount: number;
  stationCount: number;
  selectedStationCount: number;
  stations: WaterStationResult[];
  dateOnly: boolean;
  firstObserved: string | null;
  lastObserved: string | null;
  day: string;
  mode: 'daily' | 'latest';
  item: WaterItem;
  notice: string;
  source: string;
  retrievedAt?: string;
  message?: string;
}

export interface MapRegion {
  name: string;
  path: string;
}
