# Vercel 화면 미리보기 배포

- Git 저장소: bigdata210/ecom_project, 운영 브랜치: master
- Framework Preset: FastAPI
- Root Directory: 비워 두기 (저장소 루트)
- Build Command / Install Command / Output Directory: Override를 끄고 기본값 사용
- 별도 Start Command는 입력하지 않음

루트의 pyproject.toml에서 웹 의존성과 Python 3.12, 실행 대상
`web_app:app`을 지정한다. `test_web:app`은 테스트 모듈이므로 지정하지 않는다.
requirements.txt는 기존 데스크톱 변환 프로그램용이고 requirements-web.txt는
로컬/Render 실행용이다. Vercel 웹 배포는 pyproject.toml을 기준으로 한다.

GitHub에 변경 사항이 반영된 최신 커밋으로 배포한다. 과거 실패 커밋을
그대로 재배포하면 새 설정이 포함되지 않는다.
배포 후 `/`에서 화면, `/health`에서 상태 JSON, `/assets/styles.css`에서
스타일 파일 응답을 확인한다.

현재는 예시 데이터로 동작하는 화면 미리보기이며 로그인, 실제 업로드,
LLM 변환, DB 저장 기능은 아직 연결되어 있지 않다.
