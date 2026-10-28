# Render 웹 화면 미리보기 배포

이번 버전은 계획안의 화면과 이동 동선을 먼저 구현한 프리뷰다. Python FastAPI 서버가 HTML/CSS/JavaScript를 제공한다. 기존 변환 엔진은 유지하며 웹에서는 실제 파일 업로드, 로그인, LLM 호출, DB 저장을 실행하지 않는다.

## Render에 입력할 값

서비스 유형은 **Web Service**, 소스 저장소는 `bigdata210/ecom_project`, 브랜치는 `master`를 선택한다.

| 항목 | 입력값 |
|---|---|
| Language / Runtime | Python 3 |
| Root Directory | 비워 두기 (저장소 루트) |
| Build Command | `pip install -r requirements-web.txt` |
| Start Command | `uvicorn web_app:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

`$PORT`는 Render가 제공하는 포트 환경변수이므로 그대로 입력한다. API 키나 DB 환경변수는 이 화면 버전에 필요하지 않다. Python 버전은 `.python-version`의 3.12를 사용한다. 환경변수에서 다른 PYTHON_VERSION을 지정했다면 이 파일보다 우선하므로 확인한다.

기존 서비스의 Root Directory가 `web`으로 되어 있으면 비운다. `web_app.py`와 requirements 파일은 저장소 루트에 있다. 이미 서비스가 만들어졌다면 위 명령을 Settings에서 바꾸고 최신 커밋을 배포한다. 서비스 생성 화면이 아직 오류 상태였다면 명령을 채워 생성 절차를 마친다.

`render.yaml`에도 같은 설정을 포함했다. Blueprint 방식으로 배포할 때 참고할 수 있다. 서비스 요금제 선택 및 실제 서비스 생성은 Render에서 확인한다.

## 구현한 화면

- 대시보드: 4개 요약 카드, 분야 탭, 최근 작업, 날씨 카드.
- 변환하기: 분야 선택 → 로컬 파일 목록 → 예시 검수 → 저장 화면 미리보기.
- 검수: 예시 원문과 값 비교, 원문 행 강조, 값 수정, 변경 이력, 경고 필터.
- 작업 목록: 분야·상태·검색어 필터, 상태별 안내.
- 데이터 조회·추이: 항목·집계 예시 전환과 그래프.
- 기상정보: 지점 전환, 현재·과거 조회 화면과 예보 예시.
- 보관함: 확정된 예시 작업 목록.
- 업체 설정: 양식 목록, 셀 매핑 예시, 사용자·측정지점·사용량 화면.
- 데스크톱/모바일 반응형 레이아웃.

모든 수치와 문서는 예시이며 입력 파일을 분석한 결과가 아니다. 선택한 파일은 브라우저 메모리에만 두고 서버로 전송하지 않는다. 값 수정·양식 매핑은 새로고침 전의 화면 상태이며 실제 저장이 아니다. 실제 다운로드·초대·기상 조회 등의 버튼은 연결 예정 안내를 표시한다.

## 나중에 기능을 붙일 위치

| 파일 | 역할 |
|---|---|
| `web/index.html` | 공통 헤더, 메뉴, 본문 틀 |
| `web/styles.css` | 색상, 타이포그래피, 화면별·모바일 레이아웃 |
| `web/app.js` | 화면 렌더링, 검수·필터·선택 상태와 이벤트 |
| `web/data.js` | 예시 데이터 |
| `web/services.js` | 실제 API로 교체할 연결 지점 |
| `web_app.py` | Render 웹 실행 진입점, 정적 파일 제공, 상태 확인 |

API 단계에서 `services.js`의 `listJobs`, `getMeasurements`, `listTemplates`, `submitConversion`, `confirm`을 서버 요청으로 대체한다. 서버 인증·업체별 권한 검사는 별도로 구현해야 하며, 화면의 업체 드롭다운은 보안 경계가 아니다. 기존 Python 추출·작성 기능은 인증·저장소·대기열 설계 후 처리 서버에 연결한다.

## 로컬 실행

```powershell
python -m pip install -r requirements-web.txt
python -m uvicorn web_app:app --host 127.0.0.1 --port 8765
```

브라우저에서 `http://127.0.0.1:8765/`를 연다. 건강 상태는 `/health`에서 확인한다.

## 검증 기록

- 웹 서버 테스트 3개 통과: 첫 페이지와 정적 파일 제공, 상태 확인, 실제 업로드 API 미노출, 원본·환경파일 접근 불가.
- JavaScript 파일 문법 검사 통과.
- 브라우저에서 7개 메뉴 이동, 분야·상태 필터, 검수값 수정·이력·저장 화면 이동, 셀 매핑, 항목별 그래프, 기상·보관함 동작 확인.
- 1440px 데스크톱과 390px 모바일 화면을 점검하고 모바일 문서 가로 넘침을 수정.
- Render 운영 URL의 배포 성공 여부는 실제 서비스가 생성된 후 별도 확인한다.
