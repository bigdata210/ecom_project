"""Build helper for the bundled development runtime in this workspace."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'tmp'/'vendor'))
import PyInstaller.__main__
PyInstaller.__main__.run(['--noconfirm','--onefile','--windowed','--name','OrganicPDF',
    '--exclude-module','pandas','--exclude-module','numpy','--exclude-module','matplotlib',
    '--exclude-module','scipy','--exclude-module','IPython','--exclude-module','pytest',
    '--add-data','templates/organic_template.xlsx;templates','organic_app.py'])
