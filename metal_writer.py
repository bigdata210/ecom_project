"""Write both heavy-metal XLSX templates without requiring Microsoft Excel."""
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from organic_app import S, R, serialize, set_cell
from metal_app import make_payload

C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'

class Package:
    def __init__(self,path):
        with zipfile.ZipFile(path) as z:self.files={n:z.read(n) for n in z.namelist()}
        self.wb=ET.fromstring(self.files['xl/workbook.xml'])
        rels=ET.fromstring(self.files['xl/_rels/workbook.xml.rels'])
        targets={r.get('Id'):r.get('Target') for r in rels}
        self.paths={}
        for s in self.wb.find(f'{{{S}}}sheets'):
            target=targets[s.get(f'{{{R}}}id')]
            self.paths[s.get('name')]=target.lstrip('/') if target.startswith('/') else 'xl/'+target
        self.sheets={name:ET.fromstring(self.files[path]) for name,path in self.paths.items()}
        self.strings=[]
        if 'xl/sharedStrings.xml' in self.files:
            self.strings=[''.join(n.itertext()) for n in ET.fromstring(self.files['xl/sharedStrings.xml'])]

    def value(self,name,address):
        cell=self.sheets[name].find(f'.//{{{S}}}c[@r="{address}"]')
        if cell is None:return None
        if cell.get('t')=='inlineStr':return ''.join(cell.find(f'{{{S}}}is').itertext())
        node=cell.find(f'{{{S}}}v')
        if node is None or node.text is None:return None
        if cell.get('t')=='s':return self.strings[int(node.text)]
        if cell.get('t')=='str':return node.text
        return float(node.text)

    def put(self,name,address,value=None,formula=None,cached=None):
        set_cell(self.sheets[name],address,value,formula,cached)

    def clear_existing(self,name,start_row,columns):
        for cell in list(self.sheets[name].iter(f'{{{S}}}c')):
            address=cell.get('r'); match=re.fullmatch(r'([A-Z]+)(\d+)',address)
            if int(match[2])>=start_row and match[1] in columns:self.put(name,address)

    def save(self,path):
        for name,sheet in self.sheets.items():
            # Keep the worksheet's declared used range in sync with added cells.
            addresses=[c.get('r') for c in sheet.iter(f'{{{S}}}c')]
            last=max((int(re.search(r'\d+',a)[0]) for a in addresses),default=1)
            dim=sheet.find(f'{{{S}}}dimension')
            if dim is not None:
                old=dim.get('ref').split(':')[-1]
                dim.set('ref','A1:'+re.match('[A-Z]+',old)[0]+str(last))
            self.files[self.paths[name]]=serialize(sheet,self.files[self.paths[name]])
        calc=self.wb.find(f'{{{S}}}calcPr')
        if calc is None:calc=ET.SubElement(self.wb,f'{{{S}}}calcPr')
        calc.set('fullCalcOnLoad','1');calc.set('forceFullCalc','1');calc.set('calcMode','auto')
        self.files['xl/workbook.xml']=serialize(self.wb,self.files['xl/workbook.xml'])
        self.files.pop('xl/calcChain.xml',None)
        for filename,ending in [('xl/_rels/workbook.xml.rels','/calcChain'),('[Content_Types].xml','/xl/calcChain.xml')]:
            tree=ET.fromstring(self.files[filename])
            for child in list(tree):
                if child.get('Type','').endswith(ending) or child.get('PartName')==ending:tree.remove(child)
            self.files[filename]=serialize(tree,self.files[filename])
        self.refresh_charts()
        path=Path(path)
        if path.exists():raise FileExistsError(path)
        with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
            for name,data in self.files.items():z.writestr(name,data)
        return path

    def refresh_charts(self):
        for filename in list(self.files):
            if not(filename.startswith('xl/charts/chart') and filename.endswith('.xml')):continue
            chart=ET.fromstring(self.files[filename])
            for ref in chart.iter(f'{{{C}}}numRef'):
                f=ref.find(f'{{{C}}}f')
                match=re.fullmatch(r"(?:'([^']+)'|([^!]+))!\$?([A-Z]+)\$?(\d+):\$?\3\$?(\d+)",f.text or '') if f is not None else None
                if not match:raise ValueError(f'지원하지 않는 차트 참조: {f.text if f is not None else filename}')
                name=match[1] or match[2]
                for child in list(ref):
                    if child.tag==f'{{{C}}}numCache':ref.remove(child)
                cache=ET.SubElement(ref,f'{{{C}}}numCache')
                ET.SubElement(cache,f'{{{C}}}formatCode').text='General'
                values=[self.value(name,f'{match[3]}{r}') for r in range(int(match[4]),int(match[5])+1)]
                ET.SubElement(cache,f'{{{C}}}ptCount',val=str(len(values)))
                for index,value in enumerate(values):
                    if isinstance(value,(int,float)):
                        p=ET.SubElement(cache,f'{{{C}}}pt',idx=str(index));ET.SubElement(p,f'{{{C}}}v').text=repr(value)
            self.files[filename]=serialize(chart,self.files[filename])

