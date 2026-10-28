"""Web entry point for the UI preview; no customer upload or data APIs."""
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from weather_api import router as weather_router

ROOT = Path(__file__).resolve().parent / 'web'
app = FastAPI(title='측정데이터 변환 플랫폼 · 화면 미리보기', docs_url=None, redoc_url=None)
app.include_router(weather_router)

@app.get('/health')
def health():
    return {'status': 'ok', 'mode': 'ui-preview'}

@app.get('/')
def home():
    return FileResponse(ROOT / 'index.html')

app.mount('/assets', StaticFiles(directory=ROOT), name='assets')
