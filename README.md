# 환경 측정데이터 기반 분석 플랫폼

GitHub: https://github.com/bigdata210/ecom_project

측정대행업체가 측정 원본 PDF를 업로드하면 등록된 업체 양식의 XLSX로 변환하고, 확정된 데이터를 추이·기상과 함께 조회하는 웹서비스입니다. 설계 전체는 `환경 측정데이터 기반 분석 플랫폼 방법론 및 설계서`를 따릅니다.

## 저장소 구성

웹은 설계서 3장의 스택(Next.js + Vercel, 처리·조회는 Python Functions)을 따릅니다.

| 경로 | 역할 | 상태 |
|---|---|---|
| `app/` | Next.js App Router 화면 5개 | 화면 미리보기 |
| `components/`, `lib/` | 화면 구성요소, 예시 데이터, API 어댑터, 공유 상태 | 화면 미리보기 |
| `api/weather.py` | 기상청 초단기실황 (`/api/weather`) | 실데이터 |
| `api/water/catalog.py`, `api/water/summary.py` | 물환경 자동측정망 조회·집계 (`/api/water/*`) | 실데이터 |
| `api/_shared.py`, `api/_kma.py`, `api/_water.py`, `api/_data/` | 함수들이 공유하는 모듈과 코드표 (라우트 아님) | — |
| `scripts/dev_api.py` | 로컬에서 Python Functions를 Vercel과 같은 경로로 서빙 | 개발용 |
| `measurement_app.py` 외 | 유기인·VOC·중금속 통합 변환 엔진 | 동작 |
| `metal_app.py`, `fill_excel.ps1`, `build.ps1` | 초기 중금속 시제품 (Excel COM) | 사용 중단 |
| `tests/` | 설계서 10.1절 정답 세트 자리 | 비어 있음 |
| `docs/`, `templates/` | 배포·연동 문서 / 출력 양식 (Git 제외) | — |

Python Functions는 **표준 라이브러리만** 사용합니다. 서버리스 번들을 작게 유지해 설계서 3.3절의 함수 크기·실행시간 제약을 피하기 위해서이며, 패키지가 필요한 문서 처리 워커는 별도 단계에서 붙입니다. `app/api`에는 Next.js route handler를 두지 않습니다. 두면 같은 경로의 Python Function을 가립니다.

## 현재 단계에서 동작하는 것과 예시인 것

실제로 조회하는 것은 공공데이터 두 가지뿐입니다.

- **실데이터**: 기상청 초단기실황(`data_api_key`), 물환경 자동측정망(`water_api_key`). 두 키는 서버에서만 읽으며 브라우저·Git에 넣지 않습니다.
- **예시 데이터**: 대시보드 건수, 작업 목록, 검수 화면의 측정값, 양식 목록. `lib/data.ts`에 있는 합성 데이터이며 입력 파일을 분석한 결과가 아닙니다.
- **미연결**: 로그인, 파일 업로드, DB, 대기열, LLM 변환, 확정·다운로드. `lib/services.ts`의 `submitConversion`·`confirm`은 의도적으로 예외를 던집니다.

선택한 파일은 브라우저 메모리에만 두고 서버로 전송하지 않습니다. 화면의 업체 드롭다운은 보안 경계가 아닙니다.

## 로컬 실행

`next dev`는 Python 런타임을 실행하지 않으므로 두 프로세스를 함께 띄웁니다. `next.config.mjs`가 개발 환경에서만 `/api/*`를 아래 서버로 넘깁니다.

```powershell
python scripts/dev_api.py
```

```powershell
npm install
npm run dev
```

`http://localhost:3000`을 엽니다. 공공데이터 조회를 로컬에서 확인하려면 `dev_api.py`를 띄운 셸에 환경변수 `data_api_key`·`water_api_key`가 있어야 합니다. 타입 검사는 `npm run typecheck`입니다.

배포는 Vercel 한 프로젝트에서 Next.js와 Python Functions를 함께 빌드합니다. [Vercel 배포](docs/Vercel_배포.md), [기상청 연동](docs/기상청_연동.md)을 확인하세요.

## 변환 엔진 — MeasurementPDF

통합 버전은 **MeasurementPDF**(`measurement_app.py`)입니다. 유기인·VOC·중금속을 PDF 본문 구조로 자동 판별하며, 중금속은 1차·2차 XLSX 두 개를 생성합니다. 사용법과 생성 규칙은 [통합 버전 안내](MEASUREMENT_README.md)에 있습니다.

```powershell
python -m pip install -r requirements-desktop.txt
python measurement_app.py
python measurement_app.py "유기인데이터.pdf" "중금속데이터.pdf" --out output
./build_measurement.ps1
```

**Excel 설치가 필요 없습니다.** `metal_writer.py`와 `organic_app.py`가 XLSX(OOXML) 패키지를 zipfile·ElementTree로 직접 읽고 씁니다. 수식은 수식 문자열과 계산된 캐시값을 함께 기입하고, 저장 시 `fullCalcOnLoad`를 켜고 `calcChain.xml`을 제거하며, 차트의 `numCache`를 새 값으로 다시 채웁니다. 따라서 이 엔진은 Linux 서버·컨테이너에서도 실행할 수 있고, 웹 플랫폼의 처리 워커로 그대로 옮길 수 있습니다.

