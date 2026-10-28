"""Strict, offline parsers for the supplied ChemStation and TurboMass layouts."""
import re
from pathlib import Path
import pdfplumber

N = r'[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?'
ALIASES = {'benzene': 'Benzene', 'Trichloroethene': 'Trichloroethylene',
           'Tetrachloroethene': 'Tetrachloroethylene'}

def number(value, context):
    if not re.fullmatch(N, value):
        raise ValueError(f'숫자 형식 확인 필요: {context}: {value!r}')
    return float(value)

def parse_organic(path):
    path = Path(path)
    with pdfplumber.open(path) as pdf:
        text = '\n'.join(p.extract_text() or '' for p in pdf.pages)
        if re.search(r'C\s*ompound\s+\d+:', text) and 'TurboMass' in text:
            return parse_voc(pdf.pages, path)
        if 'Calibration Table' in text and 'ChemStation' in text:
            return parse_op(text, path)
    raise ValueError(f'지원하지 않는 PDF 형식: {path.name}')

def parse_op(text, path):
    result = []
    current = None
    for line in text.split('Calibration Curves')[0].splitlines():
        start = re.fullmatch(rf'({N})\s+\d+\s+(\d+)\s+({N})\s+({N})\s+({N})\s+(?:Yes|No)\s+(?:Yes|No)\s+(.+)', line.strip())
        continuation = re.fullmatch(rf'(\d+)\s+({N})\s+({N})\s+({N})', line.strip())
        if start:
            rt, level, conc, area, factor, compound = start.groups()
            current = dict(compound=compound.strip(), sheet=ALIASES.get(compound.strip(), compound.strip()),
                           kind='OP', unit='mg/L', source=str(path.resolve()), standards=[], samples=[])
            result.append(current)
        elif continuation and current:
            level, conc, area, factor = continuation.groups()
            rt = None
        else:
            continue
        current['standards'].append(dict(level=int(level), concentration=float(conc), area=float(area),
                                         response_factor=float(factor), rt=float(rt) if rt else None))
    return validate(result)

def parse_voc(pages, path):
    results = []
    for page in pages:
        text = page.extract_text() or ''
        match = re.search(r'C\s*ompound\s+(\d+):\s*([^\n]+)', text)
        if not match:
            raise ValueError('VOC 페이지의 Compound 제목을 확인할 수 없습니다.')
        compound = match[2].strip()
        result = dict(compound=compound, sheet=ALIASES.get(compound, compound), kind='VOC', unit='ug/L',
                      source=str(path.resolve()), standards=[], samples=[])
        # The report draws numbers as spaced glyphs (e.g. "1 3542.234").
        # Read characters in separate column bounds instead of removing spaces from whole lines.
        words = page.extract_words()
        header = next((w for w in words if w['text'] == 'Name'), None)
        if not header or abs(header['x0'] - 19.1) > 3 or abs(page.width - 612) > 2:
            raise ValueError('VOC 열 위치가 샘플과 다릅니다. 열 매핑을 확인하세요.')
        for name in words:
            if name['x0'] < 15 or name['x0'] > 22 or name['top'] <= header['top'] or name['text'] == 'Name':
                continue
            chars = sorted([c for c in page.chars if abs(c['top'] - name['top']) < 2], key=lambda c:c['x0'])
            def column(left, right):
                return ''.join(c['text'] for c in chars if left <= c['x0'] < right).replace(' ', '').strip()
            row_type = column(260, 313)
            if row_type.startswith('Standard'):
                conc, rt, area, response, reported = [number(column(a,b), name['text']) for a,b in [(313,355),(355,405),(405,490),(490,568),(568,625)]]
                result['standards'].append(dict(level=len(result['standards'])+1, concentration=conc, area=area,
                                                rt=rt, response=response, reported=reported, sample=name['text']))
            elif row_type.startswith(('Analyte','Blank')):
                raw_area = column(405,490)
                result['samples'].append(dict(sample=name['text'], type='blank' if row_type.startswith('Blank') else 'sample',
                                               area=number(raw_area,name['text']) if raw_area else None,
                                               status='측정값 없음' if not raw_area else 'area'))
        results.append(result)
    return validate(results)

def validate(results):
    if not results:
        raise ValueError('검량 데이터를 확인할 수 없습니다.')
    for result in results:
        standards = result['standards']
        if len(standards) != 5 or len({s['concentration'] for s in standards}) != 5:
            raise ValueError(f"{result['compound']}: 검량표준 5개와 중복 없는 농도가 필요합니다.")
        names=[s['sample'] for s in result['samples']]
        if len(names)!=len(set(names)):
            raise ValueError(f"{result['compound']}: 중복 시료명")
    return results

def merge_pdfs(paths):
    results = {}
    for path in paths:
        for item in parse_organic(path):
            if item['sheet'] in results:
                raise ValueError(f"중복 항목: {item['sheet']}. 서로 다른 분석 배치는 별도로 처리하세요.")
            results[item['sheet']] = item
    return list(results.values())
