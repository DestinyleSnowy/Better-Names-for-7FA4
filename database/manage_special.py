# -*- coding: utf-8 -*-
"""
Interactive helper for maintaining special Better Names rules.

Commands:
  user <id> <name|~> <colorKey|~>
  tag <TagName> <TagId> <TagColor>
  tag <userId|username> <TagName|TagId>
  del <userId|username> <TagName|TagId>
  del tag <TagName|TagId>
  show user
  show tag
  help
  exit / quit
"""
from __future__ import annotations

import json
import shlex
from pathlib import Path
from typing import Dict, List, Tuple

from user_db_crypto import is_encrypted_payload, read_json, read_users_db_as_plain

BASE_DIR = Path(__file__).resolve().parents[1] / "Better-Names-for-7FA4"
SPECIAL_RULES_PATH = BASE_DIR / "data" / "special_users.json"
USERS_JSON_PATH = BASE_DIR / "data" / "users.json"

DEFAULT_RULES = {
    "users": {},
    "tags": {
        "definitions": {},
        "assignments": {},
    },
}


def ensure_rules_structure(raw: Dict) -> Dict:
    rules = {"users": {}, "tags": {"definitions": {}, "assignments": {}}}
    if isinstance(raw, dict):
        users = raw.get("users", {})
        tags = raw.get("tags", {})
        definitions = (tags or {}).get("definitions", {})
        assignments = (tags or {}).get("assignments", {})
        if isinstance(users, dict):
            rules["users"] = users
        if isinstance(definitions, dict):
            rules["tags"]["definitions"] = definitions
        if isinstance(assignments, dict):
            rules["tags"]["assignments"] = assignments
    return rules


def load_rules() -> Dict:
    if SPECIAL_RULES_PATH.exists():
        try:
            with SPECIAL_RULES_PATH.open("r", encoding="utf-8") as f:
                return ensure_rules_structure(json.load(f))
        except Exception as exc:  # pragma: no cover - defensive, interactive tool
            print(f"[warn] Failed to load special rules ({exc}); using defaults.")
    return json.loads(json.dumps(DEFAULT_RULES))


