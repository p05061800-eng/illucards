#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SQLite-хранилище пользователей и истории сообщений бота."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "bot.db"

CLIENTS_PAGE_SIZE = 8
MESSAGES_PAGE_SIZE = 50


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                created_at TEXT NOT NULL,
                orders_count INTEGER NOT NULL DEFAULT 0,
                total_spent REAL NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
            );

            CREATE INDEX IF NOT EXISTS idx_messages_telegram_id
                ON messages(telegram_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at
                ON messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_username
                ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_full_name
                ON users(full_name);
            """
        )


def upsert_user(
    telegram_id: int,
    *,
    username: str | None = None,
    full_name: str | None = None,
) -> None:
    tid = int(telegram_id)
    un = (username or "").strip().lstrip("@") or None
    fn = (full_name or "").strip() or None
    now = _utc_now_iso()
    with _connect() as conn:
        row = conn.execute(
            "SELECT telegram_id FROM users WHERE telegram_id = ?",
            (tid,),
        ).fetchone()
        if row:
            conn.execute(
                """
                UPDATE users
                SET username = COALESCE(?, username),
                    full_name = COALESCE(?, full_name)
                WHERE telegram_id = ?
                """,
                (un, fn, tid),
            )
        else:
            conn.execute(
                """
                INSERT INTO users (telegram_id, username, full_name, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (tid, un, fn, now),
            )


def update_user_order_stats(
    telegram_id: int,
    orders_count: int,
    total_spent: float,
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            UPDATE users
            SET orders_count = ?, total_spent = ?
            WHERE telegram_id = ?
            """,
            (max(0, int(orders_count)), max(0.0, float(total_spent)), int(telegram_id)),
        )


def log_message(telegram_id: int, role: str, text: str) -> None:
    tid = int(telegram_id)
    r = (role or "").strip().lower()
    if r not in ("user", "admin"):
        r = "user"
    body = (text or "").strip()
    if not body:
        body = "—"
    if len(body) > 8000:
        body = body[:7997] + "..."
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO messages (telegram_id, role, text, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (tid, r, body, _utc_now_iso()),
        )


def get_user(telegram_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE telegram_id = ?",
            (int(telegram_id),),
        ).fetchone()
    return dict(row) if row else None


def count_users() -> int:
    with _connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
    return int(row["c"]) if row else 0


def list_users(offset: int = 0, limit: int = CLIENTS_PAGE_SIZE) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (int(limit), int(offset)),
        ).fetchall()
    return [dict(r) for r in rows]


def search_users(query: str, limit: int = 20) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    q_at = q.lstrip("@")
    with _connect() as conn:
        if q_at.isdigit():
            row = conn.execute(
                "SELECT * FROM users WHERE telegram_id = ?",
                (int(q_at),),
            ).fetchone()
            return [dict(row)] if row else []
        like = f"%{q_at.lower()}%"
        rows = conn.execute(
            """
            SELECT * FROM users
            WHERE LOWER(COALESCE(username, '')) LIKE ?
               OR LOWER(COALESCE(full_name, '')) LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (like, like, int(limit)),
        ).fetchall()
    return [dict(r) for r in rows]


def count_messages(telegram_id: int) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM messages WHERE telegram_id = ?",
            (int(telegram_id),),
        ).fetchone()
    return int(row["c"]) if row else 0


def list_messages(
    telegram_id: int,
    *,
    offset: int = 0,
    limit: int = MESSAGES_PAGE_SIZE,
) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM messages
            WHERE telegram_id = ?
            ORDER BY created_at ASC
            LIMIT ? OFFSET ?
            """,
            (int(telegram_id), int(limit), int(offset)),
        ).fetchall()
    return [dict(r) for r in rows]


def clear_messages(telegram_id: int) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM messages WHERE telegram_id = ?",
            (int(telegram_id),),
        )
        return int(cur.rowcount or 0)


def get_stats() -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).replace(microsecond=0).isoformat()
    with _connect() as conn:
        total_users = int(
            conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        )
        active_7d = int(
            conn.execute(
                """
                SELECT COUNT(DISTINCT telegram_id) AS c
                FROM messages
                WHERE role = 'user' AND created_at >= ?
                """,
                (cutoff,),
            ).fetchone()["c"]
        )
        orders_row = conn.execute(
            "SELECT COALESCE(SUM(orders_count), 0) AS c FROM users"
        ).fetchone()
        revenue_row = conn.execute(
            "SELECT COALESCE(SUM(total_spent), 0) AS s FROM users"
        ).fetchone()
    return {
        "total_users": total_users,
        "active_7d": active_7d,
        "orders_count": int(orders_row["c"]) if orders_row else 0,
        "total_revenue": float(revenue_row["s"]) if revenue_row else 0.0,
    }


def recompute_user_order_stats(telegram_id: int, bot_orders: dict[str, Any]) -> tuple[int, float]:
    tid = int(telegram_id)
    count = 0
    total = 0.0
    skip = {"cancelled", "canceled"}
    for rec in bot_orders.values():
        if not isinstance(rec, dict):
            continue
        try:
            uid = int(rec.get("user_id") or 0)
        except (TypeError, ValueError):
            continue
        if uid != tid:
            continue
        st = str(rec.get("status") or "new").strip().lower()
        if st in skip:
            continue
        count += 1
        try:
            total += float(rec.get("total") or 0)
        except (TypeError, ValueError):
            pass
    update_user_order_stats(tid, count, total)
    return count, total


def sync_all_users_order_stats(bot_orders: dict[str, Any]) -> None:
    user_ids: set[int] = set()
    for rec in bot_orders.values():
        if not isinstance(rec, dict):
            continue
        try:
            uid = int(rec.get("user_id") or 0)
        except (TypeError, ValueError):
            continue
        if uid > 0:
            user_ids.add(uid)
    with _connect() as conn:
        rows = conn.execute("SELECT telegram_id FROM users").fetchall()
        for row in rows:
            user_ids.add(int(row["telegram_id"]))
    for uid in user_ids:
        recompute_user_order_stats(uid, bot_orders)
