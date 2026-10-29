# Vercel 배포

저장소 루트를 Next.js 프로젝트 하나로 빌드한다. 공개데이터 조회는 Next.js Route Handler이며 별도 런타임이 없다.

- Git 저장소: bigdata210/ecom_project, 운영 브랜치: master
- Framework Preset: **Next.js** (자동 감지, `vercel.json`에도 명시)
- Root Directory: 비워 두기 (저장소 루트)
- Build / Install / Output Command: Override를 끄고 기본값 사용
- Function Region: **Singapore (sin1)** — 설계서 9.4절. Supabase를 붙일 때 같은 지역으로 맞춘다

## 환경변수

Production에 등록한 후 **새로 배포해야** 적용된다. 키는 서버에서만 읽으며 브라우저·GitHub에 넣지 않는다. 키가 없으면 해당 API는 503과 안내 문구를 돌려준다.

| 이름 | 용도 | 신청 |
|---|---|---|
| `data_api_key` | 기상청 단기예보 조회서비스 | [공공데이터포털 15084084](https://www.data.go.kr/data/15084084/openapi.do) |
| `water_api_key` | 국립환경과학원 수질 DB | 공공데이터포털 수질 DB 활용신청 |

## 배포 후 확인

1. `/` 에서 대시보드, `/convert`·`/jobs`·`/analytics`·`/weather` 이동
2. `/api/water/catalog` — 키 없이도 200 JSON
3. `/api/weather?lat=37.5665&lon=126.978` — 키가 있으면 관측값, 없으면 503
4. 전국 범위 수질 조회가 60초 안에 끝나는지. 조회 자체는 50초에 포기하고 범위를 좁히라는 504를 돌려준다

빌드 로그에 `ƒ /api/weather`, `ƒ /api/water/catalog`, `ƒ /api/water/summary`가 **Dynamic**으로 찍혀야 한다. 빠져 있으면 Route Handler가 등록되지 않은 것이다.

## Python을 쓰지 않는 이유 (2026-10-29 확인)

공개데이터 조회를 Vercel Python Functions(`api/*.py`)로 올리려다 세 번 실패하고 되돌렸다. 기록으로 남긴다.

| 시도 | 설정 | 결과 |
|---|---|---|
| 1 | `functions`에 `api/**/*.py` 글롭, `runtime` 없음 | 빌드 실패 |
| 2 | `functions` 제거 | 빌드 성공, 함수는 **배포되지 않음**. `/api/*`가 Next.js의 not-found로 응답 |
| 3 | `builds`로 `@vercel/next` + `@vercel/python` 명시 | 빌드 실패 |

2번이 핵심 근거다. `functions` 글롭은 Vercel이 이미 함수로 인식한 파일에만 매칭되는데 한 건도 매칭하지 못했다. 즉 **프레임워크 프로젝트에서는 `api/*.py`가 함수로 인식되지 않는다.**

그래서 조회 API는 Route Handler로 옮겼다. 설계서 7.3절도 기상청 조회의 호출 주체를 웹 서버로 적고 있어 설계와 더 맞다. pdfplumber·openpyxl이 필요한 **문서 처리 워커는 이 저장소의 Next.js 프로젝트에 넣지 말고** 컨테이너(Cloud Run 등)로 분리한다 — 설계서 3.3절이 예고한 전환을 앞당기는 셈이다.

## 정리할 것

Vercel에 같은 저장소를 가리키는 프로젝트가 둘 있다.

| 프로젝트 | 공개 도메인 | API 키 |
|---|---|---|
| `bigdata210-ecom_project` | `bigdata210-ecomproject.vercel.app` | `data_api_key`·`water_api_key` 등록됨 |
| `ecom_project` | 없음 (`ecomproject.vercel.app`은 타인이 선점) | 미확인 |

푸시마다 빌드가 두 번 돈다. `bigdata210-ecom_project`를 남기고 다른 하나는 삭제한다. 삭제 전에 환경변수에 키 사본이 남아 있는지 확인한다.

프리뷰 배포는 Vercel Authentication으로 보호되어 로그인 없이는 열람할 수 없다. 운영 도메인은 공개다.

Vercel Hobby는 비상업 용도 한정이다. 사내 개발·검증까지는 Hobby로 진행하고, 가입 업체에 실제로 서비스를 제공하기 시작하면 Pro로 전환한다(설계서 3.3절).
