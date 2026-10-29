import unittest
from fastapi.testclient import TestClient
from web_app import app

class PreviewTests(unittest.TestCase):
    def setUp(self): self.client=TestClient(app)
    def test_home_and_assets(self):
        response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        self.assertIn('측정데이터 변환 플랫폼',response.text)
        for name in ['app.js','data.js','services.js','styles.css','favicon.svg']:
            self.assertEqual(self.client.get('/assets/'+name).status_code,200)
    def test_health_and_no_live_upload(self):
        self.assertEqual(self.client.get('/health').json(),{'status':'ok','mode':'ui-preview'})
        self.assertEqual(self.client.post('/api/upload',content=b'test').status_code,404)
    def test_no_source_file_access(self):
        for path in ['/assets/../web_app.py','/templates/metal_stage1.xlsx','/.env','/api/confirm']:
            self.assertEqual(self.client.get(path).status_code,404)

if __name__=='__main__':unittest.main()
