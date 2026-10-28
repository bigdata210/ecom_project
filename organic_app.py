"""Offline PDF -> combined XLSX, preserving the supplied native Excel package."""
from __future__ import annotations
import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from organic_parser import merge_pdfs

S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
ET.register_namespace('', S)

def serialize(tree, original):
    """Keep namespace declarations referenced by Excel's mc:Ignorable metadata."""
    declarations=re.findall(rb'xmlns:([\w]+)="([^"]+)"',original)
    declarations=list(dict(declarations).items())
    for prefix,uri in declarations:
        if not re.fullmatch(rb'ns\d+',prefix):ET.register_namespace(prefix.decode(),uri.decode())
    data=ET.tostring(tree,encoding='utf-8',xml_declaration=True)
    root=re.search(rb'<(?!\?)[^>]+>',data)
    extra=b''.join(b' xmlns:'+prefix+b'="'+uri+b'"' for prefix,uri in declarations
                   if b'xmlns:'+prefix+b'=' not in root[0])
    return data[:root.end()-1]+extra+data[root.end()-1:]

def regression(points):
    x = [p['concentration'] for p in points]; y = [p['area'] for p in points]
    ax, ay = sum(x)/len(x), sum(y)/len(y)
    slope = sum((a-ax)*(b-ay) for a,b in zip(x,y))/sum((a-ax)**2 for a in x)
    if not slope:
        raise ValueError('검량선 기울기가 0입니다.')
    return slope, ay-slope*ax

def set_cell(sheet, address, value=None, formula=None, cached=None):
    data = sheet.find(f'{{{S}}}sheetData')
    row_number = int(re.search(r'\d+', address)[0])
    row = next((r for r in data if int(r.get('r')) == row_number), None)
    if row is None:
        row = ET.SubElement(data, f'{{{S}}}row', r=str(row_number))
        data[:] = sorted(data, key=lambda r:int(r.get('r')))
    cell = next((c for c in row if c.get('r') == address), None)
    if cell is None:
        cell = ET.SubElement(row, f'{{{S}}}c', r=address)
        def colnum(c):
            n=0
            for letter in re.match('[A-Z]+',c.get('r'))[0]: n=n*26+ord(letter)-64
            return n
        row[:] = sorted(row, key=colnum)
    for child in list(cell):
        if child.tag in {f'{{{S}}}f',f'{{{S}}}v',f'{{{S}}}is'}: cell.remove(child)
    cell.attrib.pop('t', None)
    if formula is not None:
        ET.SubElement(cell,f'{{{S}}}f').text=formula.lstrip('=')
        if cached is not None: ET.SubElement(cell,f'{{{S}}}v').text=repr(cached)
        else:
            cell.set('t','str'); ET.SubElement(cell,f'{{{S}}}v').text=''
    elif isinstance(value,str):
        cell.set('t','inlineStr'); ET.SubElement(ET.SubElement(cell,f'{{{S}}}is'),f'{{{S}}}t').text=value
    elif value is not None:
        ET.SubElement(cell,f'{{{S}}}v').text=repr(value)

