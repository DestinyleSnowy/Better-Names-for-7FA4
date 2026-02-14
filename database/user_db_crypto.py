from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

USERS_DB_KEY_ENV = "USERS_DB_KEY"
USERS_DB_SCHEMA = "bn-users-v1"


def _uid_sort_key(item: tuple[str, Any]) -> tuple[int, str]:
    key = str(item[0])
    if key.isdigit():
        return (int(key), key)
    return (10**12, key)


def get_fernet_from_env(*, require: bool) -> Optional[Fernet]:
    raw_key = os.environ.get(USERS_DB_KEY_ENV, "").strip()
    if not raw_key:
        if require:
            raise ValueError(
                f"Missing {USERS_DB_KEY_ENV}. "
                f"Set a Fernet key in env/secrets before reading or writing encrypted users DB."
            )
        return None
    try:
        return Fernet(raw_key.encode("utf-8"))
    except Exception as exc:
        raise ValueError(
            f"Invalid {USERS_DB_KEY_ENV}. Expected a valid Fernet key."
        ) from exc


def read_json(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def is_encrypted_payload(payload: Any) -> bool:
    return (
        isinstance(payload, dict)
        and payload.get("__encrypted__") is True
        and payload.get("schema") == USERS_DB_SCHEMA
        and isinstance(payload.get("users"), dict)
    )


def _decrypt_name(token: str, fernet: Fernet) -> str:
    if not token:
        return ""
    return fernet.decrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_payload_to_plain_users(payload: Dict[str, Any], fernet: Fernet) -> Dict[str, Dict[str, Any]]:
    if not is_encrypted_payload(payload):
        raise ValueError("Input is not an encrypted users payload.")
    encrypted_users = payload.get("users", {})
    out: Dict[str, Dict[str, Any]] = {}
    for uid, entry in sorted(encrypted_users.items(), key=_uid_sort_key):
        info = dict(entry) if isinstance(entry, dict) else {}
        token = str(info.pop("nameEnc", "") or "")
        if token:
            try:
                info["name"] = _decrypt_name(token, fernet)
            except InvalidToken as exc:
                raise ValueError(
                    f"Failed to decrypt user {uid}. Check {USERS_DB_KEY_ENV}."
                ) from exc
        else:
            info["name"] = ""
        if "colorKey" not in info:
            info["colorKey"] = "uk"
        out[str(uid)] = info
    return out


def _build_existing_token_cache(payload: Any, fernet: Fernet) -> Dict[str, tuple[str, str]]:
    if not is_encrypted_payload(payload):
        return {}
    encrypted_users = payload.get("users", {})
    cache: Dict[str, tuple[str, str]] = {}
    for uid, entry in encrypted_users.items():
        if not isinstance(entry, dict):
            continue
        token = str(entry.get("nameEnc", "") or "")
        if not token:
            continue
        try:
            plain_name = _decrypt_name(token, fernet)
        except InvalidToken:
            # old file may have been encrypted with a different key; just skip reuse
            continue
        cache[str(uid)] = (plain_name, token)
    return cache


def encrypt_plain_users_payload(
    plain_users: Dict[Any, Dict[str, Any]],
    fernet: Fernet,
    *,
    existing_payload: Any = None,
) -> Dict[str, Any]:
    existing_cache = _build_existing_token_cache(existing_payload, fernet)

    encrypted_users: Dict[str, Dict[str, Any]] = {}
    for uid, entry in sorted(((str(k), v) for k, v in plain_users.items()), key=_uid_sort_key):
        info = dict(entry) if isinstance(entry, dict) else {}
        raw_name = info.pop("name", "")
        name = raw_name if isinstance(raw_name, str) else str(raw_name or "")

        token = ""
        cached = existing_cache.get(uid)
        if name:
            if cached and cached[0] == name:
                token = cached[1]
            else:
                token = fernet.encrypt(name.encode("utf-8")).decode("utf-8")

        info["nameEnc"] = token
        if "colorKey" not in info:
            info["colorKey"] = "uk"
        encrypted_users[uid] = info

    return {
        "__encrypted__": True,
        "schema": USERS_DB_SCHEMA,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "users": encrypted_users,
    }


def read_users_db_as_plain(path: Path, *, require_key_for_encrypted: bool) -> Dict[str, Dict[str, Any]]:
    raw = read_json(path)
    if raw is None:
        return {}
    if is_encrypted_payload(raw):
        fernet = get_fernet_from_env(require=require_key_for_encrypted)
        if not fernet:
            return {}
        return decrypt_payload_to_plain_users(raw, fernet)
    if isinstance(raw, dict):
        out: Dict[str, Dict[str, Any]] = {}
        for uid, entry in sorted(raw.items(), key=_uid_sort_key):
            if not isinstance(entry, dict):
                continue
            info = dict(entry)
            if "name" not in info:
                info["name"] = ""
            if "colorKey" not in info:
                info["colorKey"] = "uk"
            out[str(uid)] = info
        return out
    return {}


def read_uid_keys(path: Path) -> list[str]:
    raw = read_json(path)
    if is_encrypted_payload(raw):
        return [str(k) for k in raw.get("users", {}).keys()]
    if isinstance(raw, dict):
        return [str(k) for k in raw.keys()]
    return []
