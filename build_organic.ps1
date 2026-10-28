$ErrorActionPreference='Stop'
python -m PyInstaller --noconfirm --clean --onefile --windowed --name OrganicPDF --exclude-module pandas --exclude-module numpy --exclude-module matplotlib --exclude-module scipy --exclude-module IPython --exclude-module pytest --add-data 'templates/organic_template.xlsx;templates' organic_app.py
if($LASTEXITCODE -ne 0){throw 'Build failed'}