FIELDS={'Corrected Intensities':'intensity','Corrected Intensities RSDs':'rsd_i',
        'Conc. in Calib Units':'conc','Conc. in Calib Units RSDs':'rsd_conc',
        'Conc. in Sample Units':'sample_conc','Conc. in Sample Units RSDs':'rsd_conc'}

def write_metal(records,templates,first_path,second_path):
    templates=Path(templates)
    payload=make_payload(records,templates/'metal_stage1.xlsx',templates/'metal_stage2.xlsx',Path(first_path).parent)
    samples=payload['samples']
    if len(samples)>10:raise ValueError('현재 중금속 2차 양식은 시료 10개까지 지원합니다.')
    first=Package(templates/'metal_stage1.xlsx')
    for name,field in FIELDS.items():
        if first.value(name,'B1')!='Sample Id':raise ValueError('1차 양식 시료명 머리글 불일치')
        for col,metal in zip('HIJ',('As','Cd','Pb')):
            if not str(first.value(name,col+'1')).startswith(metal+' '):raise ValueError('1차 원소 머리글 불일치')
        first.clear_existing(name,2,set('ABCDEFGHIJ'))
        for i,r in enumerate(records,2):
            for col,value in [('A',r['sequence']),('B',r['sample']),('D',r['time']),('F',r['method']),('G',r['method'])]:first.put(name,f'{col}{i}',value)
            for col,metal in zip('HIJ',('As','Cd','Pb')):first.put(name,f'{col}{i}',r['metals'][metal][field])
    first.clear_existing('Internal Standards',2,{'A'})
    for i in range(len(records)):first.put('Internal Standards',f'A{i+2}',i+1)

    second=Package(templates/'metal_stage2.xlsx')
    for row,cols in [(2,'BCDEFGHIJKLMN'),(7,'BCDEFGHI')]:
        for col in cols:second.put('DATA',f'{col}{row}')
    second.put('DATA','A3','이번 PDF에 없는 원소는 미입력')
    sheets={'As':('w.As','B','B'),'Cd':('W.Cd','F','D'),'Pb':('W.Pb','G','E')}
    for name in second.sheets:
        if name=='DATA':continue
        # Clear example calibrations and results, including cached formula values.
        for row in range(5,14):second.put(name,f'B{row}')
        header=next((row for row in (28,29,30) if '최종' in str(second.value(name,f'E{row}'))),None)
        if header is None:raise ValueError(f'2차 결과 머리글 확인 필요: {name}')
        second.clear_existing(name,header+1,{'A','B','C','D','E'})
        second.put(name,'A2','PDF 원자료 없음' if name not in {v[0] for v in sheets.values()} else 'PDF 측정값 입력')
    for metal,(name,data_col,summary_col) in sheets.items():
        if not str(second.value('DATA',data_col+'1')).startswith(metal+' '):raise ValueError('2차 DATA 원소 불일치')
        blank=payload['blank']['metals'][metal]['conc']
        second.put('DATA',data_col+'2',blank)
        second.put('DATA',summary_col+'7',formula=f'{data_col}2',cached=blank)
        second.put(name,'B5',0)
        for r in payload['standards']:
            index=int(r['sample'].rsplit(' ',1)[1]);row=index+5
            if abs(second.value(name,f'A{row}')-r['metals'][metal]['conc'])>1e-8:raise ValueError('검량표준 농도 불일치')
            second.put(name,f'B{row}',r['metals'][metal]['intensity'])
        for index,r in enumerate(samples,31):
            concentration=r['metals'][metal]['conc']
            second.put(name,f'A{index}',r['sample'].removeprefix('NDG '))
            second.put(name,f'B{index}',r['metals'][metal]['intensity'])
            second.put(name,f'C{index}',concentration)
            second.put(name,f'D{index}',formula=f'DATA!${data_col}$2',cached=blank)
            second.put(name,f'E{index}',formula=f'C{index}-D{index}',cached=concentration-blank)
    # Validate both outputs in memory before publishing a pair.
    first.save(first_path)
    second.save(second_path)
    return Path(first_path),Path(second_path)
