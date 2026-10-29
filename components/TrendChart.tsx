const sets: Record<string, { values: number[]; unit: string }> = {
  총질소: { values: [11.2, 9.8, 12.8, 10.7, 13.1, 12.3], unit: 'mg/L' },
  BOD: { values: [2.8, 3.4, 2.9, 3.8, 3.3, 3.1], unit: 'mg/L' },
  먼지: { values: [10.2, 13.1, 11.8, 14.6, 13.2, 12.4], unit: 'mg/Sm³' },
  구리: { values: [18.4, 20.1, 19.8, 22.7, 20.9, 21.3], unit: 'mg/kg' },
};

export default function TrendChart({ parameter, period }: { parameter: string; period: 'month' | 'event' }) {
  const data = sets[parameter] ?? sets.총질소;
  const max = Math.ceil(Math.max(...data.values) * 1.3);
  const points = data.values.map((value, i): [number, number] => [65 + i * 164, 240 - (value / max) * 190]);
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');

  return (
    <svg className="line-chart" viewBox="0 0 960 280" role="img"
      aria-label={`${parameter} 예시 측정 추이`}>
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ca8f4" stopOpacity=".2" />
          <stop offset="100%" stopColor="#7ca8f4" stopOpacity=".01" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1="65" y1={240 - i * 48} x2="900" y2={240 - i * 48} stroke="#e8eef7" />
          <text x="45" y={245 - i * 48} fontSize="11" fill="#8b9ab0" textAnchor="end">
            {((max * i) / 4).toFixed(1)}
          </text>
        </g>
      ))}
      <path d={`${path} L885,240 L65,240 Z`} fill="url(#area-fill)" />
      <path d={path} fill="none" stroke="#3a7ae5" strokeWidth="3" />
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="white" stroke="#3a7ae5" strokeWidth="2.5" />
          <text x={x} y={y - 15} textAnchor="middle" fontSize="12" fill="#58749c">{data.values[i]}</text>
          <text x={x} y="268" textAnchor="middle" fontSize="11" fill="#8b9ab0">
            {period === 'month' ? `0${i + 5}월` : `10.${i * 3 + 10}`}
          </text>
        </g>
      ))}
      <text x="65" y="20" fontSize="11" fill="#8b9ab0">{data.unit} · 화면 예시</text>
    </svg>
  );
}
