# -*- coding: utf-8 -*-
import asyncio
import aiohttp
import json
import os
import re
import time
from pathlib import Path
from typing import Dict, Optional
from bs4 import BeautifulSoup

BASE = "http://jx.7fa4.cn:8888"

UID_START = 1
DATA_DIR = Path(__file__).resolve().parents[1] / 'Better-Names-for-7FA4' / 'data'

# 并发、超时、重试
CONCURRENCY = 20
REQUEST_TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF = (0.6, 1.2, 2.5)

# -------------------- 认证与请求头 --------------------
# 直接将数据库需要的 Cookie 写在这里，避免每次都去 PowerShell 里设置。
# 如需更新，只要把浏览器里最新的 Cookie 覆盖到 DEFAULT_COOKIE 即可，
# 或者通过设置环境变量 JX_COOKIE 来覆盖默认值。
DEFAULT_COOKIE = (
    "connect.sid=...; io=...; sidebar_collapsed=false; event_filter=all; "
    "login=%5B%22board%22%2C%2283393899d725503cb8beae5b015b75df%22%5D"
)
COOKIE_STR = os.environ.get("JX_COOKIE", DEFAULT_COOKIE).strip()
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "X-Requested-With": "XMLHttpRequest",  # 模拟 XHR
    "Cookie": COOKIE_STR,
}

GRADE_TO_COLORKEY = {
    "小四": "x4", "小五": "x5", "小六": "x6",
    "初一": "c1", "初二": "c2", "初三": "c3",
    "高一": "g1", "高二": "g2", "高三": "g3",
    "大一": "d1", "大二": "d2", "大三": "d3", "大四": "d4",
    "毕业": "by", "教练": "jl", "教师": "jl", "其他": "uk",
}
ALT_TEXT = {"大  一": "大一", "大  二": "大二", "大  三": "大三", "大  四": "大四", "教  练": "教练", "其  他": "其他"}
SPECIAL_JL_NAMES = {"陈许旻", "程宇轩", "钟胡天翔", "陈恒宇", "徐淑君", "徐苒茨", "王多灵", "李雪梅"}
SPECIAL_UID_OVERRIDES = {
    1340: {"name": "board", "colorKey": "jl"},
}

def build_user_plan_url(uid: int) -> str:
    # 这个接口示例：/user_plan?user_id=650&date=1757928000&type=day&format=td
    # date 用当前时间戳即可
    ts = int(time.time())
    return f"{BASE}/user_plan?user_id={uid}&date={ts}&type=day&format=td"

class AuthError(RuntimeError):
    """Raised when the response indicates that authentication is required."""


AUTH_FAILURE_TIP = (
    "❌ 看起来未登录。请在 main.py 里的 DEFAULT_COOKIE 粘贴最新 Cookie，"
    "或者设置环境变量 JX_COOKIE（示例：export JX_COOKIE='connect.sid=...'），然后重新运行：python main.py。\n"
    "Cookie 可以在浏览器 DevTools 的任一请求里复制整段。"
)


async def fetch_text(session: aiohttp.ClientSession, url: str, referer: Optional[str] = None) -> Optional[str]:
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, headers=headers, timeout=timeout) as resp:
                if resp.status in {401, 403}:
                    raise AuthError
                if resp.status in {301, 302, 303, 307, 308}:
                    location = resp.headers.get("Location", "")
                    if "login" in location.lower():
                        raise AuthError
                # 未登录通常会 200 返回登录页或 302 跳转
                text = await resp.text()
                if looks_like_login_page(text):
                    raise AuthError
                return text
        except AuthError:
            raise
        except Exception:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_BACKOFF[min(attempt, len(RETRY_BACKOFF) - 1)])
            else:
                return None
    return None

def looks_like_login_page(html: str) -> bool:
    # 粗略判断是否是登录页
    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.get_text(strip=True) if soup.title else "").lower()
    body_text = soup.get_text(" ", strip=True)
    normalized = body_text.lower()
    keywords = ["登录", "登陆", "帐号", "账号", "密码", "请先登录", "sign in", "log in"]
    matches = 0
    for kw in keywords:
        if kw in body_text or kw in normalized:
            matches += 1
    if matches >= 2:
        return True
    if soup.find("form", attrs={"action": re.compile("login", re.I)}):
        return True
    if soup.find("input", attrs={"type": "password"}):
        return True
    return "login" in title

