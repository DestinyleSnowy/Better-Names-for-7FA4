from __future__ import annotations
import json
import shlex
import sys, os, logging
from pathlib import Path

def get_base_dir():
    """获取基础目录（适配打包环境）"""
    if getattr(sys, 'frozen', False):
        base_path = Path(sys.executable).parent
    else:
        base_path = Path(__file__).resolve().parent
    return base_path

def get_data_dir():
    """获取数据目录（确保可写）"""
    base_dir = get_base_dir()
    data_dir = base_dir / "data"
    
    if getattr(sys, 'frozen', False):
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            test_file = data_dir / ".write_test"
            test_file.touch()
            test_file.unlink()
        except (PermissionError, OSError):
            logging.error("")
    
    # 确保目录存在
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir

# ====================== 路径配置 ======================
DATA_DIR = get_data_dir()
SPECIAL_RULES_PATH = DATA_DIR / "special_users.json"
USERS_JSON_PATH = DATA_DIR / "users.json"

DEFAULT_RULES = {
    "users": {},
    "tags": {
        "definitions": {},
        "assignments": {},
    },
}

# 调试信息（可选）
print(f"[Debug] 基础目录: {get_base_dir()}")
print(f"[Debug] 数据目录: {DATA_DIR}")
print(f"[Debug] 规则文件: {SPECIAL_RULES_PATH}")
print(f"[Debug] 用户文件: {USERS_JSON_PATH}")

# ====================== 主要函数 ======================
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
    """加载特殊规则"""
    if SPECIAL_RULES_PATH.exists():
        try:
            with SPECIAL_RULES_PATH.open("r", encoding="utf-8") as f:
                return ensure_rules_structure(json.load(f))
        except Exception as exc:
            print(f"[warn] Failed to load special rules ({exc}); using defaults.")
            # 备份损坏的文件
            try:
                backup_path = SPECIAL_RULES_PATH.with_suffix(f".json.bak.{os.getpid()}")
                SPECIAL_RULES_PATH.rename(backup_path)
                print(f"[info] 备份损坏文件到: {backup_path}")
            except:
                pass
    return json.loads(json.dumps(DEFAULT_RULES))

def save_rules(rules: Dict) -> None:
    """保存规则（确保目录存在）"""
    SPECIAL_RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # 先保存到临时文件，然后重命名（避免写入过程中崩溃导致文件损坏）
    temp_path = SPECIAL_RULES_PATH.with_suffix(f".json.tmp.{os.getpid()}")
    
    try:
        with temp_path.open("w", encoding="utf-8") as f:
            json.dump(rules, f, ensure_ascii=False, indent=2)
        
        # 将临时文件重命名为目标文件
        temp_path.replace(SPECIAL_RULES_PATH)
        print(f"[info] 规则已保存到: {SPECIAL_RULES_PATH}")
        
    except Exception as e:
        print(f"[error] 保存规则失败: {e}")
        # 尝试清理临时文件
        try:
            if temp_path.exists():
                temp_path.unlink()
        except:
            pass

def load_user_db() -> Dict[str, Dict]:
    """加载用户数据库"""
    if not USERS_JSON_PATH.exists():
        print(f"[info] 用户数据库不存在: {USERS_JSON_PATH}")
        return {}
    
    try:
        with USERS_JSON_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[error] 加载用户数据库失败: {e}")
        return {}

def resolve_user_identifier(identifier: str, user_db: Dict[str, Dict]) -> str:
    """解析用户标识符（ID或用户名）"""
    token = identifier.strip()
    if not token:
        raise ValueError("用户标识符为空")
    
    if token.isdigit():
        return str(int(token))
    
    # 通过用户名查找
    matches = [
        uid for uid, info in (user_db or {}).items()
        if isinstance(info, dict) and str(info.get("name", "")).strip() == token
    ]
    
    if not matches:
        raise ValueError(f"未找到名为 '{token}' 的用户")
    if len(matches) > 1:
        raise ValueError(f"找到多个名为 '{token}' 的用户，请使用ID")
    
    return matches[0]

def resolve_tag_identifier(identifier: str, definitions: Dict[str, Dict]) -> str:
    """解析标签标识符（ID或名称）"""
    token = identifier.strip()
    if not token:
        raise ValueError("标签标识符为空")
    
    if token in definitions:
        return token
    
    # 通过标签名查找
    lowered = token.lower()
    matches = [
        tag_id for tag_id, meta in (definitions or {}).items()
        if isinstance(meta, dict) and str(meta.get("name", "")).strip().lower() == lowered
    ]
    
    if not matches:
        raise ValueError(f"未找到标签 '{token}'")
    if len(matches) > 1:
        raise ValueError(f"找到多个名为 '{token}' 的标签，请使用TagID")
    
    return matches[0]

