# env
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install aiohttp beautifulsoup4 lxml

# run（请先在 main.py 里把 DEFAULT_COOKIE 换成最新 Cookie 或设置环境变量 JX_COOKIE）
python main.py

pause