def save_rules(rules: Dict) -> None:
    SPECIAL_RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with SPECIAL_RULES_PATH.open("w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)


def load_user_db() -> Dict[str, Dict]:
    raw = read_json(USERS_JSON_PATH)
    if raw is None:
        return {}
    encrypted = is_encrypted_payload(raw)
    try:
        data = read_users_db_as_plain(
            USERS_JSON_PATH,
            require_key_for_encrypted=encrypted,
        )
        if encrypted:
            print("[info] Loaded encrypted users DB.")
        return data if isinstance(data, dict) else {}
    except ValueError as exc:  # pragma: no cover - defensive, interactive tool
        print(f"[warn] Failed to read users DB ({exc}).")
        return {}


def resolve_user_identifier(identifier: str, user_db: Dict[str, Dict]) -> str:
    token = identifier.strip()
    if not token:
        raise ValueError("User identifier is empty.")
    if token.isdigit():
        return str(int(token))
    matches = [
        uid for uid, info in (user_db or {}).items()
        if isinstance(info, dict) and str(info.get("name", "")).strip() == token
    ]
    if not matches:
        raise ValueError(f"No user found with name '{token}'.")
    if len(matches) > 1:
        raise ValueError(f"Multiple users found with name '{token}', please use ID.")
    return matches[0]


def resolve_tag_identifier(identifier: str, definitions: Dict[str, Dict]) -> str:
    token = identifier.strip()
    if not token:
        raise ValueError("Tag identifier is empty.")
    if token in definitions:
        return token
    lowered = token.lower()
    matches = [
        tag_id for tag_id, meta in (definitions or {}).items()
        if isinstance(meta, dict) and str(meta.get("name", "")).strip().lower() == lowered
    ]
    if not matches:
        raise ValueError(f"Tag '{token}' not found.")
    if len(matches) > 1:
        raise ValueError(f"Multiple tags called '{token}', please use TagID.")
    return matches[0]


def describe_tag(tag_id: str, definitions: Dict[str, Dict]) -> str:
    meta = definitions.get(tag_id) if isinstance(definitions, dict) else None
    if not isinstance(meta, dict):
        return tag_id
    name = str(meta.get("name", tag_id))
    color = str(meta.get("color", "")).strip()
    return f"{name}#{tag_id}{f'[{color}]' if color else ''}"


def ensure_user_entry(rules: Dict, user_id: str) -> Dict:
    users = rules.setdefault("users", {})
    if user_id not in users or not isinstance(users[user_id], dict):
        users[user_id] = {}
    return users[user_id]


def has_assignment(assignments: Dict[str, List[str]], user_id: str) -> bool:
    lst = assignments.get(user_id)
    return bool(lst) if isinstance(lst, list) else False


def cleanup_user_entry_if_empty(rules: Dict, user_id: str) -> None:
    users = rules.get("users", {})
    assignments = rules.get("tags", {}).get("assignments", {})
    entry = users.get(user_id)
    if isinstance(entry, dict) and not entry and not has_assignment(assignments, user_id):
        users.pop(user_id, None)


def handle_user_command(parts: List[str], rules: Dict) -> None:
    if len(parts) != 4:
        print("Usage: user <id> <name|~> <colorKey|~>")
        return
    _, uid_token, name_token, color_token = parts
    if not uid_token.isdigit():
        print("User ID must be numeric.")
        return
    user_id = str(int(uid_token))
    entry = ensure_user_entry(rules, user_id)
    changes = []
    if name_token == "~":
        if "name" in entry:
            entry.pop("name")
            changes.append("name→~")
    else:
        entry["name"] = name_token
        changes.append(f"name→{name_token}")
    if color_token == "~":
        if "colorKey" in entry:
            entry.pop("colorKey")
            changes.append("colorKey→~")
    else:
        entry["colorKey"] = color_token
        changes.append(f"colorKey→{color_token}")
    cleanup_user_entry_if_empty(rules, user_id)
    if changes:
        print(f"[ok] Updated user {user_id}: {', '.join(changes)}")
    else:
        print(f"[ok] No effective changes for user {user_id}.")


def handle_tag_create(parts: List[str], rules: Dict) -> None:
    if len(parts) != 4:
        print("Usage: tag <TagName> <TagID> <TagColor>")
        return
    _, tag_name, tag_id_token, tag_color = parts
    tag_id = tag_id_token.strip()
    if not tag_id:
        print("Tag ID cannot be empty.")
        return
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    lowered_name = tag_name.strip().lower()
    for existing in definitions.values():
        if isinstance(existing, dict) and str(existing.get("name", "")).strip().lower() == lowered_name:
            print(f"[err] Tag name '{tag_name}' already exists.")
            return
    if tag_id in definitions:
        print(f"[err] Tag ID '{tag_id}' already exists.")
        return
    definitions[tag_id] = {
        "id": tag_id,
        "name": tag_name,
        "color": tag_color,
    }
    print(f"[ok] Added tag '{tag_name}' (#{tag_id}, {tag_color}).")


def handle_tag_assignment(parts: List[str], rules: Dict, user_db: Dict[str, Dict]) -> None:
    if len(parts) != 3:
        print("Usage: tag <userId|username> <TagName|TagID>")
        return
    _, user_token, tag_token = parts
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    if not definitions:
        print("[err] Please create a tag first (tag <TagName> <TagID> <TagColor>).")
        return
    try:
        user_id = resolve_user_identifier(user_token, user_db)
    except ValueError as exc:
        print(f"[err] {exc}")
        return
    try:
        tag_id = resolve_tag_identifier(tag_token, definitions)
    except ValueError as exc:
        print(f"[err] {exc}")
        return
    assignments = rules.setdefault("tags", {}).setdefault("assignments", {})
    lst = assignments.setdefault(user_id, [])
    if tag_id in lst:
        print(f"[ok] User {user_id} already has tag {describe_tag(tag_id, definitions)}.")
        return
    lst.append(tag_id)
    print(f"[ok] Granted tag {describe_tag(tag_id, definitions)} to user {user_id}.")


def handle_tag_remove_definition(identifier: str, rules: Dict) -> None:
    tags = rules.setdefault("tags", {})
    definitions = tags.setdefault("definitions", {})
    assignments = tags.setdefault("assignments", {})
    if not definitions:
        print("[err] There are no tag definitions yet.")
        return
    try:
        tag_id = resolve_tag_identifier(identifier, definitions)
    except ValueError as exc:
        print(f"[err] {exc}")
        return
    definitions.pop(tag_id, None)
    affected_users: List[str] = []
    for user_id in sorted(list(assignments.keys()), key=lambda x: (int(x) if str(x).isdigit() else float("inf"), str(x))):
        tag_list = assignments.get(user_id)
        if not isinstance(tag_list, list):
            continue
        if tag_id not in tag_list:
            continue
        tag_list = [tid for tid in tag_list if tid != tag_id]
        if tag_list:
            assignments[user_id] = tag_list
        else:
            assignments.pop(user_id, None)
            cleanup_user_entry_if_empty(rules, user_id)
        affected_users.append(str(user_id))
    if affected_users:
        holders = ", ".join(affected_users)
        print(f"[ok] Removed tag {tag_id} and cleared it from users: {holders}.")
    else:
        print(f"[ok] Removed tag {tag_id}.")


def handle_tag_delete(parts: List[str], rules: Dict, user_db: Dict[str, Dict]) -> None:
    if len(parts) == 3 and parts[1].lower() == "tag":
        handle_tag_remove_definition(parts[2], rules)
        return
    if len(parts) != 3:
        print("Usage: del <userId|username> <TagName|TagID>")
        return
    _, user_token, tag_token = parts
    assignments = rules.setdefault("tags", {}).setdefault("assignments", {})
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    try:
        user_id = resolve_user_identifier(user_token, user_db)
    except ValueError as exc:
        print(f"[err] {exc}")
        return
    if not assignments.get(user_id):
        print(f"[ok] User {user_id} has no tags.")
        cleanup_user_entry_if_empty(rules, user_id)
        return
    try:
        tag_id = resolve_tag_identifier(tag_token, definitions)
    except ValueError as exc:
        print(f"[err] {exc}")
        return
    lst = assignments.get(user_id, [])
    if tag_id not in lst:
        print(f"[ok] User {user_id} does not hold tag {describe_tag(tag_id, definitions)}.")
        return
    lst.remove(tag_id)
    if not lst:
        assignments.pop(user_id, None)
        cleanup_user_entry_if_empty(rules, user_id)
    print(f"[ok] Removed tag {describe_tag(tag_id, definitions)} from user {user_id}.")


def format_user_line(user_id: str, rules: Dict, definitions: Dict[str, Dict]) -> str:
    entry = rules.get("users", {}).get(user_id, {})
    name = entry.get("name", "~") if isinstance(entry, dict) else "~"
    color_key = entry.get("colorKey", "~") if isinstance(entry, dict) else "~"
    assignments = rules.get("tags", {}).get("assignments", {})
    tags = []
    for tag_id in assignments.get(user_id, []) or []:
        tags.append(describe_tag(tag_id, definitions))
    tag_str = ", ".join(tags) if tags else "-"
    return f"ID {user_id:>4}: name={name} colorKey={color_key} tags={tag_str}"


def handle_show_users(rules: Dict) -> None:
    definitions = rules.get("tags", {}).get("definitions", {})
    user_ids = set()
    user_ids.update(rules.get("users", {}).keys())
    user_ids.update(rules.get("tags", {}).get("assignments", {}).keys())
    if not user_ids:
        print("(no special users)")
        return
    for uid in sorted(user_ids, key=lambda x: (int(x) if str(x).isdigit() else float("inf"), str(x))):
        print(format_user_line(str(uid), rules, definitions))


def handle_show_tags(rules: Dict) -> None:
    definitions = rules.get("tags", {}).get("definitions", {})
    if not definitions:
        print("(no tags)")
        return
    assignments = rules.get("tags", {}).get("assignments", {})
    def sort_key(item: Tuple[str, Dict]) -> Tuple[int, str]:
        tag_id, _ = item
        return (int(tag_id) if str(tag_id).isdigit() else float("inf"), str(tag_id))
    for tag_id, meta in sorted(definitions.items(), key=sort_key):
        desc = describe_tag(tag_id, definitions)
        holders = [uid for uid, lst in assignments.items() if isinstance(lst, list) and tag_id in lst]
        holders_str = ", ".join(sorted(holders, key=lambda x: (int(x) if str(x).isdigit() else float("inf"), str(x)))) or "-"
        print(f"{desc}: users => {holders_str}")


def print_help() -> None:
    print("""Available commands:
  user <id> <name|~> <colorKey|~>   - set/remove manual overrides ("~" syncs to crawler)
  tag <TagName> <TagID> <TagColor>  - create a tag definition
  tag <userId|username> <Tag>       - grant an existing tag to a user
  del <userId|username> <Tag>       - revoke a tag from a user
  del tag <TagName|TagID>           - delete a tag definition (and remove from users)
  show user                         - list all overrides and tag holders
  show tag                          - list all tag definitions
  help                              - print this message
  exit / quit                       - leave the tool
""")


def main() -> None:
    rules = load_rules()
    user_db = load_user_db()
    print("Special user manager ready. Type 'help' for instructions, 'exit' to quit.")
    while True:
        try:
            line = input("special> ")
        except EOFError:
            print()
            break
        if not line:
            continue
        try:
            parts = shlex.split(line)
        except ValueError as exc:
            print(f"[err] {exc}")
            continue
        if not parts:
            continue
        cmd = parts[0].lower()
        before = json.dumps(rules, ensure_ascii=False, sort_keys=True)
        if cmd == "user":
            handle_user_command(parts, rules)
        elif cmd == "tag" and len(parts) == 4:
            handle_tag_create(parts, rules)
        elif cmd == "tag" and len(parts) == 3:
            handle_tag_assignment(parts, rules, user_db)
        elif cmd == "del":
            handle_tag_delete(parts, rules, user_db)
        elif cmd == "show" and len(parts) == 2:
            if parts[1].lower() == "user":
                handle_show_users(rules)
            elif parts[1].lower() == "tag":
                handle_show_tags(rules)
            else:
                print("Usage: show user | show tag")
        elif cmd in {"exit", "quit"}:
            break
        elif cmd == "help":
            print_help()
        else:
            print("Unknown command. Type 'help' for available commands.")
            continue
        after = json.dumps(rules, ensure_ascii=False, sort_keys=True)
        if before != after:
            save_rules(rules)
    print("Bye.")


if __name__ == "__main__":
    main()