def describe_tag(tag_id: str, definitions: Dict[str, Dict]) -> str:
    """格式化标签描述"""
    meta = definitions.get(tag_id) if isinstance(definitions, dict) else None
    if not isinstance(meta, dict):
        return tag_id
    
    name = str(meta.get("name", tag_id))
    color = str(meta.get("color", "")).strip()
    return f"{name}#{tag_id}{f'[{color}]' if color else ''}"

def ensure_user_entry(rules: Dict, user_id: str) -> Dict:
    """确保用户条目存在"""
    users = rules.setdefault("users", {})
    if user_id not in users or not isinstance(users[user_id], dict):
        users[user_id] = {}
    return users[user_id]

def has_assignment(assignments: Dict[str, List[str]], user_id: str) -> bool:
    """检查用户是否有标签分配"""
    lst = assignments.get(user_id)
    return bool(lst) if isinstance(lst, list) else False

def cleanup_user_entry_if_empty(rules: Dict, user_id: str) -> None:
    """清理空用户条目"""
    users = rules.get("users", {})
    assignments = rules.get("tags", {}).get("assignments", {})
    entry = users.get(user_id)
    if isinstance(entry, dict) and not entry and not has_assignment(assignments, user_id):
        users.pop(user_id, None)

# ====================== 命令处理函数 ======================
def handle_user_command(parts: List[str], rules: Dict) -> None:
    if len(parts) != 4:
        print("用法: user <id> <name|~> <colorKey|~>")
        return
    
    _, uid_token, name_token, color_token = parts
    if not uid_token.isdigit():
        print("用户ID必须是数字")
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
        print(f"[成功] 更新用户 {user_id}: {', '.join(changes)}")
    else:
        print(f"[信息] 用户 {user_id} 无有效变更")

def handle_tag_create(parts: List[str], rules: Dict) -> None:
    if len(parts) != 4:
        print("用法: tag <标签名> <标签ID> <标签颜色>")
        return
    
    _, tag_name, tag_id_token, tag_color = parts
    tag_id = tag_id_token.strip()
    
    if not tag_id:
        print("标签ID不能为空")
        return
    
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    lowered_name = tag_name.strip().lower()
    
    # 检查重复的标签名
    for existing in definitions.values():
        if isinstance(existing, dict) and str(existing.get("name", "")).strip().lower() == lowered_name:
            print(f"[错误] 标签名 '{tag_name}' 已存在")
            return
    
    # 检查重复的标签ID
    if tag_id in definitions:
        print(f"[错误] 标签ID '{tag_id}' 已存在")
        return
    
    definitions[tag_id] = {
        "id": tag_id,
        "name": tag_name,
        "color": tag_color,
    }
    print(f"[成功] 添加标签 '{tag_name}' (#{tag_id}, 颜色: {tag_color})")

def handle_tag_assignment(parts: List[str], rules: Dict, user_db: Dict[str, Dict]) -> None:
    if len(parts) != 3:
        print("用法: tag <用户ID|用户名> <标签名|标签ID>")
        return
    
    _, user_token, tag_token = parts
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    
    if not definitions:
        print("[错误] 请先创建标签 (tag <标签名> <标签ID> <标签颜色>)")
        return
    
    try:
        user_id = resolve_user_identifier(user_token, user_db)
    except ValueError as exc:
        print(f"[错误] {exc}")
        return
    
    try:
        tag_id = resolve_tag_identifier(tag_token, definitions)
    except ValueError as exc:
        print(f"[错误] {exc}")
        return
    
    assignments = rules.setdefault("tags", {}).setdefault("assignments", {})
    lst = assignments.setdefault(user_id, [])
    
    if tag_id in lst:
        print(f"[信息] 用户 {user_id} 已拥有标签 {describe_tag(tag_id, definitions)}")
        return
    
    lst.append(tag_id)
    print(f"[成功] 为用户 {user_id} 授予标签 {describe_tag(tag_id, definitions)}")

def handle_tag_remove_definition(identifier: str, rules: Dict) -> None:
    tags = rules.setdefault("tags", {})
    definitions = tags.setdefault("definitions", {})
    assignments = tags.setdefault("assignments", {})
    
    if not definitions:
        print("[错误] 暂无标签定义")
        return
    
    try:
        tag_id = resolve_tag_identifier(identifier, definitions)
    except ValueError as exc:
        print(f"[错误] {exc}")
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
        print(f"[成功] 移除标签 {tag_id}，并从以下用户中清除: {holders}")
    else:
        print(f"[成功] 移除标签 {tag_id}")

