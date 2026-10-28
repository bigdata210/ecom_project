"""Offline Syngistix PDF extraction and native Excel template filling."""
from __future__ import annotations
import argparse
import csv
import json
import re
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import pdfplumber

METALS = {'As': '193.696', 'Cd': '214.440', 'Pb': '220.353'}
NUM = r'[-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?'

def parse_pdf(path):
    with pdfplumber.open(path) as pdf:
        text = '\n'.join(p.extract_text() or '' for p in pdf.pages)
    method = re.search(r'^Method:\s*(\S+)', text, re.M)
    if not method:
        raise ValueError('지원하는 Syngistix PDF가 아니거나 텍스트가 없습니다.')
    records = []
    for block in re.split(r'(?=Sequence No\.:)', text)[1:]:
        identity = re.search(r'Sequence No\.:\s*(\d+).*?Sample ID:\s*(.*?)\s+Date Collected:\s*([^\n]+)', block, re.S)
        mean = re.search(r'Mean Data:\s*([^\n]+)\n(.*)', block, re.S)
        if not identity or not mean:
            raise ValueError('시료 정보 또는 Mean Data가 누락되었습니다.')
        seq, sample, collected = identity.groups()
        result = {'sequence': int(seq), 'sample': sample.strip(), 'time': collected.strip(), 'method': method[1], 'metals': {}}
        calibration = sample.startswith('Calib ')
        for metal, wavelength in METALS.items():
            line = re.search(r'^' + metal + r'\s+' + re.escape(wavelength) + r'\s+(.+)$', mean[2], re.M)
            if not line:
                raise ValueError(f'{sample}: {metal} 평균값 누락')
            fields = line[1].split()
            intensity = float(fields[0])
            if calibration:
                if len(fields) != 5 or fields[-1] != 'mg/L':
                    raise ValueError(f'{sample}: 검량 데이터 형식 변경')
                conc = float(fields[3].strip('[]'))
                sample_conc = None
                rsd_conc = None
                rsd_i = float(fields[2].rstrip('%')) / 100
            else:
                if len(fields) != 8 or fields[2] != 'mg/L' or fields[5] != 'mg/L':
                    raise ValueError(f'{sample}: 농도 데이터 형식 또는 단위 변경')
                conc, sample_conc = float(fields[1]), float(fields[4])
                rsd_conc = fields[7] if fields[7].startswith('>') else float(fields[7].rstrip('%')) / 100
                reps = re.findall(r'^\d+\s+' + metal + r'\s+' + re.escape(wavelength) + r'\s+(' + NUM + r')\s+(' + NUM + r')\s+', block.split('Mean Data:')[0], re.M)
                if len(reps) != 3:
                    raise ValueError(f'{sample}: {metal} 반복측정 3회 확인 실패')
                values = [float(x[1]) for x in reps]
                avg = statistics.mean(values)
                rsd_i = statistics.stdev(values) / abs(avg) if avg else None
            result['metals'][metal] = dict(intensity=intensity, conc=conc, sample_conc=sample_conc, rsd_i=rsd_i, rsd_conc=rsd_conc)
        records.append(result)
    if not records or len({r['sample'] for r in records}) != len(records):
        raise ValueError('시료가 없거나 중복된 시료명이 있습니다. 자동 입력을 중단합니다.')
    return records

def make_payload(records, first, second, output, prefix='NDG '):
    standards = [r for r in records if re.fullmatch(r'Calib Std [1-6]', r['sample'])]
    blanks = [r for r in records if r['sample'] == 'W-BK']
    samples = [r for r in records if not r['sample'].startswith('Calib ') and r['sample'] != 'W-BK']
    if len(standards) != 6 or len(blanks) != 1:
        raise ValueError('검량표준 1~6 및 W-BK 하나가 필요합니다.')
    normalized = [r['sample'].removeprefix(prefix) for r in samples]
    if len(set(normalized)) != len(normalized):
        raise ValueError('접두어 제거 후 시료명이 중복됩니다.')
    return dict(records=records, standards=standards, blank=blanks[0], samples=samples,
                normalized=normalized, first=str(Path(first).resolve()), second=str(Path(second).resolve()), output=str(output.resolve()))

