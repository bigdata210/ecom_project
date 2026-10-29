'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { measurements } from './data';
import type { Change, Domain, Measurement, PickedFile } from './types';

interface Dialog {
  title: string;
  text: string;
}

interface AppState {
  domain: Domain;
  setDomain: (domain: Domain) => void;

  /** Convert flow (1 선택 · 2 업로드 · 3 검수 · 4 저장). */
  step: number;
  setStep: (step: number) => void;
  files: PickedFile[];
  addFiles: (files: FileList | File[]) => void;
  removeFile: (index: number) => void;

  rows: Measurement[];
  originalRows: Measurement[];
  setRowValue: (index: number, value: string) => void;
  changes: Change[];
  selected: number;
  setSelected: (index: number) => void;
  warningOnly: boolean;
  setWarningOnly: (value: boolean) => void;
  resetConversion: () => void;

  waterSelection: Set<string>;
  toggleWaterItem: (name: string) => void;
  clearWaterItems: () => void;
  addWaterItems: (names: string[]) => void;

  toast: string;
  showToast: (text: string) => void;
  dialog: Dialog | null;
  showDialog: (title: string, text: string) => void;
  closeDialog: () => void;
}

const Context = createContext<AppState | null>(null);

const defaultSelected = (domain: Domain) => (domain === 'water' ? 3 : 0);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [domain, setDomainState] = useState<Domain>('water');
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [rows, setRows] = useState<Measurement[]>(() => structuredClone(measurements.water));
  const [originalRows, setOriginalRows] = useState<Measurement[]>(() => structuredClone(measurements.water));
  const [changes, setChanges] = useState<Change[]>([]);
  const [selected, setSelected] = useState(defaultSelected('water'));
  const [warningOnly, setWarningOnly] = useState(false);
  const [waterSelection, setWaterSelection] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  }, []);

  const showDialog = useCallback((title: string, text: string) => setDialog({ title, text }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const setDomain = useCallback((next: Domain) => {
    setDomainState(next);
    setRows(structuredClone(measurements[next]));
    setOriginalRows(structuredClone(measurements[next]));
    setSelected(defaultSelected(next));
    setChanges([]);
    setWarningOnly(false);
  }, []);

  // Built from the current list rather than inside a setState updater: the
  // updater runs later, so the messages below would read an empty error list.
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const errors: string[] = [];
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!/\.pdf$/i.test(file.name)) {
        errors.push(`${file.name}: PDF만 선택할 수 있습니다.`);
        continue;
      }
      if (file.size > 20 * 1048576) {
        errors.push(`${file.name}: 20MB를 초과합니다.`);
        continue;
      }
      if (next.length >= 50) {
        errors.push('최대 50개까지 선택할 수 있습니다.');
        break;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push({ name: file.name, size: file.size });
      }
    }
    setFiles(next);
    if (errors.length) showDialog('파일 선택 확인', errors.join(' '));
    else showToast('파일 목록에 반영했습니다. 서버로 전송되지 않습니다.');
  }, [files, showDialog, showToast]);

  const removeFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  const setRowValue = useCallback((index: number, value: string) => {
    setRows((current) => current.map((row, i) =>
      i === index ? { ...row, value, edited: value !== originalRows[index].value } : row));
    setChanges((current) => {
      const original = originalRows[index];
      const rest = current.filter((change) => change.name !== original.name);
      return value === original.value
        ? rest
        : [...rest, { name: original.name, before: original.value, after: value }];
    });
  }, [originalRows]);

  const resetConversion = useCallback(() => {
    setStep(1);
    setFiles([]);
    setChanges([]);
    setWaterSelection(new Set());
    setRows(structuredClone(measurements[domain]));
    setOriginalRows(structuredClone(measurements[domain]));
    setSelected(defaultSelected(domain));
  }, [domain]);

  const toggleWaterItem = useCallback((name: string) => {
    setWaterSelection((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const clearWaterItems = useCallback(() => setWaterSelection(new Set()), []);

  const addWaterItems = useCallback((names: string[]) => {
    setWaterSelection((current) => new Set([...current, ...names]));
  }, []);

  const value = useMemo<AppState>(() => ({
    domain, setDomain, step, setStep, files, addFiles, removeFile,
    rows, originalRows, setRowValue, changes, selected, setSelected,
    warningOnly, setWarningOnly, resetConversion,
    waterSelection, toggleWaterItem, clearWaterItems, addWaterItems,
    toast, showToast, dialog, showDialog, closeDialog,
  }), [domain, setDomain, step, files, addFiles, removeFile, rows, originalRows,
    setRowValue, changes, selected, warningOnly, resetConversion, waterSelection,
    toggleWaterItem, clearWaterItems, addWaterItems, toast, showToast, dialog,
    showDialog, closeDialog]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('AppStateProvider 안에서만 사용할 수 있습니다.');
  return value;
}
