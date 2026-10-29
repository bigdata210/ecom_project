# 정답 세트 (tests/fixtures)

설계서 10.1절의 비식별 정답 세트를 두는 자리입니다. 문서 종류(유기인·VOC·중금속·신규 형식)와 분야별로
**원본 · 수작업 정답 JSON · 정답 XLSX**를 한 세트로 만들고, 식별자는 치환한 뒤에만 커밋합니다.

현재는 비어 있습니다. 설계서 0단계에서 아래를 확보해야 추출 회귀 평가를 시작할 수 있습니다.

- 비식별 측정 원본 PDF 1건 이상 (문서 종류별)
- 같은 원본에 대한 수작업 정답 JSON
- 승인된 양식으로 작성한 정답 XLSX
- 측정기록부 실물 양식과 완성 예시

`.gitignore`가 `*.pdf`·`*.xlsx`를 제외하므로, 정답 세트를 추가할 때는 이 폴더 경로만 예외로 허용하고
식별 정보가 없는지 확인한 파일만 올립니다.

현재 실행 가능한 테스트는 저장소 루트에 있습니다.

```powershell
python -m unittest -v test_weather test_water
python -m unittest -v test_measurement test_organic test_metal_app
```
