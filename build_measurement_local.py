"""Build using the project's previously downloaded developer tooling."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'tmp'/'vendor'))
import PyInstaller.__main__
PyInstaller.__main__.run(['--noconfirm','--onefile','--windowed','--name','MeasurementPDF',
    '--exclude-module','pandas','--exclude-module','numpy','--exclude-module','matplotlib',
    '--exclude-module','scipy','--exclude-module','IPython','--exclude-module','pytest',
    '--add-data','templates;templates','measurement_app.py'])