def write_workbook(records, template, output):
    mapping = {r['sheet']:r for r in records}
    with zipfile.ZipFile(template) as archive:
        files = {n:archive.read(n) for n in archive.namelist()}
    wb = ET.fromstring(files['xl/workbook.xml'])
    rels=ET.fromstring(files['xl/_rels/workbook.xml.rels'])
    targets={r.get('Id'):r.get('Target') for r in rels}
    sheets={s.get('name'):s for s in wb.find(f'{{{S}}}sheets')}
    if set(mapping)-set(sheets):
        raise ValueError(f'양식에 없는 항목: {set(mapping)-set(sheets)}')
    for name,s in sheets.items():
        target=targets[s.get(f'{{{R}}}id')]
        target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
        tree=ET.fromstring(files[target]); record=mapping.get(name)
        # Remove prior batch inputs, cached results, response factors and regression helpers.
        for row in range(5,14):
            for col in ('A','B','H','I'): set_cell(tree,f'{col}{row}')
        for row in range(28,41):
            for col in ('H','I','J','K','L','M'): set_cell(tree,f'{col}{row}')
        for row in range(29,41):
            for col in ('A','B','C','D','E','F','G'): set_cell(tree,f'{col}{row}')
        set_cell(tree,'A29','시료명'); set_cell(tree,'B29','Area')
        set_cell(tree,'E29','최종결과(mg/L)'); set_cell(tree,'H29','상태')
        set_cell(tree,'E4','검량자료 입력' if record else 'PDF에 해당 항목 없음')
        set_cell(tree,'I4','Rsp.Factor' if record and record['kind']=='OP' else '기기(ug/L)')
        if record:
            slope, intercept=regression(record['standards'])
            for i,p in enumerate(record['standards'],5):
                set_cell(tree,f'A{i}',p['concentration']); set_cell(tree,f'B{i}',p['area'])
                set_cell(tree,f'I{i}',p.get('response_factor',p.get('reported')))
            set_cell(tree,'A4',f"Conc({record['unit']})")
            set_cell(tree,'J28','y (Area)'); set_cell(tree,'K28','a'); set_cell(tree,'L28','x (con)'); set_cell(tree,'M28','b')
            set_cell(tree,'K29',formula='SLOPE(B5:B9,A5:A9)',cached=slope)
            set_cell(tree,'M29',formula='INTERCEPT(B5:B9,A5:A9)',cached=intercept)
            samples=[p for p in record['samples'] if p['type']=='sample']
            if record['kind']=='OP':
                set_cell(tree,'H30','측정자료 없음')
            for i,p in enumerate(samples,30):
                if i>34: raise ValueError('현재 양식은 항목별 시료 5개까지 지원합니다.')
                short=re.search(r'[-_]GW(\d+)$',p['sample'])
                set_cell(tree,f'A{i}','GW-'+short[1] if short else p['sample']); set_cell(tree,f'B{i}',p['area'])
                set_cell(tree,f'H{i}','측정값 없음' if p['area'] is None else '계산 검토 필요')
                divisor=1000 if record['unit']=='ug/L' else 1
                cached=None if p['area'] is None else (p['area']-intercept)/slope/divisor
                set_cell(tree,f'E{i}',formula=f'IF(ISNUMBER(B{i}),(B{i}-$M$29)/$K$29/{divisor},"")',cached=cached)
            set_cell(tree,'A43','출처: '+Path(record['source']).name)
            set_cell(tree,'A44','검량선: 기존 양식의 표준 5점, 절편 포함. 기기 검량식과 차이 가능.')
            set_cell(tree,'A45','PDF의 빈 시료 값은 0 또는 불검출로 변환하지 않음.')
        else:
            set_cell(tree,'H30','원자료 없음')
        files[target]=serialize(tree,files[target])
    for definition in wb.iter(f'{{{S}}}definedName'):
        if definition.get('name')=='_xlnm.Print_Area':
            sheetname=list(sheets)[int(definition.get('localSheetId'))]
            definition.text="'"+sheetname.replace("'","''")+"'!$A$1:$I$45"
    calc=wb.find(f'{{{S}}}calcPr')
    if calc is None: calc=ET.SubElement(wb,f'{{{S}}}calcPr')
    calc.set('fullCalcOnLoad','1'); calc.set('forceFullCalc','1'); calc.set('calcMode','auto')
    files['xl/workbook.xml']=serialize(wb,files['xl/workbook.xml'])
    # Cached chart points belong to the previous batch. Rebuild from this batch's standards.
    C='http://schemas.openxmlformats.org/drawingml/2006/chart'
    for name in list(files):
        if name.startswith('xl/charts/chart') and name.endswith('.xml'):
            chart=ET.fromstring(files[name])
            for ref in chart.iter(f'{{{C}}}numRef'):
                f=ref.find(f'{{{C}}}f'); expression=f.text if f is not None else ''
                match=re.fullmatch(r"(?:'([^']+)'|([^!]+))!\$?([AB])\$?5:\$?\3\$?9",expression or '')
                for cache in list(ref):
                    if cache.tag==f'{{{C}}}numCache': ref.remove(cache)
                cache=ET.SubElement(ref,f'{{{C}}}numCache'); ET.SubElement(cache,f'{{{C}}}formatCode').text='General'
                item=mapping.get((match[1] or match[2]) if match else '')
                points=item['standards'] if item else []
                ET.SubElement(cache,f'{{{C}}}ptCount',val=str(len(points)))
                for index,p in enumerate(points):
                    pt=ET.SubElement(cache,f'{{{C}}}pt',idx=str(index))
                    ET.SubElement(pt,f'{{{C}}}v').text=repr(p['concentration'] if match[3]=='A' else p['area'])
            files[name]=serialize(chart,files[name])
    # Drop stale calc-chain safely along with its relationship and content type.
    files.pop('xl/calcChain.xml',None)
    for rel in list(rels):
        if rel.get('Type','').endswith('/calcChain'): rels.remove(rel)
    files['xl/_rels/workbook.xml.rels']=ET.tostring(rels,encoding='utf-8',xml_declaration=True)
    types=ET.fromstring(files['[Content_Types].xml'])
    for child in list(types):
        if child.get('PartName')=='/xl/calcChain.xml': types.remove(child)
    files['[Content_Types].xml']=ET.tostring(types,encoding='utf-8',xml_declaration=True)
    output=Path(output)
    if output.exists(): raise FileExistsError(f'기존 결과를 덮어쓰지 않습니다: {output}')
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for name,contents in files.items(): archive.writestr(name,contents)
    return output

def process(paths, out='output', template=None):
    records=merge_pdfs(paths)
    template=Path(template) if template else Path(getattr(sys,'_MEIPASS',Path(__file__).parent))/'templates'/'organic_template.xlsx'
    stamp=datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    destination=Path(out)/f'유기물_통합_{stamp}.xlsx'
    write_workbook(records,template,destination)
    destination.with_suffix('.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    return destination

def gui():
    import tkinter as tk
    from tkinter import filedialog,messagebox
    root=tk.Tk(); root.title('유기인 · VOC PDF 자동 통합'); root.geometry('610x220')
    tk.Label(root,text='유기인·VOC PDF를 함께 선택하면 내용을 자동 판별합니다.\n검량 데이터는 항목별 입력하고, 누락된 시료 결과는 빈칸으로 둡니다.',pady=20).pack()
    def start():
        paths=filedialog.askopenfilenames(filetypes=[('PDF','*.pdf')])
        if not paths:return
        out=filedialog.askdirectory(title='결과 저장 폴더')
        if not out:return
        try: result=process(paths,out);messagebox.showinfo('완료',str(result))
        except Exception as exc:messagebox.showerror('처리 중단',str(exc))
    tk.Button(root,text='PDF 여러 개 선택 → 통합 XLSX 저장',command=start,height=2).pack()
    root.mainloop()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('pdf',nargs='*');p.add_argument('--out',default='output');p.add_argument('--template')
    a=p.parse_args()
    if a.pdf:print(process(a.pdf,a.out,a.template))
    else:gui()
