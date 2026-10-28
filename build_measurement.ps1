$ErrorActionPreference='Stop'
python -m PyInstaller --noconfirm --onefile --windowed --name MeasurementPDF --exclude-module pandas --exclude-module numpy --exclude-module matplotlib --exclude-module scipy --exclude-module IPython --exclude-module pytest --add-data 'templates;templates' measurement_app.py
if($LASTEXITCODE -ne 0){throw 'Build failed'}
