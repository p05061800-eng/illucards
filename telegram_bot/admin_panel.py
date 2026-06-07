#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Админ-панель: клиенты, история сообщений, статистика."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Callable

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from db import (
    CLIENTS_PAGE_SIZE,
    MESSAGES_PAGE_SIZE,
    count_messages,
    count_users,
    get_stats,
    get_user,
    list_messages,
    list_users,
    log_message,
    recompute_user_order_stats,
    search_users,
    sync_all_users_order_stats,
    upsert_user,
)

logger = logging.getLogger(__name__)

_ADMIN_AWAIT_SEARCH: set[int] = set()
_ADMIN_AWAIT_WRITE: dict[int, int] = {}

GetBotOrdersFn = Callable[[], dict[str, Any]]


def _admin_chat_id() -> int:
    for key in (
        "TELEGRAM_ADMIN_CHAT_ID",
        "ILLUCARDS_TELEGRAM_ADMIN_CHAT_ID",
        "TELEGRAM_ADMIN_ID",
        "TELEGRAM_ORDER_NOTIFY_ID",
    ):
        raw = (os.getenv(key) or "").strip()
        if not raw:
            continue
        try:
            val = int(raw)
        except (TypeError, ValueError):
            continue
        if val > 0:
            return val
    return 0


def is_admin_user(telegram_user_id: int | None) -> bool:
    admin_id = _admin_chat_id()
    if not admin_id or telegram_user_id is None:
        return False
    try:
        return int(telegram_user_id) == int(admin_id)
    except (TypeError, ValueError):
        return False


def _client_main_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ["💬 Связь", "📦 Мои заказы"],
            ["🚚 Доставка", "⭐ Бонусы"],
        ],
        resize_keyboard=True,
    )


def _fmt_dt(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except (TypeError, ValueError):
        return str(iso)[:16]


def _user_display_name(row: dict[str, Any]) -> str:
    fn = str(row.get("full_name") or "").strip()
    un = str(row.get("username") or "").strip().lstrip("@")
    if fn and un:
        return f"{fn} (@{un})"
    if fn:
        return fn
    if un:
        return f"@{un}"
    return f"id {row.get('telegram_id')}"


def _admin_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("👥 Клиенты", callback_data="adm:clients:0")],
            [InlineKeyboardButton("📊 Статистика", callback_data="adm:stats")],
        ]
    )


def _client_card_keyboard(telegram_id: int) -> InlineKeyboardMarkup:
    tid = int(telegram_id)
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "📩 История сообщений",
                    callback_data=f"adm:msgs:{tid}:0",
                )
            ],
            [
                InlineKeyboardButton(
                    "✉️ Написать клиенту",
                    callback_data=f"adm:write:{tid}",
                )
            ],
            [InlineKeyboardButton("⬅️ Назад", callback_data="adm:clients:0")],
        ]
    )


def _messages_keyboard(telegram_id: int, page: int, total_pages: int) -> InlineKeyboardMarkup:
    tid = int(telegram_id)
    rows: list[list[InlineKeyboardButton]] = []
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(
            InlineKeyboardButton("◀️", callback_data=f"adm:msgs:{tid}:{page - 1}")
        )
    if page + 1 < total_pages:
        nav.append(
            InlineKeyboardButton("▶️", callback_data=f"adm:msgs:{tid}:{page + 1}")
        )
    if nav:
        rows.append(nav)
    rows.append(
        [InlineKeyboardButton("⬅️ Назад", callback_data=f"adm:client:{tid}")]
    )
    return InlineKeyboardMarkup(rows)


