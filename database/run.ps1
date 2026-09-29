# env
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install aiohttp beautifulsoup4 lxml

# cookie
$env:JX_COOKIE = 'connect.sid=...; io=...; sidebar_collapsed=false; event_filter=all; login=%5B%22bozrd%22%2C%229e25bde06d5a564a75b905033c3f4940%22%5D'
$env:USERS_DB_KEY = 'base64url-fernet-key'

# run
python main.py

# 只补全缺失的毕业年份（新用户 name 留空，等抓姓名时再补）
# python fill_graduate_years.py --dry-run
# python fill_graduate_years.py

# optional: decrypt for local debugging (same key required)
# python users_crypto_cli.py decrypt --input ../Better-Names-for-7FA4/data/users.json --output ../Better-Names-for-7FA4/data/users.decrypted.json

pause
