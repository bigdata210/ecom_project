'use client';

import { useRef, useState } from 'react';
import { domains, sampleSite, templates } from '@/lib/data';
import { service } from '@/lib/services';
import { useAppState } from '@/lib/app-state';
import type { Domain } from '@/lib/types';
import DomainTabs from './DomainTabs';
import Icon from './Icon';
import PageTitle from './PageTitle';
import WaterPicker from './WaterPicker';

const headings = ['분야를 선택하세요', '측정 원본 업로드', '추출 결과 검수', '검수 결과 저장'];
const stepNames = ['분야 선택', '업로드', '검수', '저장'];

const domainBlurb: Record<Domain, string> = {
  water: '수질 성적서, 중금속, 유기인, VOC',
  air: '배출가스, 먼지, 대기 측정 성적서',
  sediment: '해양저질 성적서, 입도, 중금속',
};

function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper" aria-label="변환 단계">
      {stepNames.map((name, i) => (
        <div key={name} className={`step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}
          aria-current={step === i + 1 ? 'step' : undefined}>
          <span className="step-num">{step > i + 1 ? '✓' : i + 1}</span>{name}
        </div>
      ))}
    </div>
  );
}

export default function ConvertFlow() {
  const state = useAppState();
  const { domain, step, setStep, files, addFiles, removeFile, rows, originalRows,
    setRowValue, changes, selected, setSelected, warningOnly, setWarningOnly,
    setDomain, resetConversion, showDialog, showToast } = state;
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const site = sampleSite[domain];

  // Reviewing a batch means hundreds of cells a day, so the value column is
  // driven from the keyboard: the mouse is never required to move or edit.
  const valueInputs = useRef<(HTMLInputElement | null)[]>([]);
  const visibleRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !warningOnly || row.warning);

  function focusValue(index: number) {
    setSelected(index);
    const input = valueInputs.current[index];
    input?.focus();
    // Open the value selected so the next keystroke replaces it outright.
    input?.select();
  }

  function moveFocus(from: number, delta: number) {
    const at = visibleRows.findIndex(({ index }) => index === from);
    const next = visibleRows[at + delta];
    if (next) focusValue(next.index);
  }

  /** Enter jumps to the next row that needs attention, wrapping around. */
  function focusNextWarning(from: number) {
    const at = visibleRows.findIndex(({ index }) => index === from);
    const ahead = visibleRows.slice(at + 1).find(({ row }) => row.warning)
      ?? visibleRows.find(({ row }) => row.warning);
    if (ahead) focusValue(ahead.index);
  }

  function onValueKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveFocus(index, 1),
      ArrowUp: () => moveFocus(index, -1),
      Enter: () => focusNextWarning(index),
      Escape: () => setRowValue(index, originalRows[index].value),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function chooseDomain(next: Domain) {
    setDomain(next);
    setStep(2);
  }

  async function reviewNext() {
    const invalid = rows.some((row) => row.value.trim() === '' || !Number.isFinite(Number(row.value)));
    if (invalid) {
      showDialog('측정값 확인',
        '예시 검수를 계속하려면 모든 항목에 숫자를 입력하세요. 실제 서비스에서는 ND·누락값을 별도로 처리할 예정입니다.');
      return;
    }
    setStep(4);
  }

  const domainChoice = (
    <>
      <div className="panel-note">
        <Icon name="alert" />
        현재는 화면 미리보기입니다. 파일은 서버로 전송되지 않으며 실제 변환·저장은 진행되지 않습니다.
      </div>
      <div className="domain-choice">
        {(Object.entries(domains) as [Domain, (typeof domains)[Domain]][]).map(([key, info]) => (
          <button key={key} type="button" className="card choice-card" onClick={() => chooseDomain(key)}>
            <span className="choice-icon"><Icon name={info.icon} /></span>
            <h2>{info.name}</h2>
            <p>{domainBlurb[key]}</p>
            <span className="link-button">{info.name} 문서 업로드 <Icon name="arrow" /></span>
          </button>
        ))}
      </div>
      <div className="card card-pad">
        <h3>기존 작업을 검수하시나요?</h3>
        <p className="muted">작업 목록에서 검수 대기 중인 문서를 확인하세요.</p>
        <a className="link-button" href="/jobs">작업 목록 보기 <Icon name="arrow" /></a>
      </div>
    </>
  );

  const upload = (
    <>
      {domain === 'water' && <WaterPicker />}
      <div className="upload-layout">
        <section className="card card-pad">
          <div className="card-heading">
            <h2>PDF 파일 선택</h2>
            <span className="muted">여러 파일 가능</span>
          </div>
          <div className={`dropzone ${over ? 'over' : ''}`} tabIndex={0} role="button"
            aria-label="PDF 파일 선택"
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInput.current?.click();
              }
            }}
            onDragOver={(event) => { event.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              addFiles(event.dataTransfer.files);
            }}>
            <Icon name="upload" />
            <h3>PDF를 여기로 끌어오세요</h3>
            <p>
              파일당 최대 20MB · 최대 50개<br />
              선택한 파일은 브라우저에서만 보관하며 업로드하지 않습니다.
            </p>
            <span className="button secondary">파일 찾아보기</span>
          </div>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple hidden
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = '';
            }} />
          <ul className="file-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}`}>
                <Icon name="file" />
                <span>{file.name}</span>
                <span className="file-size">{(file.size / 1048576).toFixed(2)} MB</span>
                <button type="button" className="icon-button" aria-label={`${file.name} 선택 취소`}
                  onClick={() => removeFile(index)}><Icon name="close" /></button>
              </li>
            ))}
          </ul>
          <div className="panel-note">
            <Icon name="alert" />
            실제 문서에서 값을 추출하는 기능은 API 연결 후 제공됩니다. 지금은 선택 상태와 예시 검수 동선을
            확인할 수 있습니다.
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-heading"><h2>변환 설정</h2></div>
          <div className="field">
            <label htmlFor="template-select">엑셀 템플릿</label>
            <select id="template-select" className="control">
              {templates.filter((t) => t.domain === domain).map((t) => (
                <option key={t.name}>{t.name} · {t.version}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="site-select">측정지점</label>
            <select id="site-select" className="control">
              <option>검수 단계에서 확인</option>
              <option>{site}</option>
            </select>
          </div>
          <div className="panel-note warning">
            <Icon name="file" />
            중금속은 1차·2차 XLSX 두 개로, 유기인·VOC는 등록된 통합 양식으로 구성할 예정입니다.
          </div>
          <button type="button" className="button secondary" style={{ width: '100%' }}
            onClick={async () => {
              try { await service.submitConversion(); }
              catch (error) { showDialog('실제 변환 연결 안내', (error as Error).message); }
            }}>실제 변환 · API 연결 예정</button>
          <button type="button" className="button primary" style={{ width: '100%', marginTop: 10 }}
            onClick={() => {
              setStep(3);
              showToast('선택한 파일의 분석 결과가 아닌 예시 검수 화면입니다.');
            }}>예시 검수 화면 보기 <Icon name="arrow" /></button>
        </section>
      </div>
      <div className="upload-actions">
        <button type="button" className="button secondary" onClick={() => setStep(1)}>이전</button>
      </div>
    </>
  );

  const review = (
    <>
      <div className="review-layout">
        <section className="card">
          <div className="review-title">
            <h2>원본 PDF</h2>
            <span>{domains[domain].name}_예시성적서.pdf</span>
          </div>
          <div className="viewer-toolbar">
            <span><Icon name="file" />　2 / 3</span>
            <span>예시 문서　·　100%</span>
          </div>
          <div className="viewer-shell">
            <div className="paper">
              <div className="preview-label">예시 문서 · 실제 업로드 파일 아님</div>
              <h2>{domains[domain].name} 측정성적서</h2>
              <div className="paper-meta">
                사업장　 : 샘플 사업장<br />
                측정지점 : {site}<br />
                시료번호 : W-2026-1028-01<br />
                측정일　 : 2026.10.28
              </div>
              <b>1. 측정결과</b>
              <table className="paper-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr><th>번호</th><th>항목</th><th>측정값</th><th>단위</th></tr>
                </thead>
                <tbody>
                  {originalRows.map((row, i) => (
                    <tr key={row.name} className={i === selected ? 'selected' : ''}>
                      <td>{i + 1}</td><td>{row.name}</td><td>{row.value}</td><td>{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: 25 }}>2. 기타사항</p>
              <p className="muted" style={{ fontSize: 10 }}>이 문서는 화면 구성을 위한 예시입니다.</p>
              <div className="doc-footer"><span>샘플 환경분석원</span><span>2 / 3</span></div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="review-title">
            <h2>측정값 확인</h2>
            <button type="button" className="button secondary small"
              onClick={() => showDialog('현재 화면의 변경 이력', changes.length
                ? changes.map((c) => `${c.name}: ${c.before} → ${c.after}`).join(' / ')
                : '아직 수정한 값이 없습니다. 기록은 이 브라우저 화면에서만 유지되며 새로고침하면 초기화됩니다.')}>
              변경 이력 {changes.length ? `(${changes.length})` : ''}
            </button>
          </div>
          <div className="review-panel-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="client-name">사업장</label>
                <input className="control" id="client-name" defaultValue="샘플 사업장" />
              </div>
              <div className="field">
                <label htmlFor="point-name">측정지점</label>
                <input className="control" id="point-name" defaultValue={site} />
              </div>
              <div className="field">
                <label htmlFor="sample-date">측정일</label>
                <input type="date" className="control" id="sample-date" defaultValue="2026-10-28" />
              </div>
              <div className="field">
                <label htmlFor="sample-id">시료번호</label>
                <input className="control" id="sample-id" defaultValue="W-2026-1028-01" />
              </div>
            </div>

            <div className="warning-banner">
              <span><Icon name="alert" /> 확인이 필요한 항목 {rows.filter((r) => r.warning).length}건</span>
              <label className="switch-label">
                <input type="checkbox" checked={warningOnly}
                  onChange={(event) => setWarningOnly(event.target.checked)} />
                경고만 보기
              </label>
            </div>

            <p className="keyboard-hint">
              <kbd>↑</kbd><kbd>↓</kbd> 행 이동 · <kbd>Enter</kbd> 다음 확인 항목 ·{' '}
              <kbd>Esc</kbd> 원래 값으로 · 값은 선택된 채로 열려 바로 덮어쓸 수 있습니다.
            </p>

            <div className="table-wrap">
              <table className="review-table">
                <thead>
                  <tr><th>항목</th><th>측정값</th><th>단위</th><th>등록기준</th><th>상태</th><th>근거</th></tr>
                </thead>
                <tbody>
                  {visibleRows.map(({ row, index: i }) => (
                    <tr key={row.name} className={i === selected ? 'selected' : ''}>
                      <td>{row.name}</td>
                      <td>
                        <input aria-label={`${row.name} 측정값`} value={row.value} inputMode="decimal"
                          ref={(element) => { valueInputs.current[i] = element; }}
                          onFocus={() => setSelected(i)}
                          onKeyDown={(event) => onValueKeyDown(event, i)}
                          onChange={(event) => setRowValue(i, event.target.value)} />
                      </td>
                      <td>{row.unit}</td>
                      <td>{row.limit}</td>
                      <td>
                        <span className={`pill ${row.warning ? 'amber' : 'blue'}`}>
                          {row.edited ? '수정됨' : row.warning ? '기준 확인' : '원문 일치'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="link-button"
                          aria-label={`${row.name} 원문 근거 보기`}
                          onClick={() => setSelected(i)}>2쪽</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-heading" style={{ margin: '18px 0 8px' }}>
              <h3>선택한 값의 원문 근거</h3>
              <span className="muted" style={{ fontSize: 10 }}>원본 2쪽 · 해당 행 강조</span>
            </div>
            <div className="evidence">
              <b>
                “ {originalRows[selected]?.name} {originalRows[selected]?.value} {originalRows[selected]?.unit} ”
              </b>
              <span className="muted" style={{ fontSize: 10 }}>
                등록기준은 예시이며 실제 법적 판정을 의미하지 않습니다.
              </span>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked />이 PDF 양식을 다음에도 사용
            </label>
            <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
              수정 내용은 현재 화면에만 반영됩니다. 새로고침하면 초기화됩니다.
            </p>
          </div>
        </section>
      </div>

      <div className="review-actions">
        <p><Icon name="alert" /> 예시 검수 동선입니다. 실제 확정·저장은 진행되지 않습니다.</p>
        <div>
          <button type="button" className="button secondary" onClick={() => setStep(2)}>이전</button>
          <button type="button" className="button secondary"
            onClick={() => showToast('현재 화면에 반영되어 있습니다. 서버 저장은 아직 지원하지 않습니다.')}>
            임시 반영
          </button>
          <button type="button" className="button primary" onClick={() => void reviewNext()}>
            검수 완료 · 저장 화면 보기 <Icon name="arrow" />
          </button>
        </div>
      </div>
    </>
  );

  const save = (
    <>
      <div className="save-grid">
        <section className="card card-pad">
          <div className="card-heading">
            <h2>검수 내용 미리보기</h2>
            <span className="pill blue">데모</span>
          </div>
          <ul className="check-list">
            <li><Icon name="check" />분야: {domains[domain].name}</li>
            <li><Icon name="check" />측정항목: {rows.length}개</li>
            <li><Icon name="check" />화면에서 수정한 값: {changes.length}건</li>
            <li><Icon name="file" />엑셀 양식: {templates.find((t) => t.domain === domain)?.name}</li>
          </ul>
          <div className="panel-note">
            <Icon name="alert" />
            확정 데이터와 파일은 생성되지 않았습니다. 추후 API와 연결하면 검수 완료 후 DB 저장 및 XLSX
            다운로드를 제공합니다.
          </div>
        </section>

        <section className="card card-pad">
          <h2>저장 방식</h2>
          <div style={{ display: 'grid', gap: 18, margin: '24px 0' }}>
            <label className="checkbox-label">
              <input type="checkbox" checked disabled readOnly />검수 확정 후 DB 저장 · 연결 예정
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked disabled readOnly />등록 양식으로 XLSX 생성 · 연결 예정
            </label>
          </div>
          <button type="button" className="button primary" style={{ width: '100%' }}
            onClick={async () => {
              try { await service.confirm(); }
              catch (error) { showDialog('확정·다운로드 연결 안내', (error as Error).message); }
            }}>확정·다운로드 연결 안내</button>
          <button type="button" className="button secondary" style={{ width: '100%', marginTop: 10 }}
            onClick={resetConversion}>다른 변환 화면 보기</button>
        </section>
      </div>
      <div className="upload-actions">
        <button type="button" className="button secondary" onClick={() => setStep(3)}>
          검수 화면으로 돌아가기
        </button>
      </div>
    </>
  );

  return (
    <>
      <PageTitle heading={headings[step - 1]}
        subtitle={step === 3
          ? '원본 근거와 추출값을 비교하고 수정하는 화면입니다.'
          : '선택 · 업로드 · 검수 · 저장까지 한 흐름으로 진행합니다.'}
        actions={<Stepper step={step} />} />
      {step > 1 && <DomainTabs />}
      {step === 1 ? domainChoice : step === 2 ? upload : step === 3 ? review : save}
    </>
  );
}
