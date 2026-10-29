# Vercel 배포

한 프로젝트에서 Next.js 화면과 Python Functions를 함께 빌드한다. 설계서 3장·9.4절의 구성이다.

- Git 저장소: bigdata210/ecom_project, 운영 브랜치: master
- Framework Preset: **Next.js** (자동 감지)
- Root Directory: 비워 두기 (저장소 루트)
- Build / Install / Output Command: Override를 끄고 기본값 사용
- Function Region: **Singapore (sin1)** — 설계서 9.4절. Supabase를 붙일 때 같은 지역으로 맞춘다

## 두 런타임이 한 프로젝트에 있는 구조

| 경로 | 빌드 주체 | 결과 |
|---|---|---|
| `app/`, `components/`, `lib/`, `public/` | Next.js | 화면 |
| `api/**/*.py` | Vercel Python 런타임 (`vercel.json`) | `/api/weather`, `/api/water/catalog`, `/api/water/summary` |

`vercel.json`이 `api/**/*.py`에 `includeFiles`(공유 모듈과 코드표), `excludeFiles`(Next.js 산출물), `maxDuration: 60`을 지정한다. 함수는 표준 라이브러리만 쓰므로 루트 `requirements.txt`는 비어 있다. 데스크톱 변환 프로그램 의존성은 `requirements-desktop.txt`로 분리했다.

**`app/api`에 route handler를 만들지 않는다.** 같은 경로의 Python Function을 가려 404가 난다. Next.js 쪽에서 서버 코드가 필요하면 `/api`가 아닌 다른 경로를 쓴다.

## 환경변수

Production에 등록한 후 **새로 배포해야** 적용된다. 키는 Python 함수에서만 읽으며 브라우저·GitHub에 넣지 않는다.

| 이름 | 용도 | 신청 |
|---|---|---|
| `data_api_key` | 기상청 단기예보 조회서비스 | [공공데이터포털 15084084](https://www.data.go.kr/data/15084084/openapi.do) |
| `water_api_key` | 국립환경과학원 수질 DB | 공공데이터포털 수질 DB 활용신청 |

## 첫 배포에서 반드시 확인할 것

이 저장소는 아직 Vercel에서 한 번도 Next.js로 빌드된 적이 없다. 배포 후 순서대로 확인한다.

1. 빌드 로그에 Next.js 빌드와 Python 함수 빌드가 **모두** 보이는지
2. `/` 에서 대시보드 화면, `/convert`·`/jobs`·`/analytics`·`/weather` 이동
3. `/api/water/catalog` 가 JSON을 반환하는지 (키 없이도 200)
4. `/api/weather?lat=37.5665&lon=126.978` 이 관측값을 반환하는지 (키 필요)
5. 함수 번들 크기와 콜드스타트 시간 — 설계서 3.3절의 상한 판단 근거
6. 전국 범위 수질 조회가 60초 안에 끝나는지. 초과하면 조회 범위를 좁히라는 504를 돌려준다

3~4번이 404라면 Python 함수가 빌드되지 않았거나 `app/api`와 경로가 겹친 것이다.

## 정리할 것

Vercel에 같은 저장소를 가리키는 프로젝트가 둘(`ecom_project`, `bigdata210-ecom_project`) 있다. 어느 쪽이 운영인지 정하고 나머지는 삭제한다. 환경변수가 양쪽에 중복 등록되어 있으면 키를 폐기할 때 한쪽이 남는다.

Vercel Hobby는 비상업 용도 한정이다. 사내 개발·검증까지는 Hobby로 진행하고, 가입 업체에 실제로 서비스를 제공하기 시작하면 Pro로 전환한다(설계서 3.3절).
