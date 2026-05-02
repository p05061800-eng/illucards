#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from pathlib import Path
from typing import Any

import aiohttp
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
TELEGRAM_USERS_PATH = REPO_ROOT / "data" / "telegram-bot-users.json"
BOT_ORDERS_PATH = REPO_ROOT / "data" / "bot-orders.json"
KNOWN_START_IDS_PATH = REPO_ROOT / "data" / "bot-known-start-user-ids.json"
LOGIN_CODES_PATH = REPO_ROOT / "data" / "telegram-login-codes.json"
# Подтверждённые в боте заказы: order_id → { user_id, items, total, status }
BOT_ORDERS: dict[str, dict[str, Any]] = {}
LOGIN_CODE_TTL_SEC = 5 * 60


def persist_telegram_site_user(user_id: int, username: str) -> None:
    """Сохраняет username → user_id для входа на сайте (POST /api/send-code).

    Это тот же числовой id, что в заказах с сайта (data/orders/*.json, поле user_id)
    и в браузере (cookie/localStorage telegram_user_id).
    """
    key = username.strip().lstrip("@").lower()
    if not key:
        return
    TELEGRAM_USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    data: dict[str, Any] = {}
    if TELEGRAM_USERS_PATH.exists():
        try:
            with open(TELEGRAM_USERS_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                data = raw
        except (OSError, json.JSONDecodeError, ValueError) as e:
            logger.warning("telegram-bot-users read: %s", e)
    data[key] = {"user_id": int(user_id), "username": username.strip().lstrip("@")}
    try:
        with open(TELEGRAM_USERS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.warning("telegram-bot-users write: %s", e)


def _load_bot_orders() -> None:
    global BOT_ORDERS
    if not BOT_ORDERS_PATH.exists():
        return
    try:
        with open(BOT_ORDERS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return
        out: dict[str, dict[str, Any]] = {}
        for k, v in raw.items():
            if isinstance(v, dict):
                out[str(k)] = v
        BOT_ORDERS = out
    except (OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("bot-orders read: %s", e)


def _persist_bot_orders() -> None:
    try:
        BOT_ORDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(BOT_ORDERS_PATH, "w", encoding="utf-8") as f:
            json.dump(BOT_ORDERS, f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.warning("bot-orders write: %s", e)


def _load_known_start_user_ids() -> set[int]:
    if not KNOWN_START_IDS_PATH.exists():
        return set()
    try:
        with open(KNOWN_START_IDS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, list):
            return set()
        out: set[int] = set()
        for x in raw:
            try:
                out.add(int(x))
            except (TypeError, ValueError):
                continue
        return out
    except (OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("bot-known-start-user-ids read: %s", e)
        return set()


def _persist_known_start_user_ids(ids: set[int]) -> None:
    try:
        KNOWN_START_IDS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(KNOWN_START_IDS_PATH, "w", encoding="utf-8") as f:
            json.dump(sorted(ids), f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.warning("bot-known-start-user-ids write: %s", e)


def _record_first_start_and_is_new(telegram_user_id: int) -> bool:
    """True — первый зафиксированный /start для этого id (показать «спасибо за авторизацию»)."""
    uid = int(telegram_user_id)
    known = _load_known_start_user_ids()
    if uid in known:
        return False
    known.add(uid)
    _persist_known_start_user_ids(known)
    return True


def _default_start_welcome_text(is_first: bool) -> str:
    base = (
        "Полная коллекция, цены и оформление заказа — на сайте IlluCards. "
        "Нажмите «Открыть сайт» — вход на сайте привяжется к этому Telegram.\n\n"
        "Если вы уже оформили заказ на сайте, он уже продублирован здесь: "
        "перейдите по ссылке из оформления — останется только подтвердить заказ в этом чате."
    )
    if is_first:
        return "Привет! Спасибо за авторизацию.\n\n" + base
    return "С возвращением!\n\n" + base


# Статусы: из bot-orders и (при появлении) с сайта
ORDER_STATUS_RU: dict[str, str] = {
    "new": "⏳ Новый",
    "confirmed": "✅ Принят",
    "accepted": "✅ Принят",
    "shipped": "🚚 Отправлен",
    "sent": "🚚 Отправлен",
    "delivered": "✅ Доставлен",
    "cancelled": "❌ Отменён",
    "canceled": "❌ Отменён",
}


def _order_status_display(status: str) -> str:
    key = (status or "").strip().lower()
    if not key:
        return "—"
    return ORDER_STATUS_RU.get(key, f"📋 {status}")


def _merge_order_status_for_display(rec: dict[str, Any], site: dict[str, Any] | None) -> str:
    """Сайт пока часто отдаёт только new; приоритет у обновлённого статуса с сайта, иначе из бота."""
    r = str(rec.get("status") or "new").strip().lower()
    if not site:
        return r
    s = str(site.get("status") or "").strip().lower()
    if s and s != "new":
        return s
    return r or s or "new"


def _merge_total_byn(rec: dict[str, Any], site: dict[str, Any] | None) -> float:
    if site:
        t = _order_total_byn(site)
        if t > 0:
            return t
    return _order_total_byn(rec)


def _order_id_short(oid: str) -> str:
    o = (oid or "").strip()
    if not o:
        return "—"
    if len(o) <= 18:
        return o
    return o[:14] + "…"


def _orders_for_telegram_user(telegram_user_id: int) -> list[tuple[str, dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any]]] = []
    for oid, rec in BOT_ORDERS.items():
        if not isinstance(rec, dict):
            continue
        try:
            uid = int(rec.get("user_id"))
        except (TypeError, ValueError):
            continue
        if uid == int(telegram_user_id):
            out.append((str(oid), rec))
    out.sort(key=lambda x: x[0])
    return out


def _order_total_byn(order: dict[str, Any]) -> float:
    try:
        return float(order.get("total", 0) or 0)
    except (TypeError, ValueError):
        return 0.0


def _order_items_list(order: dict[str, Any]) -> list[dict[str, Any]]:
    items = order.get("items")
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for it in items:
        if isinstance(it, dict):
            out.append(dict(it))
    return out


def _record_site_order_in_bot(
    order_id: str,
    order: dict[str, Any],
    telegram_user_id: int,
) -> dict[str, Any]:
    """Сохраняет заказ с сайта в локальном журнале бота сразу после deep link."""
    existing = BOT_ORDERS.get(order_id)
    previous_status = ""
    if isinstance(existing, dict):
        previous_status = str(existing.get("status") or "").strip().lower()

    rec = {
        "user_id": int(telegram_user_id),
        "items": _order_items_list(order),
        "total": _order_total_byn(order),
        "delivery": order.get("delivery"),
        "status": previous_status or str(order.get("status") or "new").strip().lower() or "new",
    }
    BOT_ORDERS[order_id] = rec
    _persist_bot_orders()
    return rec


def _format_order_admin(
    order_id: str,
    order: dict[str, Any],
    telegram_user_id: int,
    username: str | None,
    record: dict[str, Any],
) -> str:
    u = f"@{username}" if username else f"id {telegram_user_id}"
    lines = [
        "✅ Подтверждение заказа (бот)",
        f"ID заказа: `{order_id}`",
        f"Пользователь: {u} (tg {telegram_user_id})",
        "",
    ]
    dcode = _delivery_price_code(str(order.get("delivery") or "BY"))
    use_byn = _use_byn_for_delivery(dcode)
    for it in record.get("items") or []:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "—")
        try:
            qty = int(it.get("quantity", 1))
        except (TypeError, ValueError):
            qty = 1
        q = max(qty, 1)
        if use_byn:
            try:
                p = float(it.get("priceByn", 0) or 0)
            except (TypeError, ValueError):
                p = 0.0
            sub = p * q
            lines.append(f"• {title} ×{qty} — {sub:g} BYN")
        else:
            ur = _unit_rub_from_item(it)
            sub_r = ur * q
            lines.append(f"• {title} ×{qty} — {int(round(sub_r))} RUB")
    if len(lines) <= 4:
        lines.append("—")
    try:
        total = float(record.get("total", 0) or 0)
    except (TypeError, ValueError):
        total = 0.0
    lines.append("")
    lines.append(_format_delivery_line_order(dcode))
    if use_byn:
        lines.append(f"💰 Итого: {total:g} BYN · статус: {record.get('status', '—')}")
    else:
        lines.append(
            f"💰 Итого: {int(round(total * BYN_TO_RUB))} RUB (~{total:g} BYN) · статус: {record.get('status', '—')}"
        )
    return "\n".join(lines)


def _resolve_admin_chat_id() -> int:
    raw = (
        (os.getenv("TELEGRAM_ADMIN_CHAT_ID") or "").strip()
        or (os.getenv("ILLUCARDS_TELEGRAM_ADMIN_CHAT_ID") or "").strip()
    )
    if not raw:
        return 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


PRODUCTS_API = "https://www.illucards.by/api/products"
# База сайта для GET /api/order/{id} (тот же хост, что и витрина)
DEFAULT_SITE_ORIGIN = os.getenv("ILLUCARDS_SITE_ORIGIN", "https://www.illucards.by").rstrip("/")
# Ссылка «вход на сайт» (?user_id=<telegram id>) — по умолчанию на www-домен.
SITE_LOGIN_ORIGIN = os.getenv("ILLUCARDS_SITE_LOGIN_ORIGIN", "https://www.illucards.by").rstrip("/")
CARDS_PATH = Path(__file__).resolve().parent / "cards.json"

DELIVERY_LABELS: dict[str, str] = {
    "BY": "Беларусь",
    "RU": "Россия",
    "UA": "Украина",
    "OTHER": "Другие страны",
}

BYN_TO_RUB = 30.0


def _delivery_price_code(raw: str | None) -> str:
    u = (raw or "").strip().upper()
    return u if u in ("BY", "RU", "UA", "OTHER") else "BY"


def _use_byn_for_delivery(dcode: str) -> bool:
    return _delivery_price_code(dcode) == "BY"


def _delivery_charge_rub(dcode: str) -> int:
    d = _delivery_price_code(dcode)
    if d == "BY":
        return int(round(6 * BYN_TO_RUB))
    if d == "RU":
        return 600
    if d == "UA":
        return 3000
    return 800


def _unit_rub_from_item(it: dict[str, Any]) -> float:
    try:
        pr = float(it.get("priceRub", 0) or it.get("price_rub", 0) or 0)
        if pr > 0:
            return pr
    except (TypeError, ValueError):
        pass
    try:
        byn = float(it.get("priceByn", 0) or it.get("price", 0) or 0)
    except (TypeError, ValueError):
        byn = 0.0
    return max(0.0, byn * BYN_TO_RUB)


def _format_delivery_line_order(dcode: str) -> str:
    label = DELIVERY_LABELS.get(dcode, dcode)
    if _use_byn_for_delivery(dcode):
        return f"🚚 Доставка: {label} — 6 BYN"
    rub = _delivery_charge_rub(dcode)
    return f"🚚 Доставка: {label} — {rub} RUB"


CACHE_TTL_SEC = 60.0

_products_cache: list[dict[str, Any]] | None = None
_cache_monotonic_ts: float = 0.0
_cache_from_fallback: bool = False


def _normalize_item(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    pid = raw.get("id")
    if pid is None:
        return None
    name = raw.get("name") if raw.get("name") is not None else raw.get("title")
    cat = raw.get("category")
    if cat is None:
        return None
    price_raw = raw.get("price")
    try:
        price_f = float(price_raw) if price_raw is not None else 0.0
    except (TypeError, ValueError):
        price_f = 0.0
    prub_raw = raw.get("priceRub", raw.get("price_rub"))
    try:
        price_rub_f = float(prub_raw) if prub_raw is not None else 0.0
    except (TypeError, ValueError):
        price_rub_f = 0.0
    if price_rub_f <= 0 and price_f > 0:
        price_rub_f = float(round(price_f * BYN_TO_RUB))
    img = (raw.get("image") or raw.get("frontImage") or "").strip()
    return {
        "id": str(pid),
        "name": str(name or "—"),
        "category": str(cat).strip(),
        "price": price_f,
        "priceRub": price_rub_f,
        "image": img,
    }


def _parse_products_payload(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict) and "products" in data:
        data = data["products"]
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            n = _normalize_item(item)
            if n:
                out.append(n)
    return out


async def _fetch_api() -> list[dict[str, Any]] | None:
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                PRODUCTS_API,
                headers={"Accept": "application/json"},
            ) as resp:
                if resp.status != 200:
                    logger.warning("API products HTTP %s", resp.status)
                    return None
                try:
                    raw = await resp.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError, ValueError) as e:
                    logger.warning("API products JSON: %s", e)
                    return None
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("API products network: %s", e)
        return None

    parsed = _parse_products_payload(raw)
    return parsed


def _load_local_fallback() -> list[dict[str, Any]]:
    with open(CARDS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return _parse_products_payload(raw)


async def load_products() -> list[dict[str, Any]]:
    """
    Синхронизация с /api/products; кеш 60 с; при недоступности API — cards.json рядом с ботом.
    """
    global _products_cache, _cache_monotonic_ts, _cache_from_fallback

    now = time.monotonic()
    if _products_cache is not None and (now - _cache_monotonic_ts) < CACHE_TTL_SEC:
        load_products.used_local_fallback = _cache_from_fallback  # type: ignore[attr-defined]
        return list(_products_cache)

    api_list = await _fetch_api()
    if api_list is not None:
        _products_cache = api_list
        _cache_monotonic_ts = now
        _cache_from_fallback = False
        load_products.used_local_fallback = False  # type: ignore[attr-defined]
        return list(api_list)

    try:
        local_list = _load_local_fallback()
    except (OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("Локальный fallback: %s", e)
        local_list = []

    _products_cache = local_list
    _cache_monotonic_ts = now
    _cache_from_fallback = True
    load_products.used_local_fallback = True  # type: ignore[attr-defined]
    print("⚠️ Используются локальные данные")
    return list(local_list)


load_products.used_local_fallback = False  # type: ignore[attr-defined]


def _categories_from_products(products: list[dict[str, Any]]) -> list[str]:
    cats = {
        str(p["category"]).strip()
        for p in products
        if isinstance(p, dict) and p.get("category") is not None and str(p.get("category", "")).strip()
    }
    return sorted(cats)


def _main_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ["📦 Категории", "🛒 Корзина"],
            ["❤️ Избранное", "📦 Мои заказы"],
        ],
        resize_keyboard=True,
    )


def _site_open_markup(telegram_user_id: int) -> InlineKeyboardMarkup:
    """Кнопка со ссылкой на сайт с авторизацией по Telegram id."""
    uid = int(telegram_user_id)
    url = f"{SITE_LOGIN_ORIGIN}/?user_id={uid}"
    return InlineKeyboardMarkup([[InlineKeyboardButton("Открыть сайт", url=url)]])


def _account_open_markup() -> InlineKeyboardMarkup:
    """Личный кабинет — ввод кода из бота после web_login."""
    url = f"{SITE_LOGIN_ORIGIN}/account"
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("Открыть личный кабинет", url=url)]]
    )


async def _reply_text_with_main_menu_and_site(
    message,
    text: str,
    *,
    telegram_user,
) -> None:
    """Текст ошибки + меню + кнопка «Открыть сайт»."""
    await message.reply_text(text, reply_markup=_main_keyboard())
    if telegram_user is not None and getattr(telegram_user, "id", None) is not None:
        await message.reply_text(
            "Сайт IlluCards",
            reply_markup=_site_open_markup(int(telegram_user.id)),
        )


def _product_inline_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("⬅️", callback_data="nav:prev"),
                InlineKeyboardButton("➡️", callback_data="nav:next"),
                InlineKeyboardButton("🛒", callback_data="nav:add"),
            ],
            [InlineKeyboardButton("⬅️ Назад", callback_data="nav:back")],
        ]
    )


