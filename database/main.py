# -*- coding: utf-8 -*-
import asyncio
import aiohttp
import json
import os
import re
import time
from typing import Dict, Optional
from bs4 import BeautifulSoup

BASE = "http://jx.7fa4.cn:8888"

UID_START, UID_END = 1, 2850
RANKLIST_PAGES = range(1, 56)  # 1..51

# 并发、超时、重试
CONCURRENCY = 20
REQUEST_TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF = (0.6, 1.2, 2.5)

# -------------------- 认证与请求头 --------------------
COOKIE_STR = os.environ.get("JX_COOKIE", "").strip()
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "X-Requested-With": "XMLHttpRequest",  # 模拟 XHR
}
if COOKIE_STR:
    HEADERS["Cookie"] = COOKIE_STR

GRADE_TO_COLORKEY = {
    "小四": "x4", "小五": "x5", "小六": "x6",
    "初一": "c1", "初二": "c2", "初三": "c3",
    "高一": "g1", "高二": "g2", "高三": "g3",
    "大一": "d1", "大二": "d2", "大三": "d3", "大四": "d4",
    "毕业": "by", "教练": "jl", "教师": "jl", "其他": "uk",
}
ALT_TEXT = {"大  一": "大一", "大  二": "大二", "大  三": "大三", "大  四": "大四", "教  练": "教练", "其  他": "其他"}

def build_user_plan_url(uid: int) -> str:
    # 这个接口示例：/user_plan?user_id=650&date=1757928000&type=day&format=td
    # date 用当前时间戳即可
    ts = int(time.time())
    return f"{BASE}/user_plan?user_id={uid}&date={ts}&type=day&format=td"

async def fetch_text(session: aiohttp.ClientSession, url: str, referer: Optional[str] = None) -> Optional[str]:
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, headers=headers, timeout=timeout) as resp:
                # 未登录通常会 200 返回登录页或 302 跳转
                text = await resp.text()
                return text
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
    return ("登录" in body_text and "密码" in body_text) or "login" in title

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

async def ensure_auth(session: aiohttp.ClientSession) -> None:
    """
    先拉一个 ranklist 页面，判断是否已登录。
    """
    html = await fetch_text(session, f"{BASE}/ranklist?page=1")
    if not html:
        raise SystemExit("❌ 无法访问站点（网络或超时）。")
    if looks_like_login_page(html):
        tip = (
            "❌ 看起来未登录。请在 PowerShell 里执行：\n"
            "$env:JX_COOKIE = 'connect.sid=...; io=...; sidebar_collapsed=false; event_filter=all; login=...'\n"
            "然后重新运行：python main.py\n"
            "（Cookie 请从浏览器 DevTools 的某个请求里复制整段）"
        )
        raise SystemExit(tip)

async def crawl_names() -> Dict[int, str]:
    sem = asyncio.Semaphore(CONCURRENCY)
    out: Dict[int, str] = {}
    async with aiohttp.ClientSession() as session:
        await ensure_auth(session)

        async def one(uid: int):
            url = build_user_plan_url(uid)
            referer = f"{BASE}/user_plans/{uid}"
            async with sem:
                html = await fetch_text(session, url, referer=referer)
            if not html:
                return
            name = extract_name_from_user_plan(html)
            if name:
                out[uid] = name

        tasks = [asyncio.create_task(one(uid)) for uid in range(UID_START, UID_END + 1)]
        done = 0
        for fut in asyncio.as_completed(tasks):
            await fut
            done += 1
            if done % 200 == 0:
                print(f"[names] {done}/{UID_END-UID_START+1}")
    return out

async def crawl_colorkeys() -> Dict[int, str]:
    sem = asyncio.Semaphore(CONCURRENCY)
    out: Dict[int, str] = {}
    async with aiohttp.ClientSession() as session:
        await ensure_auth(session)

        async def one(page: int):
            url = f"{BASE}/ranklist?page={page}"
            async with sem:
                html = await fetch_text(session, url)
            if not html:
                return
            out.update(extract_uid_and_colorkey_from_ranklist(html))

        tasks = [asyncio.create_task(one(p)) for p in RANKLIST_PAGES]
        done = 0
        for fut in asyncio.as_completed(tasks):
            await fut
            done += 1
            if done % 10 == 0:
                print(f"[rank] {done}/{len(RANKLIST_PAGES)}")
    return out

def to_users_object(names: Dict[int, str], cols: Dict[int, str]) -> Dict[int, Dict[str, str]]:
    users: Dict[int, Dict[str, str]] = {}
    for uid in range(UID_START, UID_END + 1):
        users[uid] = {"name": names.get(uid, ""), "colorKey": cols.get(uid, "uk")}
    return users

def write_outputs(users: Dict[int, Dict[str, str]]) -> None:
    with open("users.json", "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    with open("users.js", "w", encoding="utf-8") as f:
        f.write("const users = {\n")
        for uid in range(UID_START, UID_END + 1):
            name = users[uid]["name"].replace("\\", "\\\\").replace('"', '\\"')
            f.write(f'  {uid}: {{ name: "{name}", colorKey: "{users[uid]["colorKey"]}" }},\n')
        f.write("};\nexport default users;\n")
    print("✅ 已生成 users.json 与 users.js")

async def main():
    print("开始抓取姓名（XHR：/user_plan）...")
    names = await crawl_names()
    print(f"姓名抓取完成：{len(names)} 条。")

    print("开始抓取年级/颜色（/ranklist?page=1..51）...")
    colorkeys = await crawl_colorkeys()
    print(f"年级抓取完成：{len(colorkeys)} 条。")

    users = to_users_object(names, colorkeys)
    write_outputs(users)

if __name__ == "__main__":
    asyncio.run(main())
