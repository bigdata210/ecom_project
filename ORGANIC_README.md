# 유기인·VOC PDF 통합 자동 작성

`organic_app.py`는 파일명 대신 PDF 내용을 보고 ChemStation 유기인 검량표 또는 TurboMass VOC 보고서를 구분합니다. 여러 PDF를 선택하면 항목별로 기존 유기물 양식의 같은 이름 시트에 입력하고, 하나의 XLSX와 원자료 JSON을 저장합니다. 원본은 수정하지 않습니다. Excel이나 인터넷 없이 추출 및 XLSX 생성이 가능합니다.

## 실행

```powershell
python -m pip install -r requirements.txt
python organic_app.py
```

창에서 **PDF 여러 개 선택 → 통합 XLSX 저장**을 누르고 유기인·VOC PDF를 함께 선택한 뒤 저장 폴더를 지정합니다. 양식은 프로그램 옆 `templates/organic_template.xlsx`를 사용합니다. XLS 원본을 Excel로 변환한 양식이며 시트 순서·셀 서식·병합·차트가 포함되어 있습니다. 양식을 삭제하지 마세요.

```powershell
python organic_app.py "유기인데이터.pdf" "VOC데이터.pdf" --out output
```

새 결과 파일명을 매번 생성합니다. 같은 항목이 두 PDF에 중복되면 다른 배치가 섞이지 않도록 중단합니다. 분석 날짜가 다른 유기인·VOC는 항목별 별도 시트에 보관하며 시료가 동일하다고 추정해 결합하지 않습니다. 형식을 모르는 PDF, 검량점 누락, 새 항목은 오류로 알려줍니다.

## 입력한 항목과 위치

- 유기인: Diazinon, Parathion. `A5:A9` 농도(mg/L), `B5:B9` Area, `I5:I9` 응답계수.
- VOC: 1,1,1-Trichloroethane, Benzene, Trichloroethylene, Toluene, Tetrachloroethylene, Ethylbenzene, m,p-xylene, o-xylene. `A5:A9` 농도(ug/L), `B5:B9` Area, `I5:I9` PDF 마지막 열의 기기 표시농도(ug/L).
- `Trichloroethene`과 `Tetrachloroethene`은 양식의 `Trichloroethylene`, `Tetrachloroethylene`에 명시적으로 대응합니다.
- m,p-xylene 농도는 다른 VOC의 두 배인 10·20·40·100·200이며 PDF 값대로 입력합니다.
- VOC 시료명은 `A30:A34`에 GW-1~GW-5로 표시합니다. 전체 원본 시료명은 함께 저장하는 JSON에서 확인할 수 있습니다.
- `K29`와 `M29`는 기존 양식과 같은 표준 5점의 SLOPE·INTERCEPT 수식입니다. 기기 PDF의 검량식은 원점 포함 등 조건이 다를 수 있으므로 동일한 계수라고 가정하지 않습니다.
- 시료 Area가 실제로 있는 경우 `E30:E40`은 `(Area-절편)/기울기`로 계산하고 VOC는 ug/L에서 mg/L로 나누기 1000을 적용합니다. 희석배수, Blank 차감, 정량한계 및 불검출 변환은 추가하지 않습니다. 현재 파서는 샘플로 확인한 보고서 형식만 지원합니다.

## 이번 PDF에서 결과가 비어 있는 이유

유기인 PDF는 검량표뿐이므로 시료 측정 데이터가 없습니다. VOC PDF에는 BK1·BK2 및 시료 5개의 이름은 있지만 측정 숫자가 없습니다. 빈칸을 0이나 불검출로 취급하지 않습니다. 시료 결과는 빈칸으로 두고 H열에 상태를 표시합니다. 검량 데이터 50점은 입력하지만 최종 시료 결과를 만들 원자료는 추가로 필요합니다.

26개 시트와 차트는 유지합니다. PDF에 없는 나머지 16개 항목은 과거 예시 검량값·시료값·결과값을 지우고 원자료 없음으로 표시합니다. 기존 예시값이 새 결과로 오인되지 않도록 처리합니다. 원래 일부 VOC 시트에 있던 최종결과 단위는 출력에서 mg/L로 통일합니다.

## 배포

```powershell
./build_organic.ps1
```

빌드에 성공하면 `dist/OrganicPDF.exe`를 배포합니다. PDF 처리에는 Excel과 네트워크가 필요 없고, XLSX를 열 때 Excel에서 수식·차트를 다시 계산합니다.

## 검증

`python -m unittest -v test_organic.py`로 숫자 분할 처리, m,p-xylene 농도, 중복 파일 거부, 26개 시트/차트 보존, 미입력 항목 예시값 제거, 단위 변환식과 덮어쓰기 방지를 검증합니다. `openpyxl`은 개발 검증에만 사용하며 프로그램 실행 의존성이 아닙니다.

제공 샘플로 파일명 변경 후 형식 인식/추출/매핑/기존 중금속 회귀 테스트 총 7개를 통과했습니다. 생성한 XLSX는 Windows Excel에서 복구 모드 없이 열고 재계산·저장했으며, 26개 시트의 차트가 각각 1개씩 유지되는 것을 확인했습니다. 주요 수식 셀에 Excel 오류가 없고 최종 시료 결과는 빈칸입니다. 원래 숨겨져 있던 시트는 숨김 상태를 유지합니다.

`dist/OrganicPDF.exe` 빌드를 완료했고, 실제 EXE에 두 PDF 경로를 전달한 검증에서 종료 코드 0으로 XLSX 생성에 성공했습니다. 다른 PC에서의 실행과 파일 선택 창의 수동 조작은 별도 검증이 필요합니다. 이 EXE는 설치형이 아닌 단일 실행파일입니다. 더블클릭한 뒤 PDF를 선택해 사용합니다.

스캔 PDF/OCR, 보고서 열 위치 변경, 새 물질의 시트 매핑, 시료 5개 초과는 추가 구현이 필요합니다. 화면에서 여러 PDF를 하나의 작업으로 선택하세요. 내용이 같은 항목의 서로 다른 분석 배치는 별도 작업으로 처리하세요.