def _format_product_price_line(p: dict[str, Any], delivery_code: str) -> str:
    try:
        byn = float(p.get("price") or 0)
    except (TypeError, ValueError):
        byn = 0.0
    rub = _unit_rub_from_item(p)
    if _use_byn_for_delivery(delivery_code):
        return f"{byn:g} BYN" if byn else "—"
    return f"{int(round(rub))} RUB" if rub else "—"


def _caption(p: dict[str, Any], delivery_code: str) -> str:
    return f"{p.get('name', '—')}\n{_format_product_price_line(p, delivery_code)}"


def _order_id_from_start_args(args: list[str]) -> str | None:
    """Deep link: start=order_<order_id> → args ['order_...']."""
    if not args:
        return None
    raw = (args[0] or "").strip()
    if not raw.startswith("order_"):
        return None
    oid = raw[len("order_") :].strip()
    if not oid or ".." in oid or "/" in oid or "\\" in oid or len(oid) > 200:
        return None
    return oid


async def _fetch_site_order_http(order_id: str) -> tuple[dict[str, Any] | None, int | None]:
    """(body, http_status). body only on 200 + valid JSON dict. http_status from response, or None on transport error."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/{order_id}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url,
                headers={"Accept": "application/json"},
            ) as resp:
                code = int(resp.status)
                if code != 200:
                    if code != 404:
                        logger.warning("GET order HTTP %s %s", code, order_id)
                    return None, code
                data = await resp.json(content_type=None)
                if not isinstance(data, dict):
                    return None, code
                return data, code
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("GET order: %s", e)
        return None, None


async def fetch_site_order(order_id: str) -> dict[str, Any] | None:
    body, _ = await _fetch_site_order_http(order_id)
    return body


async def fetch_site_user_state(telegram_user_id: int) -> dict[str, Any] | None:
    """Получить синхронизированные с сайта корзину и избранное пользователя."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    secret = (os.getenv("ILLUCARDS_USER_STATE_SYNC_SECRET") or "").strip()
    if not secret:
        return None
    url = f"{base}/api/user-state?user_id={int(telegram_user_id)}"
    timeout = aiohttp.ClientTimeout(total=15)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url,
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {secret}",
                },
            ) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning("GET user-state HTTP %s: %s", resp.status, text)
                    return None
                data = await resp.json(content_type=None)
                if not isinstance(data, dict):
                    return None
                return data
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("GET user-state: %s", e)
        return None


