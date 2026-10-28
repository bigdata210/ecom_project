"""One entry point: auto-detect OP/VOC/metals and produce their XLSX outputs."""
from __future__ import annotations
import argparse
import json
import queue
import re
import sys
import tempfile
import threading
from datetime import datetime
from pathlib import Path
import pdfplumber
from metal_app import parse_pdf
from metal_writer import write_metal
from organic_parser import parse_organic
from organic_app import write_workbook

def detect(path):
    with pdfplumber.open(path) as pdf:
        text='\n'.join(p.extract_text() or '' for p in pdf.pages[:2])
    if 'Sequence No.:' in text and 'Spectrometer:' in text and 'Mean Data:' in text:return '중금속'
    if 'ChemStation' in text and 'Calibration Table' in text:return '유기인'
    if 'TurboMass' in text and re.search(r'C\s*ompound\s+\d+:',text):return 'VOC'
    raise ValueError('지원 형식으로 인식되지 않습니다. 스캔본 또는 새 보고서 형식인지 확인하세요.')

def process_all(paths,out,notify=lambda text:None,templates=None):
    templates=Path(templates) if templates else Path(getattr(sys,'_MEIPASS',Path(__file__).parent))/'templates'
    output=Path(out)/('측정결과_'+datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    output.mkdir(parents=True,exist_ok=False)
    report={'files':[],'outputs':[],'errors':[]}
    groups=[]; seen=set()
    for index,path in enumerate(paths,1):
        path=Path(path).resolve()
        if path in seen:
            report['errors'].append({'source':str(path),'error':'같은 파일이 중복 선택되었습니다.'});continue
        seen.add(path)
        try:
            kind=detect(path)
            notify(f'{index}/{len(paths)} {path.name} → {kind}')
            entry={'source':str(path),'type':kind};report['files'].append(entry)
            if kind=='중금속':
                records=parse_pdf(path)
                prefix=f'{index:03d}_{path.stem}'
                with tempfile.TemporaryDirectory(dir=output) as temp:
                    names=[prefix+'_중금속_1차.xlsx',prefix+'_중금속_2차.xlsx']
                    written=write_metal(records,templates,Path(temp)/names[0],Path(temp)/names[1])
                    # Create published files in their destination so Windows
                    # inherits that folder's permissions, rather than temp ACLs.
                    for item in written:
                        with (output/item.name).open('xb') as target:target.write(item.read_bytes())
                report['outputs'].extend(names);entry['outputs']=names
                (output/(prefix+'_추출.json')).write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
            else:
                records=parse_organic(path)
                names={r['sheet'] for r in records}
                # One workbook can combine disjoint compounds. A second batch of
                # the same compound starts a separate workbook, never overwrites.
                group=next((g for g in groups if not(names & g['names'])),None)
                if group is None:group={'names':set(),'records':[],'entries':[]};groups.append(group)
                group['names'].update(names);group['records'].extend(records);group['entries'].append(entry)
        except Exception as exc:
            report['errors'].append({'source':str(path),'error':str(exc)});notify(f'{path.name}: {exc}')
    for index,group in enumerate(groups,1):
        name=f'유기물_통합_{index:02d}.xlsx'
        try:
            write_workbook(group['records'],templates/'organic_template.xlsx',output/name)
            report['outputs'].append(name)
            for entry in group['entries']:entry['outputs']=[name]
            (output/f'유기물_통합_{index:02d}_추출.json').write_text(json.dumps(group['records'],ensure_ascii=False,indent=2),encoding='utf-8')
        except Exception as exc:
            for entry in group['entries']:report['errors'].append({'source':entry['source'],'error':str(exc)})
    (output/'처리결과.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    text=['생성된 Excel 파일:']+report['outputs']+['','오류:']+[f"{e['source']}: {e['error']}" for e in report['errors']]
    (output/'처리결과.txt').write_text('\n'.join(text),encoding='utf-8-sig')
    return output,report

def gui():
    import tkinter as tk
    from tkinter import filedialog,messagebox,ttk
    root=tk.Tk();root.title('환경 측정 PDF → Excel 자동 작성');root.geometry('720x400')
    tk.Label(root,text='유기인 · VOC · 중금속 자동 판별',font=('맑은 고딕',16,'bold')).pack(pady=(22,10))
    tk.Label(root,text='PDF 여러 개를 선택하면 내용을 인식하여 Excel 양식에 입력합니다.\n유기인 + VOC → 통합 XLSX  /  중금속 PDF 1개 → 1차·2차 XLSX 2개').pack(pady=8)
    status=tk.StringVar(value='프로그램에 양식이 포함되어 있습니다. 인터넷과 Excel 설치 없이 생성합니다.')
    tk.Label(root,textvariable=status,wraplength=660,justify='left').pack(padx=20,pady=12)
    log=tk.Text(root,height=6,width=88,state='disabled');log.pack(padx=20,pady=8)
    events=queue.Queue()
    def start():
        paths=filedialog.askopenfilenames(title='유기인·VOC·중금속 PDF를 함께 선택',filetypes=[('PDF','*.pdf')])
        if not paths:return
        destination=filedialog.askdirectory(title='결과를 저장할 폴더')
        if not destination:return
        button.config(state='disabled');status.set('PDF를 확인하고 있습니다…')
        def worker():
            try:events.put(('done',process_all(paths,destination,lambda s:events.put(('log',s)))))
            except Exception as exc:events.put(('error',str(exc)))
        threading.Thread(target=worker,daemon=True).start()
    button=ttk.Button(root,text='PDF 선택 → 자동 판별 및 XLSX 만들기',command=start);button.pack(pady=12)
    def poll():
        try:
            while True:
                kind,value=events.get_nowait()
                if kind=='log':
                    status.set(value);log.config(state='normal');log.insert('end',value+'\n');log.see('end');log.config(state='disabled')
                elif kind=='done':
                    folder,report=value;button.config(state='normal')
                    status.set(f"완료: XLSX {len(report['outputs'])}개 / 오류 {len(report['errors'])}건\n{folder}")
                    messagebox.showinfo('처리 완료',f"XLSX {len(report['outputs'])}개 생성\n오류 {len(report['errors'])}건\n\n{folder}\n\n상세 내역은 처리결과.txt에서 확인하세요.")
                else:button.config(state='normal');messagebox.showerror('처리 실패',value)
        except queue.Empty:pass
        root.after(100,poll)
    poll();root.mainloop()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('pdf',nargs='*');parser.add_argument('--out',default='output')
    args=parser.parse_args()
    if args.pdf:
        folder,report=process_all(args.pdf,args.out)
        print(folder);sys.exit(1 if report['errors'] else 0)
    else:gui()