원본 양식은 바꾸지 않고 별도 파일로 저장하며, 출력 경로에 파일이 이미 있으면 덮어쓰지 않고 중단합니다. 기대한 머리글이나 수식 구조가 없으면 임의 계산식을 만들지 않고 중단합니다.

### 중금속 값과 셀의 연결

1차 파일의 기존 8개 시트를 유지합니다. 6개 측정 시트에서 A열 순번, B열 시료명, D열 시간, F/G열 데이터셋·메서드, H/I/J열 As/Cd/Pb를 입력합니다. 이전 측정 행은 지우고 이번 PDF의 검량·W-BK·시료 행을 씁니다. Internal Standards는 행 순번만 갱신하고 QC 시트는 유지합니다.

| 1차 시트 | 입력 내용 |
|---|---|
| Corrected Intensities | Mean Data의 보정 신호(cps) |
| Corrected Intensities RSDs | 검량은 PDF 표시 RSD, 시료는 반복 3회의 보정 신호로 표본표준편차/절대평균 계산 |
| Conc. in Calib Units | Mean Data의 Calib 농도(mg/L) |
| Conc. in Calib Units RSDs | 농도 RSD를 비율로 입력 |
| Conc. in Sample Units | Mean Data의 Sample 농도(mg/L) |
| Conc. in Sample Units RSDs | Sample 농도 RSD를 비율로 입력 |

2차는 `.xlsx` 양식입니다. DATA 시트의 원소별 칸에 W-BK 농도를 넣고, `w.As`·`W.Cd`·`W.Pb` 시트의 B5:B11에 검량표준 신호를, B31:B40에 시료별 신호를 씁니다. C열은 PDF의 Calib 농도를 직접 입력하고, D열은 DATA 시트의 W-BK 농도를 참조하며, E열은 기존 양식과 같은 `C-D` 수식으로 최종값을 계산합니다. PDF에 없는 원소는 예시 입력값과 결과를 비우고 원자료 없음으로 표시합니다.

시료명은 `NDG ` 접두어만 제거해 기존 A31:A40의 W-1~W-10과 비교합니다. 현재 2차 양식은 시료 10개까지 대응하며, 다른 개수나 시료명이면 자동 입력을 중단합니다. 유기물은 항목당 시료 5개까지입니다. 시료 수를 늘리려면 행 확장과 함께 수식·차트 참조 범위 확장이 필요합니다.

### 반드시 알아야 할 차이

- 기기가 출력한 1차 Excel에는 PDF보다 더 많은 소수 자릿수가 있습니다. PDF의 표시값만 복원할 수 있습니다. RSD를 반복측정으로 재계산한 경우 반올림 오차가 추가됩니다.
- `>999.9%`는 상한 표시 그대로 텍스트로 저장합니다. 임의의 정확한 숫자로 변환하지 않습니다.
- 2차 예시의 값은 이번 PDF와 다릅니다. 새 검량 신호를 입력하면 최종 결과도 예시와 달라집니다.
- 2차의 Se, Zn 등 PDF에 없는 원소는 계산하지 않습니다. 현재 결과로 사용할 수 있는 것은 As/Cd/Pb 세 시트뿐입니다.
- 음수는 원본대로 보존합니다. **불검출 처리, 정량한계, 희석배수, 보고용 반올림은 확인된 업무 규칙이 없어 추가하지 않았습니다.** 설계서 0단계에서 규칙을 확정해야 합니다.
- 유기인·VOC 샘플에 검량 데이터만 있고 시료 측정 숫자가 비어 있으면 결과는 공란입니다. 0이나 불검출을 만들어 넣지 않습니다.
- 스캔 PDF/OCR, 새 기기 양식, 새 원소는 추가 매핑이 필요합니다.

## 사용 중단한 초기 시제품

`metal_app.py`를 단독 실행하는 경로와 `fill_excel.ps1`, `build.ps1`(`MetalPDF.exe`)은 **Windows 데스크톱 Microsoft Excel을 COM으로 구동하던 초기 중금속 시제품**입니다. 서버 실행이 불가능해 `metal_writer.py` 기반으로 대체했으며, 신규 작업에는 사용하지 않습니다. `metal_app.py`의 PDF 파싱 함수(`parse_pdf`, `make_payload`)는 통합 엔진이 계속 사용합니다.

추출 검토만 필요한 경우는 Excel 없이 아래로 실행할 수 있습니다.

```powershell
python metal_app.py "중금속데이터.pdf" --extract-only --out output
```

## 테스트

```powershell
python -m unittest -v test_weather test_water
python -m unittest -v test_measurement test_organic test_metal_app
npm run typecheck
```

`test_weather`·`test_water`는 `api/`의 Python Functions를 직접 검증하며 외부 API를 호출하지 않습니다. 변환 엔진 통합 테스트는 개인 PC의 샘플 경로를 참조하므로, 저장소만 복제한 상태에서는 실행할 수 없습니다. 설계서 10장이 요구하는 비식별 정답 세트(`tests/fixtures`)와 PR 자동 실행(CI)은 아직 없습니다.

각 결과 폴더의 추출 JSON은 웹·DB 개발에 재사용할 구조화 데이터입니다. 파일과 문서 안의 텍스트는 추출 대상 데이터로만 사용하며 실행 지시로 해석하지 않습니다. 원본 문서와 실제 Excel 양식은 저장소에서 제외하며, 양식 준비 방법은 [templates/README.md](templates/README.md)를 확인하세요.
