'use client';

import { domains } from '@/lib/data';
import { useAppState } from '@/lib/app-state';
import type { Domain } from '@/lib/types';
import Icon from './Icon';

export default function DomainTabs() {
  const { domain, setDomain } = useAppState();
  return (
    <div className="domain-tabs" role="group" aria-label="분야 선택">
      {(Object.entries(domains) as [Domain, (typeof domains)[Domain]][]).map(([key, info]) => (
        <button key={key} type="button" data-domain={key}
          className={`domain-tab ${domain === key ? 'active' : ''}`}
          aria-pressed={domain === key} onClick={() => setDomain(key)}>
          <Icon name={info.icon} />{info.name}
        </button>
      ))}
    </div>
  );
}