async def post_site_order_bot_delete(order_id: str, telegram_user_id: int) -> bool:
    """POST /api/order/bot-delete — удалить заказ на сайте (статус new), тот же Bearer что у update."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/bot-delete"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                headers=headers,
                json={"order_id": order_id, "telegram_user_id": int(telegram_user_id)},
            ) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning("POST order/bot-delete HTTP %s: %s", resp.status, text)
                    return False
                return True
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("POST order/bot-delete: %s", e)
        return False


async def post_site_order_status(order_id: str, status: str) -> bool:
    """POST /api/order/update — синхронизация статуса с сайтом (при смене в боте)."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/update"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                headers=headers,
                json={"order_id": order_id, "status": status},
            ) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning("POST order/update HTTP %s: %s", resp.status, text)
                    return False
                return True
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("POST order/update: %s", e)
        return False


async def post_site_admin_message_id(order_id: str, message_id: int) -> bool:
    """POST /api/order/admin-message — сохранить message_id уведомления админу на сайте."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/admin-message"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                headers=headers,
                json={"order_id": order_id, "admin_message_id": int(message_id)},
            ) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning("POST order/admin-message HTTP %s: %s", resp.status, text)
                    return False
                return True
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("POST order/admin-message: %s", e)
        return False


def _format_order_text(order: dict[str, Any]) -> str:
    items = order.get("items")
    if not isinstance(items, list):
        items = []
    dcode = _delivery_price_code(str(order.get("delivery") or "BY"))
    use_byn = _use_byn_for_delivery(dcode)
    lines: list[str] = ["📦 Ваш заказ:", ""]
    for it in items:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "—").strip()
        try:
            qty = int(it.get("quantity", 1))
        except (TypeError, ValueError):
            qty = 1
        q = max(qty, 1)
        if use_byn:
            try:
                p = float(it.get("priceByn", 0) or 0)
            except (TypeError, ValueError):
                p = 0.0
            sub = p * q
            lines.append(f"• {title} ×{qty} — {sub:g} BYN")
        else:
            ur = _unit_rub_from_item(it)
            sub_r = ur * q
            lines.append(f"• {title} ×{qty} — {int(round(sub_r))} RUB")
    if len(lines) <= 2:
        lines.append("—")
    try:
        total = float(order.get("total", 0) or 0)
    except (TypeError, ValueError):
        total = 0.0
    lines.append("")
    lines.append(_format_delivery_line_order(dcode))
    if use_byn:
        lines.append(f"💰 Итого: {total:g} BYN")
    else:
        lines.append(f"💰 Итого: {int(round(total * BYN_TO_RUB))} RUB (~{total:g} BYN)")
    return "\n".join(lines)


def _order_confirm_keyboard(order_id: str, telegram_user_id: int) -> InlineKeyboardMarkup:
    # callback_data ≤ 64 байт: orderok:/ordercx: + uuid (36) ≈ 44 байта
    uid = int(telegram_user_id)
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("Подтвердить заказ", callback_data=f"orderok:{order_id}")],
            [InlineKeyboardButton("Отменить заказ", callback_data=f"ordercx:{order_id}")],
            [
                InlineKeyboardButton(
                    "Открыть сайт",
                    url=f"{SITE_LOGIN_ORIGIN}/?user_id={uid}",
                )
            ],
        ]
    )


def _order_saved_keyboard(telegram_user_id: int) -> InlineKeyboardMarkup:
    uid = int(telegram_user_id)
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Открыть сайт",
                    url=f"{SITE_LOGIN_ORIGIN}/?user_id={uid}",
                )
            ],
        ]
    )


def _order_belongs_to_telegram_user(order: dict[str, Any], telegram_user_id: int) -> bool:
    """Заказ с user_id с сайта должен совпадать с id пользователя в Telegram."""
    raw = order.get("user_id")
    if raw is None:
        return True
    try:
        return int(raw) == int(telegram_user_id)
    except (TypeError, ValueError):
        return False


def _load_login_codes() -> dict[str, dict[str, Any]]:
    if not LOGIN_CODES_PATH.exists():
        return {}
    try:
        with open(LOGIN_CODES_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return {}
        out: dict[str, dict[str, Any]] = {}
        for k, v in raw.items():
            if isinstance(v, dict):
                out[str(k)] = dict(v)
        return out
    except (OSError, json.JSONDecodeError, ValueError):
        return {}


def _save_login_codes(data: dict[str, dict[str, Any]]) -> None:
    try:
        LOGIN_CODES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOGIN_CODES_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.warning("telegram-login-codes write: %s", e)


async def _sync_login_code_to_site(
    code: str,
    telegram_user_id: int,
    username: str | None,
    wait_id: str | None = None,
) -> bool:
    """Продакшен (Vercel): код хранится в Redis на сайте, не в файле на машине бота."""
    url = (os.getenv("ILLUCARDS_LOGIN_CODE_SYNC_URL") or "").strip()
    secret = (os.getenv("ILLUCARDS_LOGIN_CODE_SYNC_SECRET") or "").strip()
    if not url or not secret:
        # Локальный режим: сайт и бот используют общий файл кодов.
        return True
    un = (username or "").strip().lstrip("@")
    payload: dict[str, Any] = {
        "code": code,
        "user_id": int(telegram_user_id),
        "username_display": un if un else f"id{int(telegram_user_id)}",
        "username_norm": un.lower() if un else "",
    }
    if wait_id and len(wait_id) == 32 and all(c in "0123456789abcdef" for c in wait_id.lower()):
        payload["wait_id"] = wait_id.lower()
    timeout = aiohttp.ClientTimeout(total=15)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:400]
                    logger.warning("sync-login-code HTTP %s: %s", resp.status, text)
                    return False
                return True
    except Exception as e:
        logger.warning("sync-login-code: %s", e)
        return False


def _issue_login_code_for_user(telegram_user_id: int, username: str | None) -> str | None:
    now_ms = int(time.time() * 1000)
    expires_ms = now_ms + LOGIN_CODE_TTL_SEC * 1000
    data = _load_login_codes()

    pruned: dict[str, dict[str, Any]] = {}
    for code, row in data.items():
        try:
            exp = int(row.get("expires", 0))
        except (TypeError, ValueError):
            exp = 0
        if exp <= now_ms:
            continue
        try:
            uid = int(row.get("user_id", 0))
        except (TypeError, ValueError):
            uid = 0
        if uid == int(telegram_user_id):
            continue
        pruned[code] = row

    username_norm = (username or "").strip().lstrip("@").lower()
    username_display = (username or "").strip().lstrip("@")
    if not username_display:
        username_display = f"id{int(telegram_user_id)}"

    for _ in range(50):
        code = f"{random.randint(0, 9999):04d}"
        if code in pruned:
            continue
        pruned[code] = {
            "user_id": int(telegram_user_id),
            "username_norm": username_norm,
            "username_display": username_display,
            "expires": expires_ms,
        }
        _save_login_codes(pruned)
        return code
    return None


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if user and user.username:
        persist_telegram_site_user(user.id, user.username)
    context.user_data.setdefault("cart", [])

    args = list(context.args) if context.args else []
    arg0 = (args[0] or "").strip() if args else ""
    low0 = arg0.lower()
    web_login_wait_id: str | None = None
    if low0.startswith("web_login_"):
        suf = arg0[len("web_login_") :].strip().lower()
        if len(suf) == 32 and all(c in "0123456789abcdef" for c in suf):
            web_login_wait_id = suf
    is_web_login = low0 == "web_login" or low0.startswith("web_login_")
    if args and is_web_login:
        code = _issue_login_code_for_user(user.id, user.username if user else None) if user else None
        if not code:
            await update.message.reply_text(
                "Не удалось создать код входа. Попробуйте ещё раз через минуту."
            )
            return
        synced = await _sync_login_code_to_site(
            code,
            int(user.id),
            user.username if user else None,
            web_login_wait_id,
        )
        if not synced:
            await update.message.reply_text(
                "Сервис входа временно недоступен. Попробуйте ещё раз через минуту."
            )
            return
        await update.message.reply_text(
            "🔐 Код для входа на сайт:\n\n"
            f"<code>{code}</code>\n\n"
            "⏳ Действует 5 минут.",
            parse_mode="HTML",
        )
        await update.message.reply_text(
            "Нажмите кнопку ниже — откроется личный кабинет, введите там 4 цифры кода.",
            reply_markup=_account_open_markup() if user else None,
        )
        return

    oid = _order_id_from_start_args(args)
    if oid:
        order = await fetch_site_order(oid)
        if not order:
            await _reply_text_with_main_menu_and_site(
                update.message,
                "Заказ не найден или сервис недоступен. Попробуйте позже.",
                telegram_user=user,
            )
            return
        if not user or not _order_belongs_to_telegram_user(order, user.id):
            await _reply_text_with_main_menu_and_site(
                update.message,
                "Это не ваш заказ.",
                telegram_user=user,
            )
            return
        _record_site_order_in_bot(oid, order, user.id)
        intro = (
            "Заказ с сайта уже записан в боте. Проверьте состав и сумму:\n\n"
        )
        text = intro + _format_order_text(order)
        st = str(order.get("status") or "new").strip().lower()
        if st in ("cancelled", "canceled"):
            await update.message.reply_text(
                text + "\n\n❌ Заказ отменён.",
                reply_markup=_order_saved_keyboard(user.id),
            )
        elif st in ("new", "confirmed"):
            await update.message.reply_text(
                text,
                reply_markup=_order_confirm_keyboard(oid, user.id),
            )
        else:
            await update.message.reply_text(
                text,
                reply_markup=_order_saved_keyboard(user.id),
            )
        await update.message.reply_text(
            "Каталог и ваши заказы — кнопками ниже.",
            reply_markup=_main_keyboard(),
        )
        return

    if not user or getattr(user, "id", None) is None:
        await update.message.reply_text("Не удалось определить пользователя.")
        return

    is_new_here = _record_first_start_and_is_new(int(user.id))
    welcome = _default_start_welcome_text(is_new_here)
    await update.message.reply_text(
        welcome,
        reply_markup=_site_open_markup(int(user.id)),
    )
    await update.message.reply_text(
        "Каталог и корзина — кнопками ниже.",
        reply_markup=_main_keyboard(),
    )


async def show_my_orders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        await update.message.reply_text("Не удалось определить пользователя.")
        return
    _load_bot_orders()
    rows = _orders_for_telegram_user(user.id)
    if not rows:
        await update.message.reply_text(
            "Пока нет заказов в боте.\n"
            "После оформления на сайте заказ появится здесь автоматически.",
        )
        return
    oids = [oid for oid, _ in rows]
    sites = await asyncio.gather(
        *[_fetch_site_order_http(oid) for oid in oids],
        return_exceptions=True,
    )
    lines: list[str] = ["📦 Мои заказы", ""]
    changed = False
    for (oid, rec), site in zip(rows, sites):
        if isinstance(site, BaseException):
            order_site: dict[str, Any] | None = None
        else:
            body, http_st = site
            if http_st == 404:
                if oid in BOT_ORDERS:
                    try:
                        del BOT_ORDERS[oid]
                        changed = True
                    except Exception:
                        pass
                continue
            order_site = body if isinstance(body, dict) else None
        if order_site is None:
            st = _merge_order_status_for_display(rec, None)
        else:
            st = _merge_order_status_for_display(rec, order_site)
        label = _order_status_display(st)
        total = _merge_total_byn(rec, order_site)
        ref = _order_id_short(oid)
        lines.append(f"#{ref} — {total:g} BYN — {label}")
    if changed:
        _persist_bot_orders()
    if len(lines) <= 2:
        await update.message.reply_text(
            "Пока нет заказов в боте.\n"
            "После оформления на сайте заказ появится здесь автоматически.",
        )
        return
    await update.message.reply_text("\n".join(lines))


async def show_cart_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        await update.message.reply_text("Не удалось определить пользователя.")
        return
    synced_cart: list[dict[str, Any]] = []
    dcode = "BY"
    state = await fetch_site_user_state(int(user.id))
    if isinstance(state, dict):
        raw = state.get("cart")
        if isinstance(raw, list):
            synced_cart = [x for x in raw if isinstance(x, dict)]
        raw_dc = state.get("delivery_country") or state.get("deliveryCountry")
        if isinstance(raw_dc, str) and raw_dc.strip().upper() in ("BY", "RU", "UA", "OTHER"):
            dcode = raw_dc.strip().upper()
    context.user_data["_delivery_cache"] = {
        "uid": int(user.id),
        "ts": time.monotonic(),
        "code": dcode,
    }
    use_byn = _use_byn_for_delivery(dcode)
    cart: list[dict[str, Any]] = (
        synced_cart if synced_cart else (context.user_data.get("cart") or [])
    )
    if not cart:
        await update.message.reply_text("Корзина пуста.")
        return
    total_main = 0.0
    lines = []
    for it in cart:
        name = str(it.get("name") or it.get("title") or "—")
        try:
            qty = int(it.get("qty", it.get("quantity", 1)))
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, qty)
        if use_byn:
            try:
                price = float(it.get("price") or it.get("priceByn", 0) or 0)
            except (TypeError, ValueError):
                price = 0.0
            sub = price * qty
            total_main += sub
            lines.append(f"• {name} ×{qty} — {sub:g} BYN")
        else:
            ur = _unit_rub_from_item(it)
            sub_r = ur * qty
            total_main += sub_r
            lines.append(f"• {name} ×{qty} — {int(round(sub_r))} RUB")
    if use_byn:
        total_suffix = f"{total_main:g} BYN"
    else:
        total_suffix = f"{int(round(total_main))} RUB"
    await update.message.reply_text(
        "🛒 Корзина\n\n" + "\n".join(lines) + f"\n\nИтого: {total_suffix}"
    )


async def show_favorites_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        await update.message.reply_text("Не удалось определить пользователя.")
        return
    state = await fetch_site_user_state(int(user.id))
    favorites_raw = state.get("favorites") if isinstance(state, dict) else []
    if not isinstance(favorites_raw, list):
        favorites_raw = []
    favorites = [x for x in favorites_raw if isinstance(x, str)]
    if not favorites:
        await update.message.reply_text("В избранном пока пусто.")
        return

    products = await load_products()
    title_by_id: dict[str, str] = {}
    for p in products:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("id") or "").strip()
        title = str(p.get("name") or "—").strip()
        if pid:
            title_by_id[pid] = title

    lines = ["❤️ Избранное", ""]
    for pid in favorites[:50]:
        lines.append(f"• {title_by_id.get(pid, f'Карточка {pid}')}")
    if len(favorites) > 50:
        lines.append("")
        lines.append(f"И ещё {len(favorites) - 50} шт.")
    await update.message.reply_text("\n".join(lines))


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    t = update.message.text.strip()
    if t == "🛒 Корзина":
        await show_cart_text(update, context)
        return
    if t == "📦 Мои заказы":
        await show_my_orders(update, context)
        return
    if t == "❤️ Избранное":
        await show_favorites_text(update, context)
        return
    if t != "📦 Категории":
        return

    products = await load_products()
    if getattr(load_products, "used_local_fallback", False):
        await update.message.reply_text("⚠️ Используются локальные данные")

    if not products:
        await update.message.reply_text("❌ Нет товаров")
        return

    categories = _categories_from_products(products)
    if not categories:
        await update.message.reply_text("❌ Нет товаров")
        return

    context.user_data["all_products"] = products
    context.user_data["_cats"] = categories
    rows = [[InlineKeyboardButton(c, callback_data=f"cat:{i}")] for i, c in enumerate(categories)]
    await update.message.reply_text(
        "Категории:",
        reply_markup=InlineKeyboardMarkup(rows),
    )


async def _resolve_delivery_for_user(context: ContextTypes.DEFAULT_TYPE, user_id: int | None) -> str:
    if user_id is None:
        return "BY"
    c = context.user_data.get("_delivery_cache")
    if isinstance(c, dict) and int(c.get("uid", 0)) == int(user_id):
        try:
            if time.monotonic() - float(c.get("ts", 0)) < 45.0:
                return str(c.get("code") or "BY")
        except (TypeError, ValueError):
            pass
    st = await fetch_site_user_state(int(user_id))
    dcode = "BY"
    if isinstance(st, dict):
        raw = st.get("delivery_country") or st.get("deliveryCountry")
        if isinstance(raw, str) and raw.strip().upper() in ("BY", "RU", "UA", "OTHER"):
            dcode = raw.strip().upper()
    context.user_data["_delivery_cache"] = {
        "uid": int(user_id),
        "ts": time.monotonic(),
        "code": dcode,
    }
    return dcode


async def _show_product_message(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    *,
    telegram_user_id: int | None,
    message_id: int | None,
) -> int:
    items: list[dict[str, Any]] = context.user_data.get("items") or []
    if not items:
        raise ValueError("no items")
    idx = int(context.user_data.get("index") or 0) % len(items)
    context.user_data["index"] = idx
    p = items[idx]
    photo = (p.get("image") or "").strip()
    dcode = await _resolve_delivery_for_user(context, telegram_user_id)
    cap = _caption(p, dcode)
    kb = _product_inline_kb()

    if message_id is not None:
        try:
            await context.bot.edit_message_media(
                chat_id=chat_id,
                message_id=message_id,
                media=InputMediaPhoto(media=photo, caption=cap),
                reply_markup=kb,
            )
            return message_id
        except Exception:
            try:
                await context.bot.edit_message_caption(
                    chat_id=chat_id,
                    message_id=message_id,
                    caption=cap,
                    reply_markup=kb,
                )
                return message_id
            except Exception:
                try:
                    await context.bot.delete_message(chat_id=chat_id, message_id=message_id)
                except Exception:
                    pass

    m = await context.bot.send_photo(
        chat_id=chat_id,
        photo=photo,
        caption=cap,
        reply_markup=kb,
    )
    return m.message_id


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    if not q or not q.data or not q.message:
        return
    data = q.data

    if data.startswith("orderok:"):
        try:
            order_id = data.split(":", 1)[1].strip()
            if not order_id:
                await q.answer("Некорректный заказ", show_alert=True)
                return
            user = q.from_user
            if not user:
                await q.answer("Ошибка", show_alert=True)
                return

            order = await fetch_site_order(order_id)
            if not order:
                await q.answer("Заказ не найден", show_alert=True)
                return
            if not _order_belongs_to_telegram_user(order, user.id):
                await q.answer("Это не ваш заказ", show_alert=True)
                return

            site_st = str(order.get("status") or "").strip().lower()
            if site_st in ("cancelled", "canceled"):
                await q.answer("Заказ уже отменён")
                try:
                    await q.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            existing = BOT_ORDERS.get(order_id)
            if isinstance(existing, dict) and str(existing.get("status") or "").strip().lower() == "confirmed":
                await q.answer("Уже подтверждён")
                try:
                    await q.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            rec = _record_site_order_in_bot(order_id, order, user.id)
            rec["status"] = "confirmed"
            BOT_ORDERS[order_id] = rec
            _persist_bot_orders()

            if not await post_site_order_status(order_id, "confirmed"):
                logger.warning("Сайт: не удалось обновить статус заказа %s", order_id)

            # Ошибка уведомления админа не должна ломать подтверждение заказа пользователю.
            admin_chat_id = _resolve_admin_chat_id()
            if admin_chat_id:
                uname = (user.username or "").strip() or None
                admin_text = _format_order_admin(order_id, order, user.id, uname, rec)
                admin_msg = None
                try:
                    admin_msg = await context.bot.send_message(
                        chat_id=admin_chat_id, text=admin_text
                    )
                except Exception as e:
                    logger.warning("admin notify: %s", e)
                mid = getattr(admin_msg, "message_id", None) if admin_msg else None
                if isinstance(mid, int) and mid > 0:
                    if not await post_site_admin_message_id(order_id, mid):
                        logger.warning(
                            "сайт: не удалось сохранить admin_message_id для %s", order_id
                        )
            else:
                logger.warning("TELEGRAM_ADMIN_CHAT_ID не задан/некорректен — админу не отправлено")

            await q.answer("Принято")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text("Заказ подтверждён. Спасибо!")
            return
        except Exception as e:
            logger.exception("order confirm failed: %s", e)
            await q.answer("Не удалось подтвердить заказ. Повторите через минуту.", show_alert=True)
            return

    if data.startswith("ordercx:"):
        try:
            order_id = data.split(":", 1)[1].strip()
            if not order_id:
                await q.answer("Некорректный заказ", show_alert=True)
                return
            user = q.from_user
            if not user:
                await q.answer("Ошибка", show_alert=True)
                return

            order = await fetch_site_order(order_id)
            if not order:
                await q.answer("Заказ не найден", show_alert=True)
                return
            if not _order_belongs_to_telegram_user(order, user.id):
                await q.answer("Это не ваш заказ", show_alert=True)
                return

            site_st = str(order.get("status") or "").strip().lower()
            if site_st in ("cancelled", "canceled"):
                await q.answer("Уже отменён")
                try:
                    await q.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            if site_st not in ("new", "confirmed", ""):
                await q.answer(
                    "На этом этапе отмена только через поддержку.",
                    show_alert=True,
                )
                return

            if site_st == "new":
                site_ok = await post_site_order_bot_delete(order_id, int(user.id))
            else:
                site_ok = await post_site_order_status(order_id, "cancelled")
            if not site_ok:
                logger.warning("Сайт: не удалось отменить/удалить заказ %s", order_id)
                await q.answer("Не удалось связаться с сайтом. Попробуйте позже.", show_alert=True)
                return

            admin_mid = order.get("telegram_admin_message_id")
            admin_chat_id = _resolve_admin_chat_id()
            if admin_mid is not None and admin_chat_id:
                try:
                    await context.bot.delete_message(
                        chat_id=int(admin_chat_id), message_id=int(admin_mid)
                    )
                except Exception as e:
                    logger.warning("admin message delete: %s", e)

            if site_st == "new":
                try:
                    if order_id in BOT_ORDERS:
                        del BOT_ORDERS[order_id]
                        _persist_bot_orders()
                except Exception:
                    pass
            else:
                rec = _record_site_order_in_bot(order_id, order, user.id)
                rec["status"] = "cancelled"
                BOT_ORDERS[order_id] = rec
                _persist_bot_orders()

            await q.answer("Заказ отменён")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text("❌ Заказ отменён. Если передумали — оформите новый на сайте.")
            return
        except Exception as e:
            logger.exception("order cancel failed: %s", e)
            await q.answer("Не удалось отменить заказ. Повторите через минуту.", show_alert=True)
            return

    await q.answer()
    chat_id = q.message.chat_id

    if data.startswith("cat:"):
        ci = int(data.split(":", 1)[1])
        cats: list[str] = context.user_data.get("_cats") or []
        all_p: list[dict[str, Any]] = context.user_data.get("all_products") or []
        if ci < 0 or ci >= len(cats) or not all_p:
            await q.edit_message_text("❌ Нет товаров")
            return
        cat = cats[ci]
        items = [p for p in all_p if p.get("category") == cat]
        if not items:
            await q.edit_message_text("❌ Нет товаров")
            return
        context.user_data["items"] = items
        context.user_data["index"] = 0
        try:
            await q.message.delete()
        except Exception:
            pass
        uid = q.from_user.id if q.from_user else None
        mid = await _show_product_message(
            context, chat_id, telegram_user_id=uid, message_id=None
        )
        context.user_data["product_message_id"] = mid
        return

    if not data.startswith("nav:"):
        return

    action = data.split(":", 1)[1]

    if action == "back":
        products = await load_products()
        if getattr(load_products, "used_local_fallback", False):
            await context.bot.send_message(
                chat_id=chat_id,
                text="⚠️ Используются локальные данные",
            )
        if not products:
            await q.answer("❌ Нет товаров", show_alert=True)
            return
        categories = _categories_from_products(products)
        if not categories:
            await q.answer("❌ Нет товаров", show_alert=True)
            return
        context.user_data["all_products"] = products
        context.user_data["_cats"] = categories
        try:
            await q.message.delete()
        except Exception:
            pass
        rows = [[InlineKeyboardButton(c, callback_data=f"cat:{i}")] for i, c in enumerate(categories)]
        await context.bot.send_message(
            chat_id=chat_id,
            text="Категории:",
            reply_markup=InlineKeyboardMarkup(rows),
        )
        context.user_data["product_message_id"] = None
        return

    items = context.user_data.get("items") or []

    if not items:
        await q.answer("❌ Нет товаров", show_alert=True)
        return

    i = int(context.user_data.get("index") or 0)
    n = len(items)
    if action == "prev":
        i = (i - 1) % n
    elif action == "next":
        i = (i + 1) % n
    elif action == "add":
        p = items[i]
        cart: list[dict[str, Any]] = context.user_data.setdefault("cart", [])
        pid = p.get("id")
        hit = next((x for x in cart if str(x.get("id")) == str(pid)), None)
        if hit:
            hit["qty"] = int(hit.get("qty", 1)) + 1
        else:
            cart.append(
                {
                    "id": pid,
                    "name": p.get("name"),
                    "price": float(p.get("price") or 0),
                    "qty": 1,
                }
            )
        await q.answer("В корзину")
    else:
        return

    context.user_data["index"] = i
    mid_old = context.user_data.get("product_message_id")
    uid = q.from_user.id if q.from_user else None
    mid = await _show_product_message(
        context, chat_id, telegram_user_id=uid, message_id=mid_old
    )
    context.user_data["product_message_id"] = mid


if __name__ == "__main__":
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise Exception("Нет TELEGRAM_BOT_TOKEN")

    _load_bot_orders()

    app = ApplicationBuilder().token(token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("🚀 Bot started")

    app.run_polling()
