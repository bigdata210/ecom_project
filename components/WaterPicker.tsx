'use client';

import { useState } from 'react';
import { useAppState } from '@/lib/app-state';
import { recommendedItems, waterGroups } from '@/lib/water-items';

export default function WaterPicker() {
  const { waterSelection, toggleWaterItem, clearWaterItems, addWaterItems } = useAppState();
  const [group, setGroup] = useState('전체');
  const suggested = recommendedItems(waterSelection);

  const itemButton = (name: string, recommended = false) => (
    <button key={name} type="button" aria-pressed={waterSelection.has(name)}
      className={`water-item ${waterSelection.has(name) ? 'chosen' : ''}`}
      onClick={() => toggleWaterItem(name)}>
      {waterSelection.has(name) ? '✓ ' : recommended ? '+ ' : ''}{name}
    </button>
  );

  return (
    <section className="card card-pad water-picker">
      <div className="card-heading">
        <h2>수질 측정항목 선택</h2>
        <span className="muted" role="status">{waterSelection.size}개 선택</span>
      </div>
      <p className="muted">
        항목을 클릭하면 같은 그룹의 항목을 추천합니다. 추천은 업무 편의용이며 분석 의뢰·법정 필수항목을
        뜻하지 않습니다.
      </p>

      <div className="water-chips">
        {['전체', ...Object.keys(waterGroups)].map((name) => (
          <button key={name} type="button" aria-pressed={group === name}
            className={`button ${group === name ? 'primary' : 'secondary'}`}
            onClick={() => setGroup(name)}>{name}</button>
        ))}
      </div>

      <div className="water-catalog">
        {Object.entries(waterGroups)
          .filter(([name]) => group === '전체' || group === name)
          .map(([name, items]) => (
            <div key={name}>
              <h3>{name}</h3>
              <div className="water-chips">{items.map((item) => itemButton(item))}</div>
            </div>
          ))}
      </div>

      <div className="water-summary">
        <h3>선택한 항목</h3>
        <div className="water-chips">
          {waterSelection.size
            ? [...waterSelection].map((item) => itemButton(item))
            : <span className="muted">아직 선택하지 않았습니다.</span>}
        </div>
        {waterSelection.size > 0 && (
          <button type="button" className="button secondary" onClick={clearWaterItems}>선택 초기화</button>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="water-summary">
          <h3>함께 선택할 항목 추천</h3>
          <p className="muted">선택한 항목과 같은 그룹 · 클릭한 항목만 추가됩니다.</p>
          <div className="water-chips">{suggested.map((item) => itemButton(item, true))}</div>
          <button type="button" className="button secondary" onClick={() => addWaterItems(suggested)}>
            추천 {suggested.length}개 모두 추가
          </button>
        </div>
      )}

      <p className="muted">
        항목 목록은 화면에서만 선택됩니다. 실제 PDF 추출·Excel 반영은 변환 API 연결 후 적용됩니다.
        크롬과 6가크롬 등은 별도 항목으로 유지합니다.
      </p>
    </section>
  );
}
