# -*- coding: utf-8 -*-
"""按 graduate_year 抓取榜单，补全 users.json 里缺失毕业年份的用户。

只补 colorKey，不覆盖已有姓名；查不到的新用户以 name="" 写入，
等后续抓取姓名（main.py）时再补上。

用法（PowerShell，先设置 Cookie）：
  $env:JX_COOKIE = 'connect.sid=...; login=...'
  python fill_graduate_years.py --dry-run        # 只报告，不写文件
  python fill_graduate_years.py                 # 补全 2022-2035 届
  python fill_graduate_years.py --years 2032 2033
  python fill_graduate_years.py --overwrite     # 用站点数据覆盖已有 colorKey
"""
from __future__ import annotations

import argparse
import asyncio
import re
from pathlib import Path
from typing import Dict

import aiohttp
from bs4 import BeautifulSoup

from main import (
    BASE,
    DATA_DIR,
    UID_START,
    ensure_auth,
    extract_total_ranklist_pages,
    fetch_text,
    normalize_colorkey,
)
from user_db_crypto import (
    encrypt_plain_users_payload,
    get_fernet_from_env,
    is_encrypted_payload,
    read_json,
    read_users_db_as_plain,
    write_json,
)

CONCURRENCY = 10
DEFAULT_START_YEAR = 2022
DEFAULT_END_YEAR = 2035


def sort_key(item) -> tuple:
    key = str(item[0])
    if key.isdigit():
        return (int(key), key)
    return (10 ** 12, key)


def build_ranklist_url(year: str, page: int) -> str:
    return (
        f"{BASE}/ranklist?username=&nickname=&uid=&graduate_year={year}"
        f"&real_name=undefined&school=undefined&enter_year=&page={page}"
    )


def parse_rows(html: str) -> Dict[int, str]:
    soup = BeautifulSoup(html, "lxml")
    out: Dict[int, str] = {}
    for tr in soup.select("tr"):
        a = tr.select_one("td.cell.username a[href^='/user/']")
        if not a or not a.get("href"):
            continue
        m = re.search(r"/user/(\d+)", a["href"])
        if not m:
            continue
        uid = int(m.group(1))
        td = tr.select_one("td.graduate_year, td.cell.graduate_year")
        colorkey = normalize_colorkey(td.get_text(strip=True)) if td else None
        if colorkey:
            out[uid] = colorkey
    return out


async def crawl_year(session: aiohttp.ClientSession, sem: asyncio.Semaphore, year: str) -> Dict[int, str]:
    first_html = await fetch_text(session, build_ranklist_url(year, 1))
    if not first_html:
        print(f"[{year}] ❌ 首页请求失败")
        return {}
    out = parse_rows(first_html)
    total_pages = extract_total_ranklist_pages(first_html)
    if not out:
        print(f"[{year}] ⚠️ 未解析到任何用户，请确认 graduate_year 参数格式")
    if total_pages >= 2:
        async def one(page: int) -> None:
            async with sem:
                html = await fetch_text(session, build_ranklist_url(year, page))
            if html:
                out.update(parse_rows(html))

        await asyncio.gather(*(one(page) for page in range(2, total_pages + 1)))
    print(f"[{year}] {len(out)} 人 / {total_pages} 页")
    return out


def merge(existing: Dict[str, Dict], found: Dict[int, str], overwrite: bool) -> tuple[int, int, int, int]:
    added = filled = updated = mismatched = 0
    for uid, colorkey in sorted(found.items()):
        if uid < UID_START:
            continue
        key = str(uid)
        entry = existing.get(key)
        if entry is None:
            # 新用户：姓名留空，等抓取姓名时补上
            existing[key] = {"colorKey": colorkey, "name": ""}
            added += 1
            continue
        if not isinstance(entry, dict):
            continue
        current = entry.get("colorKey") or ""
        if overwrite:
            if current != colorkey:
                entry["colorKey"] = colorkey
                updated += 1
        elif not current or current == "uk":
            entry["colorKey"] = colorkey
            filled += 1
        elif current != colorkey:
            mismatched += 1
    return added, filled, updated, mismatched


async def amain(args: argparse.Namespace) -> None:
    path = Path(args.db).resolve()
    raw = read_json(path)
    if raw is None:
        raise SystemExit(f"找不到数据库：{path}")
    encrypted_input = is_encrypted_payload(raw)
    existing = read_users_db_as_plain(path, require_key_for_encrypted=True)
    print(f"当前数据库：{len(existing)} 人（{'加密' if encrypted_input else '明文'}）")

    years = args.years or [str(y) for y in range(args.start_year, args.end_year + 1)]
    found: Dict[int, str] = {}
    async with aiohttp.ClientSession() as session:
        await ensure_auth(session)
        sem = asyncio.Semaphore(CONCURRENCY)
        for year in years:
            found.update(await crawl_year(session, sem, year))

    print(f"榜单共解析到 {len(found)} 人")
    added, filled, updated, mismatched = merge(existing, found, args.overwrite)
    print(f"新增 {added} 人（name 为空），补全毕业年份 {filled} 人，覆盖 {updated} 人")
    if mismatched:
        print(f"另有 {mismatched} 人库内毕业年份与站点不一致（默认保留库内值，可用 --overwrite 覆盖）")

    if args.dry_run:
        print("--dry-run：未写入文件")
        return

    existing = dict(sorted(existing.items(), key=sort_key))
    if encrypted_input:
        fernet = get_fernet_from_env(require=True)
        write_json(path, encrypt_plain_users_payload(existing, fernet, existing_payload=raw))
    else:
        write_json(path, existing)
    print(f"✅ 已写入 {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="按毕业年份补全 users.json 中缺失的用户")
    parser.add_argument("--db", default=str(DATA_DIR / "users.json"), help="users.json 路径")
    parser.add_argument("--years", nargs="*", help="指定毕业年份，如 2032 2033")
    parser.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    parser.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    parser.add_argument("--overwrite", action="store_true", help="用站点数据覆盖已有 colorKey")
    parser.add_argument("--dry-run", action="store_true", help="只报告，不写文件")
    asyncio.run(amain(parser.parse_args()))


if __name__ == "__main__":
    main()
