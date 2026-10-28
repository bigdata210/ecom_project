$ErrorActionPreference='Stop'
python -m PyInstaller --noconfirm --clean --onefile --windowed --name MetalPDF --add-data 'fill_excel.ps1;.' metal_app.py
if($LASTEXITCODE -ne 0){throw 'Build failed'}
