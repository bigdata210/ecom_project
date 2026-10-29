const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  file: 'M6 2h8l5 5v15H6zM14 2v6h5M9 12h7M9 16h7',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20V2',
  cloud: 'M7 18a5 5 0 1 1 1-9 7 7 0 0 1 13 3 4 4 0 0 1-1 6H7',
  folder: 'M3 7V4h7l3 3h8v14H3z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 4 3 1 3-1 2 4-3 3v3l2 2-3 4-3-2-3 1-2 3-4-1v-4l-3-2H2V9l4-1 2-3z',
  drop: 'M12 2s-7 9-7 14a7 7 0 0 0 14 0c0-5-7-14-7-14M8 16a4 4 0 0 0 4 4',
  wind: 'M2 8h13a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 16h7a3 3 0 1 1-3 3',
  waves: 'M2 7q3-5 6 0t6 0 6 0M2 12q3-5 6 0t6 0 6 0M2 17q3-5 6 0t6 0 6 0',
  bell: 'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4',
  arrow: 'M9 5l7 7-7 7',
  plus: 'M12 4v16M4 12h16',
  check: 'M5 12l5 5L21 5',
  alert: 'M12 8v5M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  database: 'M3 6a9 4 0 1 0 18 0 9 4 0 1 0-18 0M3 6v12a9 4 0 0 0 18 0V6M3 12a9 4 0 0 0 18 0',
  upload: 'M12 16V3M7 8l5-5 5 5M3 15v6h18v-6',
  download: 'M12 3v13M7 11l5 5 5-5M3 17v4h18v-4',
  pin: 'M12 22s8-9 8-14a8 8 0 0 0-16 0c0 5 8 14 8 14M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  clock: 'M12 8v5l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  close: 'M5 5l14 14M19 5L5 19',
};

export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.file} />
    </svg>
  );
}