def extract_name_from_user_plan(html: str) -> Optional[str]:
    # XHR 返回的 HTML 片段里，第一个 <td> 形如：
    # 2025-09-16\n-牟益
    soup = BeautifulSoup(html, "lxml")
    td = soup.find("td")
    if not td:
        return None
    lines = [ln.strip() for ln in td.get_text("\n").splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", ln):
            if i + 1 < len(lines):
                return re.sub(r"^-+\s*", "", lines[i + 1]).strip() or None
            break
    m = re.search(r"\n-\s*([^\n<]+)", td.get_text("\n"))
    return m.group(1).strip() if m else None

def extract_uid_and_colorkey_from_ranklist(html: str) -> Dict[int, str]:
    soup = BeautifulSoup(html, "lxml")
    result: Dict[int, str] = {}
    for tr in soup.select("tr"):
        a = tr.select_one("td.cell.username a[href^='/user/']")
        if not a or not a.get("href"):
            continue
        m = re.search(r"/user/(\d+)", a["href"])
        if not m:
            continue
        uid = int(m.group(1))
        td_grade = tr.select_one("td.graduate_year")
        if not td_grade:
            continue
        txt = td_grade.get_text(strip=True)
        txt = ALT_TEXT.get(txt, txt)
        colorkey = GRADE_TO_COLORKEY.get(txt)
        if colorkey:
            result[uid] = colorkey
    return result

def load_existing_max_uid() -> int:
    path = DATA_DIR / "users.json"
    if not path.exists():
        return 0
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return 0
    if isinstance(data, dict):
        max_uid = 0
        for key in data.keys():
            try:
                max_uid = max(max_uid, int(key))
            except (TypeError, ValueError):
                continue
        return max_uid
    return 0

def extract_total_ranklist_pages(html: str) -> int:
    soup = BeautifulSoup(html, "lxml")
    pages = []
    for a in soup.select("a[href*='ranklist']"):
        text = a.get_text(strip=True)
        if text.isdigit():
            pages.append(int(text))
    return max(pages) if pages else 1

async def ensure_auth(session: aiohttp.ClientSession) -> str:
    """
    先拉一个 ranklist 页面，判断是否已登录。
    """
    if not COOKIE_STR or "..." in COOKIE_STR:
        raise SystemExit(
            "❌ DEFAULT_COOKIE 仍是占位符。请粘贴真实 Cookie（或设置环境变量 JX_COOKIE）后再运行。"
        )
    try:
        html = await fetch_text(session, f"{BASE}/ranklist?page=1")
    except AuthError as exc:
        raise SystemExit(AUTH_FAILURE_TIP) from exc
    if not html:
        raise SystemExit("❌ 无法访问站点（网络或超时）。")
    return html

async def crawl_names(initial_end: int) -> Dict[int, str]:
    sem = asyncio.Semaphore(CONCURRENCY)
    out: Dict[int, str] = {}
    async with aiohttp.ClientSession() as session:
        _ = await ensure_auth(session)

        async def one(uid: int) -> bool:
            url = build_user_plan_url(uid)
            referer = f"{BASE}/user_plans/{uid}"
            async with sem:
                try:
                    html = await fetch_text(session, url, referer=referer)
                except AuthError as exc:
                    raise SystemExit(AUTH_FAILURE_TIP) from exc
            if not html:
                return False
            name = extract_name_from_user_plan(html)
            if name:
                out[uid] = name
                return True
            return False

        existing_max = load_existing_max_uid()
        target_end = max(initial_end, existing_max, UID_START - 1)
        if target_end >= UID_START:
            tasks = [asyncio.create_task(one(uid)) for uid in range(UID_START, target_end + 1)]
            total = target_end - UID_START + 1
            done = 0
            for fut in asyncio.as_completed(tasks):
                await fut
                done += 1
                if done % 200 == 0 or done == total:
                    print(f"[names] {done}/{total}")

        next_uid = max(target_end + 1, UID_START)
        while True:
            success = await one(next_uid)
            if not success:
                break
            next_uid += 1
            if (next_uid - target_end - 1) % 100 == 0:
                print(f"[names] 扩展到 UID {next_uid - 1}")
    return out

async def crawl_colorkeys() -> Dict[int, str]:
    sem = asyncio.Semaphore(CONCURRENCY)
    out: Dict[int, str] = {}
    async with aiohttp.ClientSession() as session:
        first_html = await ensure_auth(session)
        total_pages = extract_total_ranklist_pages(first_html)
        print(f"[rank] 发现 {total_pages} 页")
        out.update(extract_uid_and_colorkey_from_ranklist(first_html))

        async def one(page: int):
            url = f"{BASE}/ranklist?page={page}"
            async with sem:
                try:
                    html = await fetch_text(session, url)
                except AuthError as exc:
                    raise SystemExit(AUTH_FAILURE_TIP) from exc
            if not html:
                return
            out.update(extract_uid_and_colorkey_from_ranklist(html))
        if total_pages >= 2:
            tasks = [asyncio.create_task(one(p)) for p in range(2, total_pages + 1)]
            done = 1  # 已处理第一页
            total = total_pages
            for fut in asyncio.as_completed(tasks):
                await fut
                done += 1
                if done % 10 == 0 or done == total:
                    print(f"[rank] {done}/{total}")
    return out

def to_users_object(names: Dict[int, str], cols: Dict[int, str]) -> Dict[int, Dict[str, str]]:
    users: Dict[int, Dict[str, str]] = {}
    existing_max = load_existing_max_uid()
    max_uid = max([*names.keys(), *cols.keys(), existing_max, UID_START - 1])
    for uid in range(UID_START, max_uid + 1):
        users[uid] = {"name": names.get(uid, ""), "colorKey": cols.get(uid, "uk")}
    return users

def apply_special_colorkeys(users: Dict[int, Dict[str, str]]) -> None:
    for info in users.values():
        if info.get("name") in SPECIAL_JL_NAMES and info.get("name"):
            info["colorKey"] = "jl"
    for uid, override in SPECIAL_UID_OVERRIDES.items():
        if uid in users:
            users[uid].update(override)
        else:
            users[uid] = dict(override)

def write_outputs(users: Dict[int, Dict[str, str]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / "users.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    try:
        rel = out_path.relative_to(Path.cwd())
    except ValueError:
        rel = out_path
    print(f"✅ 已生成 {rel}")

async def main():
    print("开始抓取年级/颜色（/ranklist）...")
    colorkeys = await crawl_colorkeys()
    print(f"年级抓取完成：{len(colorkeys)} 条。")

    initial_end = max(colorkeys.keys(), default=UID_START - 1)
    print("开始抓取姓名（XHR：/user_plan）...")
    names = await crawl_names(initial_end)
    print(f"姓名抓取完成：{len(names)} 条。")

    users = to_users_object(names, colorkeys)
    apply_special_colorkeys(users)
    write_outputs(users)

if __name__ == "__main__":
    asyncio.run(main())
