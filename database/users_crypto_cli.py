from __future__ import annotations

import argparse
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from user_db_crypto import (
    encrypt_plain_users_payload,
    get_fernet_from_env,
    is_encrypted_payload,
    read_json,
    write_json,
    decrypt_payload_to_plain_users,
)


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp") as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def cmd_encrypt(input_path: Path, output_path: Path) -> None:
    fernet = get_fernet_from_env(require=True)
    payload = read_json(input_path)
    if payload is None:
        raise SystemExit(f"Input not found: {input_path}")
    if is_encrypted_payload(payload):
        plain_users = decrypt_payload_to_plain_users(payload, fernet)
    elif isinstance(payload, dict):
        plain_users = payload
    else:
        raise SystemExit("Input must be a JSON object.")

    existing_output = read_json(output_path)
    encrypted = encrypt_plain_users_payload(
        plain_users,
        fernet,
        existing_payload=existing_output,
    )
    atomic_write_json(output_path, encrypted)
    print(f"Encrypted users DB written to: {output_path}")


def cmd_decrypt(input_path: Path, output_path: Path) -> None:
    fernet = get_fernet_from_env(require=True)
    payload = read_json(input_path)
    if payload is None:
        raise SystemExit(f"Input not found: {input_path}")
    if not is_encrypted_payload(payload):
        if isinstance(payload, dict):
            write_json(output_path, payload)
            print(f"Input is already plain JSON. Copied to: {output_path}")
            return
        raise SystemExit("Input is not a valid users database JSON object.")
    plain = decrypt_payload_to_plain_users(payload, fernet)
    atomic_write_json(output_path, plain)
    print(f"Decrypted users DB written to: {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Encrypt/decrypt Better Names users database.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_encrypt = sub.add_parser("encrypt", help="Encrypt users JSON")
    p_encrypt.add_argument(
        "--input",
        default="../Better-Names-for-7FA4/data/users.json",
        help="Input JSON path (plain or encrypted)",
    )
    p_encrypt.add_argument(
        "--output",
        default="../Better-Names-for-7FA4/data/users.json",
        help="Output JSON path (encrypted)",
    )

    p_decrypt = sub.add_parser("decrypt", help="Decrypt users JSON")
    p_decrypt.add_argument(
        "--input",
        default="../Better-Names-for-7FA4/data/users.json",
        help="Input JSON path (encrypted)",
    )
    p_decrypt.add_argument(
        "--output",
        default="../Better-Names-for-7FA4/data/users.json",
        help="Output JSON path (plain)",
    )

    args = parser.parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if args.command == "encrypt":
        cmd_encrypt(input_path, output_path)
    elif args.command == "decrypt":
        cmd_decrypt(input_path, output_path)


if __name__ == "__main__":
    main()