def run(pdf, first, second, root, extract_only=False):
    records = parse_pdf(pdf)
    output = Path(root) / (Path(pdf).stem + '_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    output.mkdir(parents=True, exist_ok=False)
    (output/'extracted.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    with (output/'검토.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['시료', '항목', '보정신호(cps)', '농도(mg/L)', '시료농도(mg/L)', '농도RSD', '출처'])
        for r in records:
            for m, v in r['metals'].items():
                writer.writerow([r['sample'], m, v['intensity'], v['conc'], v['sample_conc'], v['rsd_conc'], str(pdf)])
    if not extract_only:
        payload = make_payload(records, first, second, output)
        payload_path = output/'job.json'
        payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8-sig')
        script = Path(getattr(sys, '_MEIPASS', Path(__file__).parent))/'fill_excel.ps1'
        process = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(script), '-Job', str(payload_path)], capture_output=True)
        (output/'excel.log').write_bytes(process.stdout + process.stderr)
        if process.returncode:
            raise RuntimeError(f'Excel 입력 실패. 검토용 추출자료는 저장했습니다: {output} (excel.log 확인)')
    return output

def gui():
    import tkinter as tk
    from tkinter import filedialog, messagebox
    root = tk.Tk(); root.title('중금속 PDF → Excel'); root.geometry('700x340')
    fields = {}
    for index, (key, title, filetypes) in enumerate([
        ('first', '1차 Excel 양식', [('Excel', '*.xlsx')]),
        ('second', '2차 Excel 양식', [('Excel', '*.xls')]),
        ('out', '저장 폴더', None)]):
        tk.Label(root, text=title).grid(row=index, column=0, padx=10, pady=12)
        value = tk.StringVar(); fields[key] = value
        tk.Entry(root, textvariable=value, width=65).grid(row=index, column=1)
        def select(v=value, ft=filetypes):
            p = filedialog.askopenfilename(filetypes=ft) if ft else filedialog.askdirectory()
            if p: v.set(p)
        tk.Button(root, text='선택', command=select).grid(row=index, column=2)
    only = tk.BooleanVar(value=True)
    tk.Checkbutton(root, text='추출 검토만 실행 (해제하면 Excel도 작성 / Microsoft Excel 필요)', variable=only).grid(row=3, columnspan=3, pady=10)
    status = tk.StringVar(value='PDF 표시 정밀도로 추출합니다. 원본 파일은 덮어쓰지 않습니다.')
    tk.Label(root, textvariable=status, wraplength=660).grid(row=5, columnspan=3, pady=12)
    def start():
        if not fields['out'].get() or (not only.get() and not all(fields[x].get() for x in ('first', 'second'))):
            messagebox.showerror('입력 확인', '저장 폴더와 필요한 Excel 양식을 선택하세요.'); return
        pdfs = filedialog.askopenfilenames(filetypes=[('PDF', '*.pdf')])
        errors = []
        for i, pdf in enumerate(pdfs, 1):
            status.set(f'{i}/{len(pdfs)} 처리 중: {Path(pdf).name}'); root.update_idletasks()
            try: run(pdf, fields['first'].get(), fields['second'].get(), fields['out'].get(), only.get())
            except Exception as e: errors.append(f'{Path(pdf).name}: {e}')
        status.set(f'완료 {len(pdfs)-len(errors)}건 / 실패 {len(errors)}건')
        if errors: messagebox.showerror('처리 결과', '\n'.join(errors))
    tk.Button(root, text='PDF 여러 개 선택하여 실행', command=start, height=2).grid(row=4, columnspan=3)
    root.mainloop()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', nargs='*'); parser.add_argument('--first'); parser.add_argument('--second')
    parser.add_argument('--out', default='output'); parser.add_argument('--extract-only', action='store_true')
    args = parser.parse_args()
    if not args.pdf: gui()
    else:
        for pdf in args.pdf:
            print(run(pdf, args.first, args.second, args.out, args.extract_only))