def _clients_list_text(page: int, users: list[dict[str, Any]], total: int) -> str:
    total_pages = max(1, (total + CLIENTS_PAGE_SIZE - 1) // CLIENTS_PAGE_SIZE)
    lines = [f"👥 Клиенты · стр. {page + 1}/{total_pages}", ""]
    if not users:
        lines.append("Пока нет зарегистрированных клиентов.")
    else:
        start = page * CLIENTS_PAGE_SIZE
        for i, row in enumerate(users, start=start + 1):
            name = _user_display_name(row)
            tid = row.get("telegram_id")
            oc = int(row.get("orders_count") or 0)
            lines.append(f"{i}. {name}")
            lines.append(f"   🆔 {tid} · 🛒 {oc} заказ(ов)")
            lines.append("")
    return "\n".join(lines).rstrip()


def _format_client_card(row: dict[str, Any]) -> str:
    un = str(row.get("username") or "").strip()
    un_line = f"@{un.lstrip('@')}" if un else "—"
    return (
        "👤 Карточка клиента\n\n"
        f"👤 Имя: {row.get('full_name') or '—'}\n"
        f"🔗 Username: {un_line}\n"
        f"🆔 Telegram ID: {row.get('telegram_id')}\n"
        f"📅 Дата регистрации: {_fmt_dt(row.get('created_at'))}\n"
        f"🛒 Количество заказов: {int(row.get('orders_count') or 0)}\n"
        f"💰 Общая сумма покупок: {float(row.get('total_spent') or 0):g} BYN"
    )


def _format_messages_history(
    telegram_id: int,
    page: int,
    messages: list[dict[str, Any]],
    total: int,
) -> str:
    total_pages = max(1, (total + MESSAGES_PAGE_SIZE - 1) // MESSAGES_PAGE_SIZE)
    lines = [
        f"📩 История сообщений · клиент {telegram_id}",
        f"Стр. {page + 1}/{total_pages} · всего {total}",
        "",
    ]
    if not messages:
        lines.append("Сообщений пока нет.")
    else:
        for msg in messages:
            role = str(msg.get("role") or "user")
            prefix = "👤" if role == "user" else "🛡"
            ts = _fmt_dt(msg.get("created_at"))
            text = str(msg.get("text") or "—")
            lines.append(f"{prefix} {ts}")
            lines.append(text)
            lines.append("")
    body = "\n".join(lines).rstrip()
    if len(body) > 3900:
        body = body[:3890] + "\n…"
    return body


def _format_stats_text(stats: dict[str, Any]) -> str:
    return (
        "📊 Статистика\n\n"
        f"👥 Всего пользователей: {int(stats.get('total_users') or 0)}\n"
        f"🟢 Активных за 7 дней: {int(stats.get('active_7d') or 0)}\n"
        f"🛒 Количество заказов: {int(stats.get('orders_count') or 0)}\n"
        f"💰 Общая выручка: {float(stats.get('total_revenue') or 0):g} BYN"
    )


async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.message
    user = update.effective_user
    if not msg or not user:
        return
    if not is_admin_user(int(user.id)):
        await msg.reply_text("Команда доступна только администратору.")
        return
    await msg.reply_text(
        "🛡 Админ-панель IlluCards\n\nВыберите раздел:",
        reply_markup=_admin_menu_keyboard(),
    )


async def show_clients_page(
    message: Any,
    context: ContextTypes.DEFAULT_TYPE,
    page: int,
    *,
    get_bot_orders: GetBotOrdersFn,
    edit: bool = False,
) -> None:
    sync_all_users_order_stats(get_bot_orders())
    total = count_users()
    total_pages = max(1, (total + CLIENTS_PAGE_SIZE - 1) // CLIENTS_PAGE_SIZE)
    page = max(0, min(int(page), total_pages - 1))
    users = list_users(offset=page * CLIENTS_PAGE_SIZE, limit=CLIENTS_PAGE_SIZE)
    text = _clients_list_text(page, users, total)
    kb_rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("🔍 Поиск клиента", callback_data="adm:search")],
    ]
    for row in users:
        tid = int(row["telegram_id"])
        label = _user_display_name(row)[:40]
        kb_rows.append(
            [InlineKeyboardButton(label, callback_data=f"adm:client:{tid}")]
        )
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(
            InlineKeyboardButton("◀️", callback_data=f"adm:clients:{page - 1}")
        )
    if page + 1 < total_pages:
        nav.append(
            InlineKeyboardButton("▶️", callback_data=f"adm:clients:{page + 1}")
        )
    if nav:
        kb_rows.append(nav)
    kb_rows.append([InlineKeyboardButton("📊 Статистика", callback_data="adm:stats")])
    kb_rows.append([InlineKeyboardButton("⬅️ Закрыть", callback_data="adm:close")])
    kb = InlineKeyboardMarkup(kb_rows)
    if edit:
        try:
            await message.edit_text(text, reply_markup=kb)
            return
        except Exception:
            pass
    await message.reply_text(text, reply_markup=kb)


async def handle_admin_callback(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    data: str,
    *,
    get_bot_orders: GetBotOrdersFn,
) -> bool:
    q = update.callback_query
    if not q or not q.message or not q.from_user:
        return False
    if not data.startswith("adm:"):
        return False
    if not is_admin_user(int(q.from_user.id)):
        await q.answer("Только для администратора", show_alert=True)
        return True

    parts = data.split(":")
    action = parts[1] if len(parts) > 1 else ""

    if action == "close":
        await q.answer()
        try:
            await q.message.delete()
        except Exception:
            pass
        return True

    if action == "menu":
        await q.answer()
        await q.message.reply_text(
            "🛡 Админ-панель IlluCards\n\nВыберите раздел:",
            reply_markup=_admin_menu_keyboard(),
        )
        return True

    if action == "stats":
        sync_all_users_order_stats(get_bot_orders())
        stats = get_stats()
        await q.answer()
        await q.message.reply_text(
            _format_stats_text(stats),
            reply_markup=InlineKeyboardMarkup(
                [
                    [InlineKeyboardButton("👥 Клиенты", callback_data="adm:clients:0")],
                    [InlineKeyboardButton("⬅️ Меню", callback_data="adm:menu")],
                ]
            ),
        )
        return True

    if action == "search":
        _ADMIN_AWAIT_SEARCH.add(int(q.from_user.id))
        await q.answer()
        await q.message.reply_text(
            "🔍 Поиск клиента\n\n"
            "Введите telegram_id, @username или имя одним сообщением."
        )
        return True

    if action == "clients":
        page = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
        await q.answer()
        await show_clients_page(
            q.message, context, page, get_bot_orders=get_bot_orders, edit=True
        )
        return True

    if action == "client" and len(parts) > 2:
        tid = int(parts[2])
        recompute_user_order_stats(tid, get_bot_orders())
        row = get_user(tid)
        if not row:
            await q.answer("Клиент не найден", show_alert=True)
            return True
        await q.answer()
        try:
            await q.message.edit_text(
                _format_client_card(row),
                reply_markup=_client_card_keyboard(tid),
            )
        except Exception:
            await q.message.reply_text(
                _format_client_card(row),
                reply_markup=_client_card_keyboard(tid),
            )
        return True

    if action == "msgs" and len(parts) > 3:
        tid = int(parts[2])
        page = int(parts[3])
        total = count_messages(tid)
        total_pages = max(1, (total + MESSAGES_PAGE_SIZE - 1) // MESSAGES_PAGE_SIZE)
        page = max(0, min(page, total_pages - 1))
        msgs = list_messages(
            tid, offset=page * MESSAGES_PAGE_SIZE, limit=MESSAGES_PAGE_SIZE
        )
        await q.answer()
        text = _format_messages_history(tid, page, msgs, total)
        kb = _messages_keyboard(tid, page, total_pages)
        try:
            await q.message.edit_text(text, reply_markup=kb)
        except Exception:
            await q.message.reply_text(text, reply_markup=kb)
        return True

    if action == "write" and len(parts) > 2:
        tid = int(parts[2])
        _ADMIN_AWAIT_WRITE[int(q.from_user.id)] = tid
        await q.answer()
        await q.message.reply_text(
            f"✉️ Напишите сообщение для клиента {tid}.\n"
            "Оно будет отправлено одним сообщением."
        )
        return True

    await q.answer()
    return True


async def handle_admin_text(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    text: str,
    *,
    get_bot_orders: GetBotOrdersFn,
) -> bool:
    msg = update.message
    user = update.effective_user
    if not msg or not user or not is_admin_user(int(user.id)):
        return False
    uid = int(user.id)
    t = (text or "").strip()

    if uid in _ADMIN_AWAIT_WRITE:
        cust_id = _ADMIN_AWAIT_WRITE.pop(uid)
        try:
            await context.bot.send_message(
                chat_id=int(cust_id),
                text=f"💬 Сообщение от менеджера:\n\n{t}",
                reply_markup=_client_main_keyboard(),
            )
            log_message(int(cust_id), "admin", t)
            await msg.reply_text(
                f"✅ Сообщение отправлено клиенту {cust_id}.",
                reply_markup=InlineKeyboardMarkup(
                    [
                        [
                            InlineKeyboardButton(
                                "⬅️ К карточке",
                                callback_data=f"adm:client:{cust_id}",
                            )
                        ]
                    ]
                ),
            )
        except Exception as e:
            logger.warning("admin CRM write failed: %s", e)
            await msg.reply_text("Не удалось отправить сообщение клиенту.")
        return True

    if uid in _ADMIN_AWAIT_SEARCH:
        _ADMIN_AWAIT_SEARCH.discard(uid)
        sync_all_users_order_stats(get_bot_orders())
        found = search_users(t)
        if not found:
            await msg.reply_text(
                "Ничего не найдено.",
                reply_markup=InlineKeyboardMarkup(
                    [[InlineKeyboardButton("👥 Клиенты", callback_data="adm:clients:0")]]
                ),
            )
            return True
        if len(found) == 1:
            row = found[0]
            recompute_user_order_stats(int(row["telegram_id"]), get_bot_orders())
            row = get_user(int(row["telegram_id"])) or row
            await msg.reply_text(
                _format_client_card(row),
                reply_markup=_client_card_keyboard(int(row["telegram_id"])),
            )
            return True
        lines = ["🔍 Результаты поиска:", ""]
        kb_rows: list[list[InlineKeyboardButton]] = []
        for row in found[:15]:
            tid = int(row["telegram_id"])
            lines.append(f"• {_user_display_name(row)} · 🆔 {tid}")
            kb_rows.append(
                [
                    InlineKeyboardButton(
                        _user_display_name(row)[:40],
                        callback_data=f"adm:client:{tid}",
                    )
                ]
            )
        kb_rows.append(
            [InlineKeyboardButton("⬅️ К списку", callback_data="adm:clients:0")]
        )
        await msg.reply_text("\n".join(lines), reply_markup=InlineKeyboardMarkup(kb_rows))
        return True

    return False


def persist_telegram_user_from_update(update: Update) -> None:
    user = update.effective_user
    if not user:
        return
    upsert_user(
        int(user.id),
        username=user.username,
        full_name=user.full_name or user.first_name,
    )


def log_incoming_user_message(update: Update) -> None:
    user = update.effective_user
    msg = update.message
    if not user or not msg:
        return
    if is_admin_user(int(user.id)):
        return
    persist_telegram_user_from_update(update)
    if msg.text:
        log_message(int(user.id), "user", msg.text)
        return
    if msg.photo:
        cap = (msg.caption or "").strip()
        body = "📷 [фото]"
        if cap:
            body = f"{body} {cap}"
        log_message(int(user.id), "user", body)
        return
    if msg.document:
        mime = str(getattr(msg.document, "mime_type", "") or "")
        name = str(getattr(msg.document, "file_name", "") or "файл")
        if mime.startswith("image/"):
            cap = (msg.caption or "").strip()
            body = f"📷 [изображение: {name}]"
            if cap:
                body = f"{body} {cap}"
        else:
            body = f"📎 [документ: {name}]"
        log_message(int(user.id), "user", body)
        return
    if msg.voice:
        log_message(int(user.id), "user", "🎤 [голосовое сообщение]")
        return
    if msg.video:
        cap = (msg.caption or "").strip()
        body = "🎬 [видео]"
        if cap:
            body = f"{body} {cap}"
        log_message(int(user.id), "user", body)
        return
    if msg.sticker:
        log_message(int(user.id), "user", "🙂 [стикер]")
        return
    if msg.contact:
        log_message(int(user.id), "user", "📇 [контакт]")
        return
    log_message(int(user.id), "user", "📨 [сообщение]")


def log_admin_outbound_message(customer_id: int, text: str) -> None:
    log_message(int(customer_id), "admin", text)
