'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { service } from '@/lib/services';
import type { Observation } from '@/lib/types';

const cities: [string, number, number][] = [
  ['서울', 37.5665, 126.9780],
  ['부산', 35.1796, 129.0756],
  ['대구', 35.8714, 128.6014],
  ['광주', 35.1595, 126.8526],
  ['대전', 36.3504, 127.3845],
];

interface CityResult {
  name: string;
  data?: Observation;
  error?: string;
}

interface LocationInfo {
  lat: number;
  lon: number;
  accuracy: number;
  requestedAt: string;
}

/** `YYYYMMDD HHMM` as issued by the KMA, rendered as KST. */
function observedAt(value: string) {
  if (!/^\d{8} \d{4}$/.test(value)) return '관측시각 확인 불가';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(9, 11)}:${value.slice(11, 13)} KST`;
}

function message(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === 1) return '위치 권한이 거부되었습니다. 브라우저 사이트 설정에서 위치를 허용한 후 다시 조회하세요.';
    if (error.code === 2) return '현재 위치를 확인할 수 없습니다. 기기의 위치 설정을 확인하세요.';
    return '위치 조회 시간이 초과되었습니다. 다시 시도하세요.';
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return '기상 조회 시간이 초과되었습니다. 다시 시도하세요.';
    return error.message || '기상 조회에 실패했습니다.';
  }
  return '기상 조회에 실패했습니다.';
}

function Metric({ name, value, unit }: { name: string; value: number | null; unit: string }) {
  return (
    <div className="weather-metric">
      <div>
        <small>{name}</small>
        <b>{value == null ? '자료 없음' : `${value} ${unit}`}</b>
      </div>
    </div>
  );
}

export default function WeatherPanel() {
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [citiesBusy, setCitiesBusy] = useState(false);
  const [current, setCurrent] = useState<Observation | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [status, setStatus] = useState('현재 위치로 기상청 관측값을 조회하세요.');
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState('');
  const loaded = useRef(false);

  // Rendered after mount so the server and client markup agree on the date.
  useEffect(() => {
    setToday(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'full' }).format(new Date()));
  }, []);

  const loadCities = useCallback(async () => {
    setCitiesBusy(true);
    const results = await Promise.all(cities.map(async ([name, lat, lon]): Promise<CityResult> => {
      try {
        return { name, data: await service.getWeather(lat, lon) };
      } catch (error) {
        return { name, error: error instanceof Error && error.name === 'TimeoutError' ? '조회 시간 초과' : message(error) };
      }
    }));
    setCityResults(results);
    setCitiesBusy(false);
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void loadCities();
  }, [loadCities]);

  async function locate() {
    if (busy) return;
    setBusy(true);
    setCurrent(null);
    setStatus('브라우저 위치 권한을 확인하고 있습니다.');
    try {
      if (!navigator.geolocation) throw new Error('이 브라우저는 위치 조회를 지원하지 않습니다.');
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject,
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }));
      const { latitude, longitude, accuracy } = position.coords;
      if (latitude < 32 || latitude > 40 || longitude < 123 || longitude > 133) {
        throw new Error('현재 위치가 국내 기상 조회 지원 범위를 벗어났습니다.');
      }
      setStatus('기상청 관측자료를 조회하고 있습니다.');
      const data = await service.getWeather(Number(latitude.toFixed(4)), Number(longitude.toFixed(4)));
      setLocation({
        lat: latitude, lon: longitude, accuracy,
        requestedAt: `${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date())} KST`,
      });
      setCurrent(data);
      setStatus('현재 위치 주변의 최신 제공 관측값입니다.');
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }

  const shown = cityResults.length ? cityResults : cities.map(([name]): CityResult => ({ name }));

  return (
    <div className="card card-pad">
      <div>
        <div className="card-heading">
          <div>
            <h2>{today} 기상정보</h2>
            <p className="muted">주요 5개 지역 · 기상청 최신 제공 관측값</p>
          </div>
          <button type="button" className="button secondary" disabled={citiesBusy}
            onClick={() => void loadCities()}>
            {citiesBusy ? '조회 중…' : '지역 날씨 새로고침'}
          </button>
        </div>
        <div className="regional-weather-grid">
          {shown.map((city) => (
            <article className="regional-weather-card" key={city.name}>
              <h3>{city.name}</h3>
              <p className="muted">도심 대표 좌표 기준</p>
              {city.data ? (
                <>
                  <div className="weather-temp">{city.data.temperature}°C</div>
                  <p>
                    습도 {city.data.humidity ?? '자료 없음'}{city.data.humidity == null ? '' : '%'}<br />
                    풍속 {city.data.windSpeed ?? '자료 없음'}{city.data.windSpeed == null ? '' : ' m/s'}<br />
                    1시간 강수량 {city.data.precipitation ?? '자료 없음'}{city.data.precipitation == null ? '' : ' mm'}
                  </p>
                  <p className="muted">
                    관측 {observedAt(city.data.observedAt)}<br />출처: 기상청 초단기실황
                  </p>
                </>
              ) : (
                <p className="muted" role="status">{city.error ?? '관측자료 조회 중…'}</p>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="water-summary">
        <div className="card-heading">
          <h2>내 위치 주변 날씨</h2>
          <span className={`pill ${current ? 'green' : 'demo'}`}>{current ? '실제 관측' : '위치 조회'}</span>
        </div>
        <p className="muted" role="status">{status}</p>
        <button type="button" className="button primary" disabled={busy} onClick={() => void locate()}>
          {busy ? '조회 중…' : '현재 위치 기준'}
        </button>
        {current && location && (
          <>
            <p>
              <b>조회 위치: 위도 {location.lat.toFixed(4)}°, 경도 {location.lon.toFixed(4)}°</b><br />
              <span className="muted">
                위치 정확도 약 {Math.round(location.accuracy)}m · 조회 {location.requestedAt}
              </span>
            </p>
            <div className="weather-hero">
              <span className="weather-temp">{current.temperature}°C</span>
            </div>
            <div className="weather-metrics">
              <Metric name="습도" value={current.humidity} unit="%" />
              <Metric name="풍속" value={current.windSpeed} unit="m/s" />
              <Metric name="1시간 강수량" value={current.precipitation} unit="mm" />
            </div>
            <p className="muted">
              {current.source} · {observedAt(current.observedAt)}<br />
              관측 격자 X {current.nx} / Y {current.ny} · 현재 위치 주변 격자의 관측값입니다.
            </p>
          </>
        )}
        <p className="muted">
          위치 허용 후 조회하며 좌표를 DB에 저장하지 않습니다. 현재 위치는 시료 채취지점과 다를 수 있습니다.
          예보·과거 조회·기압은 아직 연결하지 않았습니다.
        </p>
      </div>
    </div>
  );
}