def handle_tag_delete(parts: List[str], rules: Dict, user_db: Dict[str, Dict]) -> None:
    if len(parts) == 3 and parts[1].lower() == "tag":
        handle_tag_remove_definition(parts[2], rules)
        return
    
    if len(parts) != 3:
        print("用法: del <用户ID|用户名> <标签名|标签ID>")
        return
    
    _, user_token, tag_token = parts
    assignments = rules.setdefault("tags", {}).setdefault("assignments", {})
    definitions = rules.setdefault("tags", {}).setdefault("definitions", {})
    
    try:
        user_id = resolve_user_identifier(user_token, user_db)
    except ValueError as exc:
        print(f"[错误] {exc}")
        return
    
    if not assignments.get(user_id):
        print(f"[信息] 用户 {user_id} 暂无标签")
        cleanup_user_entry_if_empty(rules, user_id)
        return
    
    try:
        tag_id = resolve_tag_identifier(tag_token, definitions)
    except ValueError as exc:
        print(f"[错误] {exc}")
        return
    
    lst = assignments.get(user_id, [])
    if tag_id not in lst:
        print(f"[信息] 用户 {user_id} 未拥有标签 {describe_tag(tag_id, definitions)}")
        return
    
    lst.remove(tag_id)
    if not lst:
        assignments.pop(user_id, None)
        cleanup_user_entry_if_empty(rules, user_id)
    
    print(f"[成功] 从用户 {user_id} 移除标签 {describe_tag(tag_id, definitions)}")

def format_user_line(user_id: str, rules: Dict, definitions: Dict[str, Dict]) -> str:
    """格式化用户行显示"""
    entry = rules.get("users", {}).get(user_id, {})
    name = entry.get("name", "~") if isinstance(entry, dict) else "~"
    color_key = entry.get("colorKey", "~") if isinstance(entry, dict) else "~"
    
    assignments = rules.get("tags", {}).get("assignments", {})
    tags = []
    for tag_id in assignments.get(user_id, []) or []:
        tags.append(describe_tag(tag_id, definitions))
    
    tag_str = ", ".join(tags) if tags else "-"
    return f"ID {user_id:>4}: 名称={name} 颜色={color_key} 标签={tag_str}"

def handle_show_users(rules: Dict) -> None:
    definitions = rules.get("tags", {}).get("definitions", {})
    user_ids = set()
    user_ids.update(rules.get("users", {}).keys())
    user_ids.update(rules.get("tags", {}).get("assignments", {}).keys())
    
    if not user_ids:
        print("(暂无特殊用户)")
        return
    
    for uid in sorted(user_ids, key=lambda x: (int(x) if str(x).isdigit() else float("inf"), str(x))):
        print(format_user_line(str(uid), rules, definitions))

def handle_show_tags(rules: Dict) -> None:
    definitions = rules.get("tags", {}).get("definitions", {})
    if not definitions:
        print("(暂无标签)")
        return
    
    assignments = rules.get("tags", {}).get("assignments", {})
    
    def sort_key(item: Tuple[str, Dict]) -> Tuple[int, str]:
        tag_id, _ = item
        return (int(tag_id) if str(tag_id).isdigit() else float("inf"), str(tag_id))
    
    for tag_id, meta in sorted(definitions.items(), key=sort_key):
        desc = describe_tag(tag_id, definitions)
        holders = [uid for uid, lst in assignments.items() if isinstance(lst, list) and tag_id in lst]
        holders_str = ", ".join(sorted(holders, key=lambda x: (int(x) if str(x).isdigit() else float("inf"), str(x)))) or "-"
        print(f"{desc}: 用户 => {holders_str}")

def print_help() -> None:
    print("""可用命令:
  user <id> <名称|~> <颜色|~>        - 设置/移除手动覆盖（"~"表示同步到爬虫）
  tag <标签名> <标签ID> <标签颜色>    - 创建标签定义
  tag <用户ID|用户名> <标签>          - 将现有标签授予用户
  del <用户ID|用户名> <标签>          - 从用户移除标签
  del tag <标签名|标签ID>             - 删除标签定义（并从用户中移除）
  show user                         - 显示所有覆盖和标签持有者
  show tag                          - 显示所有标签定义
  help                              - 显示此帮助信息
  exit / quit                       - 退出工具
""")

def main() -> None:
    """主函数"""
    print(f"特殊用户管理工具 (数据目录: {DATA_DIR})")
    print("输入 'help' 查看帮助，'exit' 退出。")
    
    rules = load_rules()
    user_db = load_user_db()
    
    while True:
        try:
            line = input("特殊> ")
        except EOFError:
            print()
            break
        except KeyboardInterrupt:
            print("\n使用 'exit' 或 'quit' 退出")
            continue
        
        if not line:
            continue
        
        try:
            parts = shlex.split(line)
        except ValueError as exc:
            print(f"[错误] {exc}")
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
                print("用法: show user | show tag")
        elif cmd in {"exit", "quit"}:
            # 确保保存最后一次更改
            after = json.dumps(rules, ensure_ascii=False, sort_keys=True)
            if before != after:
                save_rules(rules)
            break
        elif cmd == "help":
            print_help()
        else:
            print("未知命令，输入 'help' 查看可用命令")
            continue
        
        # 如果规则有变化，保存
        after = json.dumps(rules, ensure_ascii=False, sort_keys=True)
        if before != after:
            save_rules(rules)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[致命错误] 程序异常退出: {e}")
        import traceback
        traceback.print_exc()
        input("按Enter键退出...")