# env
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install aiohttp beautifulsoup4 lxml

# cookie
$env:JX_COOKIE = 'connect.sid=...; io=...; sidebar_collapsed=false; event_filter=all; login=%5B%22board%22%2C%2283393899d725503cb8beae5b015b75df%22%5D'

# run
python main.py

pause