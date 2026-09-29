# -*- coding: utf-8 -*-
"""从 /better_names 拉取真实姓名，补到 users.json 里 name 为空的用户上。

只补空姓名，不覆盖已有姓名；不会保存手机号/邮箱等其他字段。

用法（PowerShell，先设置 Cookie）：
  $env:JX_COOKIE = 'connect.sid=...; login=...'
  python fill_names.py --dry-run     # 只报告
  python fill_names.py               # 写入 users.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import urllib.request
from pathlib import Path
from typing import Dict, List

import aiohttp

from main import BASE, DATA_DIR, build_user_plan_url, ensure_auth, extract_name_from_user_plan, fetch_text
from user_db_crypto import (
    encrypt_plain_users_payload,
    get_fernet_from_env,
    is_encrypted_payload,
    read_json,
    read_users_db_as_plain,
    write_json,
)

BETTER_NAMES_URL = "https://jx.7fa4.cn:8888/better_names"


def fetch_better_names() -> Dict[str, str]:
    cookie = os.environ.get("JX_COOKIE", "").strip()
    if not cookie:
        raise SystemExit("请先设置环境变量 JX_COOKIE")
    request = urllib.request.Request(
        BETTER_NAMES_URL,
        headers={
            "Cookie": cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8", "ignore"))
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise SystemExit("❌ /better_names 返回异常（未登录或接口变化）")
    names: Dict[str, str] = {}
    for user in payload.get("users") or []:
        if not isinstance(user, dict):
            continue
        uid = user.get("id")
        real_name = user.get("real_name")
        if uid is None:
            continue
        if isinstance(real_name, str) and real_name.strip():
            names[str(uid)] = real_name.strip()
    return names


async def crawl_missing_names(uids: List[str]) -> Dict[str, str]:
    """/better_names 没覆盖到的用户，再走 /user_plan XHR 抓一次姓名。"""
    if not uids:
        return {}
    sem = asyncio.Semaphore(10)
    out: Dict[str, str] = {}
    async with aiohttp.ClientSession() as session:
        await ensure_auth(session)

        async def one(uid: str) -> None:
            async with sem:
                html = await fetch_text(session, build_user_plan_url(int(uid)), referer=f"{BASE}/user_plans/{uid}")
            if not html:
                return
            name = extract_name_from_user_plan(html)
            if name:
                out[uid] = name

        await asyncio.gather(*(one(uid) for uid in uids))
    return out


def merge(existing: Dict[str, Dict], names: Dict[str, str]) -> tuple[int, int, list[str]]:
    filled = 0
    missing_only_here: list[str] = []
    for uid, info in existing.items():
        if not isinstance(info, dict):
            continue
        if str(info.get("name") or "").strip():
            continue
        name = names.get(uid)
        if name:
            info["name"] = name
            filled += 1
        else:
            missing_only_here.append(uid)
    for uid in names:
        if uid not in existing:
            missing_only_here.append(uid)
    return filled, len(missing_only_here), sorted(missing_only_here, key=lambda k: int(k) if k.isdigit() else 0)


async def amain(args: argparse.Namespace) -> None:
    path = Path(args.db).resolve()
    raw = read_json(path)
    if raw is None:
        raise SystemExit(f"找不到数据库：{path}")
    encrypted_input = is_encrypted_payload(raw)
    existing = read_users_db_as_plain(path, require_key_for_encrypted=True)
    empty_before = sum(1 for info in existing.values() if not str(info.get("name") or "").strip())
    print(f"当前数据库：{len(existing)} 人，其中 {empty_before} 人没有姓名")

    names = fetch_better_names()
    print(f"/better_names 返回 {len(names)} 个姓名")

    filled, missing_count, missing = merge(existing, names)
    print(f"/better_names 补齐 {filled} 人")

    if not args.skip_user_plan and missing:
        print(f"剩余 {len(missing)} 人改用 /user_plan 抓取姓名…")
        plan_names = await crawl_missing_names(missing)
        print(f"/user_plan 抓到 {len(plan_names)} 个姓名")
        filled_plan, missing_count, missing = merge(existing, plan_names)
        print(f"/user_plan 补齐 {filled_plan} 人")

    print(f"仍未拿到姓名 {missing_count} 人")
    if missing:
        print("  未拿到姓名的 UID：", ", ".join(missing[:40]) + (" …" if len(missing) > 40 else ""))

    if args.dry_run:
        print("--dry-run：未写入文件")
        return

    if encrypted_input:
        fernet = get_fernet_from_env(require=True)
        write_json(path, encrypt_plain_users_payload(existing, fernet, existing_payload=raw))
    else:
        write_json(path, existing)
    print(f"✅ 已写入 {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="用 /better_names 的真实姓名补全 users.json")
    parser.add_argument("--db", default=str(DATA_DIR / "users.json"), help="users.json 路径")
    parser.add_argument("--skip-user-plan", action="store_true", help="只用 /better_names，不抓 /user_plan")
    parser.add_argument("--dry-run", action="store_true", help="只报告，不写文件")
    asyncio.run(amain(parser.parse_args()))


if __name__ == "__main__":
    main()
