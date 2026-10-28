# 중금속 PDF 자동 입력 시제품

GitHub: https://github.com/bigdata210/ecom_project

현재 저장소는 기존 유기인·VOC·중금속 변환 코드와 웹 전환 설계 자료를 관리합니다. 홈페이지 구현 및 Vercel 배포는 후속 단계입니다. 원본 문서와 실제 Excel 양식은 저장소에서 제외하며, 양식 준비 방법은 [templates/README.md](templates/README.md)를 확인하세요.

> 현재 통합 버전은 **MeasurementPDF.exe**입니다. 유기인·VOC·중금속을 자동 판별하며 중금속은 XLSX 2개를 생성합니다. 최신 사용법은 [통합 버전 안내](MEASUREMENT_README.md)를 확인하세요. 아래는 초기 중금속 시제품 설명입니다.

인터넷 없이 Syngistix ICP PDF를 읽고, 기존 1차 XLSX 및 2차 XLS 양식에 입력하는 Windows용 코드입니다. 현재 제공된 PDF 형식과 As 193.696 / Cd 214.440 / Pb 220.353에 대응합니다.

## 실행

개발 PC에서 Python 3.12 이상을 설치한 뒤 아래 명령을 실행합니다.

```powershell
python -m pip install -r requirements.txt
python metal_app.py
```

창에서 1차 양식, 2차 양식, 저장 폴더를 지정합니다. 먼저 기본 선택된 **추출 검토만 실행**으로 PDF 여러 개를 선택해 CSV를 확인합니다. 선택을 해제하면 Excel 작성까지 실행합니다. PDF마다 별도 결과 폴더가 만들어집니다. 한 파일 실패 시 다음 PDF를 계속 처리합니다.

Excel 작성에는 Windows 데스크톱 Microsoft Excel이 필요합니다. 사용자가 로그인한 일반 데스크톱 환경에서 실행하세요. 서버나 서비스 계정 환경은 대상이 아닙니다. 추출 검토 기능은 Excel 없이 사용할 수 있습니다. 프로그램은 원본을 읽기 전용으로 열고 별도 파일에 저장합니다. Excel 외부 링크 업데이트와 매크로 실행을 차단합니다.

## 실행파일 빌드

```powershell
./build.ps1
```

`dist/MetalPDF.exe`를 배포합니다. 배포받는 PC에는 Python 설치가 필요 없으며 Excel 작성에는 Microsoft Excel이 필요합니다. 빌드는 개발 단계에서 의존성을 내려받지만, 배포한 프로그램은 네트워크를 사용하지 않습니다. 현재 전달물은 소스 시제품이며 EXE 빌드 및 배포 PC 검증은 아직 수행하지 않았습니다.

## 값과 셀의 연결

1차 파일의 기존 8개 시트를 유지합니다. 6개 측정 시트에서 A열 순번, B열 시료명, D열 시간, F/G열 데이터셋·메서드, H/I/J열 As/Cd/Pb를 입력합니다. 이전 측정 행은 지우고 이번 PDF의 검량 7건, W-BK 1건, 시료 10건을 씁니다. Internal Standards에는 행 순번을 갱신합니다. QC 시트는 유지합니다.

| 1차 시트 | 입력 내용 |
|---|---|
| Corrected Intensities | Mean Data의 보정 신호(cps) |
| Corrected Intensities RSDs | 검량은 PDF 표시 RSD, 시료는 반복 3회의 보정 신호로 표본표준편차/절대평균 계산 |
| Conc. in Calib Units | Mean Data의 Calib 농도(mg/L) |
| Conc. in Calib Units RSDs | 농도 RSD를 비율로 입력; 검량은 빈칸 |
| Conc. in Sample Units | Mean Data의 Sample 농도(mg/L); 검량은 빈칸 |
| Conc. in Sample Units RSDs | Sample 농도 RSD를 비율로 입력; 검량은 빈칸 |

2차 DATA!B2/F2/G2에 W-BK의 As/Cd/Pb 농도를 입력합니다. `w.As`, `W.Cd`, `W.Pb`의 B6:B11에는 검량표준 1~6의 보정 신호를 넣고, B5는 기존 양식의 0을 유지합니다. B31:B40에는 시료별 보정 신호를 입력합니다. C/D/E열의 기존 수식으로 농도, Blank, 최종 결과를 계산합니다. 기대한 수식이 없으면 임의 계산식을 만들지 않고 중단합니다.

시료명은 `NDG ` 접두어만 제거해 기존 A31:A40의 W-1~W-10과 비교합니다. 현재 2차 양식은 정확히 10개 시료에 대응합니다. 다른 개수나 시료명이면 자동 입력을 중단합니다. 하루 50개 PDF 처리는 파일별 반복으로 지원하지만, PDF 하나의 시료 수가 달라지면 행 확장과 수식·차트 범위 확장이 추가로 필요합니다.

## 반드시 알아야 할 차이

- 기기가 출력한 1차 Excel에는 PDF보다 더 많은 소수 자릿수가 있습니다. PDF의 표시값만 복원할 수 있습니다. RSD를 반복측정으로 재계산한 경우 반올림 오차가 추가됩니다.
- `>999.9%`는 상한 표시 그대로 텍스트로 저장합니다. 임의의 정확한 숫자로 변환하지 않습니다.
- 2차 예시의 값은 이번 PDF와 다릅니다. 새 검량 신호를 입력하면 최종 결과도 예시와 달라집니다.
- 2차의 Se, Zn 등 PDF에 없는 원소는 계산하지 않습니다. 해당 시트 제목을 `UNPROCESSED`로 표시하며 기존 예시 값은 남습니다. DATA 시트의 다른 원소 값도 기존 예시입니다. 현재 결과로 사용할 수 있는 것은 As/Cd/Pb 세 시트뿐입니다.
- 음수는 원본대로 보존합니다. 불검출 처리, 정량한계, 희석배수 및 보고용 반올림은 확인된 업무 규칙이 없어 추가하지 않았습니다.
- 2차 수식의 보존과 재계산은 native Excel로 수행합니다. 실제 Excel에서 전체 저장 흐름은 이 환경의 COM 실행 제한으로 검증하지 못했습니다. 추출 및 매핑 테스트만 통과했습니다. 운영 전 샘플 1건으로 Excel 수식, 결과, 차트를 확인해야 합니다.

## 명령행 / 검증

```powershell
python metal_app.py "중금속데이터.pdf" --extract-only --out output
python metal_app.py "중금속데이터.pdf" --first "중금속데이터_1차작성.xlsx" --second "중금속데이터_2차작성.xls" --out output
python -m unittest -v test_metal_app.py
```

각 결과 폴더의 `extracted.json`은 2차 웹/DB 개발에 재사용할 구조화 데이터이며 `검토.csv`는 검토용입니다. Excel 작성 실패 시 `excel.log`에 진단을 저장합니다. 파일과 문서 안의 텍스트는 추출 대상 데이터로만 사용하며 실행 지시로 해석하지 않습니다.
