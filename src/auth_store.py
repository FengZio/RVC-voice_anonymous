from __future__ import annotations

import hashlib
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "serenepath.db"


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = os.environ.get("SERENEPATH_PASSWORD_SALT", "serenepath-local-demo")
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def initialize_db() -> None:
    with _connect() as conn:
        user_row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
        ).fetchone()
        needs_user_migration = bool(
            user_row
            and user_row["sql"]
            and "role text not null check(role in ('doctor', 'patient'))" in user_row["sql"].lower()
        )

        if needs_user_migration:
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute("ALTER TABLE users RENAME TO users_legacy")
            conn.executescript(
                """
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('doctor', 'patient', 'admin')),
                    title TEXT,
                    department TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                INSERT INTO users (id, username, display_name, password_hash, role, title, department, created_at, updated_at)
                SELECT id, username, display_name, password_hash, role, title, department, created_at, updated_at
                FROM users_legacy;
                DROP TABLE users_legacy;
                """
            )
            conn.execute("PRAGMA foreign_keys = ON")

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('doctor', 'patient', 'admin')),
                title TEXT,
                department TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def _row_to_user(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "role": row["role"],
        "title": row["title"],
        "department": row["department"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def create_user(
    username: str,
    password: str,
    display_name: str,
    role: str,
    title: Optional[str] = None,
    department: Optional[str] = None,
) -> Dict[str, Any]:
    role_value = role.strip().lower()
    if role_value == "manager":
        role_value = "admin"
    if role_value not in {"doctor", "patient", "admin"}:
        raise ValueError("Role must be doctor, patient or admin.")
    if not username.strip():
        raise ValueError("Username is required.")
    if not password:
        raise ValueError("Password is required.")
    if not display_name.strip():
        raise ValueError("Display name is required.")

    now = _utc_now()
    user_id = uuid.uuid4().hex
    with _connect() as conn:
        try:
            conn.execute(
                """
                INSERT INTO users (id, username, display_name, password_hash, role, title, department, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    username.strip(),
                    display_name.strip(),
                    hash_password(password),
                    role_value,
                    title.strip() if title else None,
                    department.strip() if department else None,
                    now,
                    now,
                ),
            )
            if role_value == "doctor":
                import json
                conn.execute(
                    """
                    INSERT OR IGNORE INTO doctors (id, name, department, title, rating, satisfaction, specialty, schedule, intro, education, experience, publications_json, reviews_json, availabilities_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        display_name.strip(),
                        department.strip() if department else "未指定",
                        title.strip() if title else "医师",
                        0.0,
                        0,
                        "待完善",
                        "待设置",
                        "",
                        "",
                        "",
                        json.dumps([], ensure_ascii=False),
                        json.dumps([], ensure_ascii=False),
                        json.dumps([], ensure_ascii=False),
                        now,
                        now,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise ValueError("Username already exists.") from exc

    return get_user_by_id(user_id)


def authenticate_user(username: str, password: str) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?",
            (username.strip(),),
        ).fetchone()
        if not row or row["password_hash"] != hash_password(password):
            raise ValueError("Invalid username or password.")
        return _row_to_user(row)


def issue_session(user_id: str, hours: int = 72) -> Dict[str, Any]:
    token = uuid.uuid4().hex
    created_at = _utc_now()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, created_at, expires_at),
        )
    return {"token": token, "expiresAt": expires_at}


def get_user_by_id(user_id: str) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("User not found.")
        return _row_to_user(row)


def get_user_by_token(token: str) -> Dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.*
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, _utc_now()),
        ).fetchone()
        if not row:
            raise ValueError("Invalid or expired token.")
        return _row_to_user(row)


def revoke_session(token: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
