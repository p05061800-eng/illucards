#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import random
import re
import time
from pathlib import Path
from typing import Any

import aiohttp
from aiohttp import web
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.error import Conflict, InvalidToken
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
# tg user_id → order_id: ждём текст с данными доставки после подтверждения админом
_AWAIT_ORDER_DETAILS: dict[int, str] = {}
# Последний заказ с сайта по sync (для callback_data confirm_order / cancel_order).
_PENDING_ORDER_BY_USER: dict[int, str] = {}
# Снимок заказа с сайта (sync / уведомление) — если GET /api/order временно недоступен.
_ORDER_SNAPSHOTS: dict[str, dict[str, Any]] = {}
LOGIN_CODE_TTL_SEC = 5 * 60
# Telegram Application (post_init) — для push-уведомлений из HTTP sync.
_TG_APP: Any = None


def _sync_secret_ok(request: web.Request) -> bool:
    need = (os.getenv("TELEGRAM_SYNC_API_SECRET") or "").strip()
    order_secret = (os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET") or "").strip()
    if not need and not order_secret:
        return True
    x = (request.headers.get("X-Sync-Secret") or "").strip()
    if need and x == need:
        return True
    auth = (request.headers.get("Authorization") or "").strip()
    bearer = auth[7:].strip() if auth.startswith("Bearer ") else ""
    if bearer:
        if need and bearer == need:
            return True
        if order_secret and bearer == order_secret:
            return True
    return False


def _load_telegram_site_users() -> dict[str, dict[str, Any]]:
    if not TELEGRAM_USERS_PATH.exists():
        return {}
    try:
        with open(TELEGRAM_USERS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return {}
        return {str(k).lower(): v for k, v in raw.items() if isinstance(v, dict)}
    except (OSError, json.JSONDecodeError, ValueError):
        return {}


def _find_telegram_user_by_username(username: str) -> dict[str, Any] | None:
    norm = (username or "").strip().lstrip("@").lower()
    if not norm:
        return None
    row = _load_telegram_site_users().get(norm)
    if not isinstance(row, dict):
        return None
    try:
        uid = int(row.get("user_id", 0))
    except (TypeError, ValueError):
        return None
    if uid <= 0:
        return None
    return {"user_id": uid, "username": str(row.get("username") or norm)}


def _consume_login_code(
    code_raw: str, username: str | None = None
) -> dict[str, Any] | None:
    digits = re.sub(r"\D", "", code_raw or "")
    if len(digits) != 4:
        return None
    now_ms = int(time.time() * 1000)
    data = _load_login_codes()
    row = data.get(digits)
    if not isinstance(row, dict):
        return None
    try:
        exp = int(row.get("expires", 0))
    except (TypeError, ValueError):
        exp = 0
    if exp <= now_ms:
        del data[digits]
        _save_login_codes(data)
        return None
    if username:
        un_norm = (username or "").strip().lstrip("@").lower()
        row_norm = str(row.get("username_norm") or "").strip().lower()
        if un_norm and row_norm and un_norm != row_norm:
            return None
    del data[digits]
    _save_login_codes(data)
    return row


def _verify_telegram_login_widget(data: dict[str, Any]) -> bool:
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        return False
    received = str(data.get("hash") or "").strip()
    if not received:
        return False
    auth_date = data.get("auth_date")
    try:
        ts = int(auth_date)
    except (TypeError, ValueError):
        return False
    now = int(time.time())
    if now - ts > 86400 or ts - now > 60:
        return False
    pairs: list[str] = []
    for key in sorted(data.keys()):
        if key == "hash":
            continue
        val = data[key]
        if val is None:
            continue
        if key in ("id", "auth_date"):
            try:
                pairs.append(f"{key}={int(val)}")
            except (TypeError, ValueError):
                pairs.append(f"{key}={val}")
        else:
            s = str(val).strip()
            if s:
                pairs.append(f"{key}={s}")
    check_string = "\n".join(pairs)
    secret_key = hashlib.sha256(token.encode("utf-8")).digest()
    computed = hmac.new(
        secret_key, check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, received)


ORDER_STATUS_NOTIFY_RU: dict[str, str] = {
    "accepted": "✅ Заказ принят",
    "confirmed": "✅ Заказ принят",
    "shipped": "🚚 Заказ отправлен",
    "sent": "🚚 Заказ отправлен",
    "done": "✅ Заказ выполнен",
    "delivered": "✅ Заказ выполнен",
    "cancelled": "❌ Заказ отменён",
    "canceled": "❌ Заказ отменён",
}


async def _send_code_http(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    username = str(body.get("username") or "").strip()
    row = _find_telegram_user_by_username(username)
    if not row:
        return web.json_response({"error": "Пользователь не писал боту"}, status=404)
    uid = int(row["user_id"])
    un = str(row.get("username") or username).strip().lstrip("@")
    code = _issue_login_code_for_user(uid, un or None)
    if not code:
        return web.json_response({"error": "Не удалось создать код"}, status=500)
    await _sync_login_code_to_site(code, uid, un or None, None)
    if _TG_APP is None:
        return web.json_response({"error": "Bot not ready"}, status=503)
    text = (
        "🔐 Ваш код для входа:\n\n"
        f"<code>{code}</code>\n\n"
        "⏳ Действует 5 минут"
    )
    try:
        await _TG_APP.bot.send_message(
            chat_id=uid, text=text, parse_mode="HTML"
        )
    except Exception as e:
        logger.warning("send-code telegram: %s", e)
        return web.json_response(
            {"error": "Не удалось отправить код в Telegram"}, status=502
        )
    return web.json_response({"ok": True})


async def _verify_code_http(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    code = str(body.get("code") or "")
    username = str(body.get("username") or "").strip() or None
    row = _consume_login_code(code, username)
    if not row:
        return web.json_response(
            {"error": "Неверный или просроченный код"}, status=401
        )
    try:
        uid = int(row.get("user_id"))
    except (TypeError, ValueError):
        return web.json_response({"error": "Invalid code record"}, status=500)
    username_display = str(
        row.get("username_display") or row.get("username_norm") or ""
    ).strip()
    return web.json_response(
        {
            "ok": True,
            "user_id": uid,
            "username": username_display or None,
        }
    )


async def _telegram_auth_http(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    if not _verify_telegram_login_widget(body):
        return web.json_response({"error": "Invalid hash"}, status=401)
    try:
        tid = int(body.get("id"))
    except (TypeError, ValueError):
        return web.json_response({"error": "Invalid id"}, status=400)
    if tid <= 0:
        return web.json_response({"error": "Invalid id"}, status=400)
    first_name = str(body.get("first_name") or "Пользователь").strip()
    last_name_raw = body.get("last_name")
    last_name = (
        str(last_name_raw).strip()
        if isinstance(last_name_raw, str) and last_name_raw.strip()
        else None
    )
    username_raw = body.get("username")
    username = (
        str(username_raw).strip()
        if isinstance(username_raw, str) and username_raw.strip()
        else None
    )
    photo_raw = body.get("photo_url")
    photo_url = (
        str(photo_raw).strip()
        if isinstance(photo_raw, str) and photo_raw.strip()
        else None
    )
    if username:
        persist_telegram_site_user(tid, username)
    return web.json_response(
        {
            "ok": True,
            "profile": {
                "telegramId": tid,
                "firstName": first_name,
                "lastName": last_name,
                "username": username,
                "photoUrl": photo_url,
            },
        }
    )


async def _notify_http(request: web.Request) -> web.Response:
    if not _sync_secret_ok(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    if _TG_APP is None:
        return web.json_response({"error": "Bot not ready"}, status=503)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    target = str(body.get("target") or "").strip().lower()
    if target == "customer":
        try:
            uid = int(body.get("telegramUserId") or body.get("user_id"))
        except (TypeError, ValueError):
            return web.json_response({"error": "Invalid telegramUserId"}, status=400)
        text = str(body.get("text") or "").strip()
        if not text and body.get("event") == "order_status":
            st = str(body.get("status") or "").strip().lower()
            text = ORDER_STATUS_NOTIFY_RU.get(st, f"Статус заказа: {st}")
        if not text:
            return web.json_response({"error": "Empty text"}, status=400)
        try:
            await _TG_APP.bot.send_message(chat_id=uid, text=text)
        except Exception as e:
            logger.warning("notify customer: %s", e)
            return web.json_response({"error": "Send failed"}, status=502)
        return web.json_response({"ok": True})
    if target == "admin":
        admin_chat = _resolve_admin_chat_id()
        if not admin_chat:
            return web.json_response({"error": "Admin chat not configured"}, status=503)
        if str(body.get("action") or "") == "delete_message":
            try:
                mid = int(body.get("messageId") or body.get("message_id"))
            except (TypeError, ValueError):
                return web.json_response({"error": "Invalid messageId"}, status=400)
            try:
                await _TG_APP.bot.delete_message(
                    chat_id=int(admin_chat), message_id=int(mid)
                )
            except Exception as e:
                logger.warning("notify admin delete: %s", e)
            return web.json_response({"ok": True})
        text = str(body.get("text") or "").strip()
        if not text:
            return web.json_response({"error": "Empty text"}, status=400)
        try:
            await _TG_APP.bot.send_message(chat_id=int(admin_chat), text=text)
        except Exception as e:
            logger.warning("notify admin: %s", e)
            return web.json_response({"error": "Send failed"}, status=502)
        return web.json_response({"ok": True})
    return web.json_response({"error": "Unknown target"}, status=400)


def _parse_sync_user_id(raw: Any) -> int | None:
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return None
    if n <= 0 or n > 10**12:
        return None
    return n


def _parse_sync_cart(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw[:200]:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id") or row.get("ref") or "").strip()[:120]
        title = str(row.get("title") or row.get("name") or "").strip()[:300]
        if not cid or not title:
            continue
        try:
            qty = int(row.get("quantity", row.get("qty", 1)))
        except (TypeError, ValueError):
            qty = 1
        try:
            price_byn = float(row.get("priceByn", row.get("price", 0)) or 0)
        except (TypeError, ValueError):
            price_byn = 0.0
        try:
            price_rub = int(round(float(row.get("priceRub", row.get("price_rub", 0)) or 0)))
        except (TypeError, ValueError):
            price_rub = 0
        out.append(
            {
                "id": cid,
                "title": title,
                "quantity": max(1, min(99, qty)),
                "priceByn": price_byn,
                "priceRub": price_rub,
            }
        )
    return out


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


def _delete_bot_order(order_id: str) -> None:
    oid = str(order_id or "").strip()
    if not oid:
        return
    if oid in BOT_ORDERS:
        del BOT_ORDERS[oid]
        _persist_bot_orders()


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
        "Нажмите «Открыть сайт» — вход на сайте привяжется к этому Telegram."
    )
    if is_first:
        return "Привет! Спасибо за авторизацию.\n\n" + base
    return "С возвращением!\n\n" + base


# Статусы: из bot-orders и (при появлении) с сайта
ORDER_STATUS_RU: dict[str, str] = {
    "new": "⏳ Новый",
    "confirmed": "✅ Принят",
    "accepted": "✅ Принят",
    "paid": "💳 Чек получен",
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


def _remember_pending_order_for_user(telegram_user_id: int, order_id: str) -> None:
    oid = str(order_id or "").strip()
    if oid:
        _PENDING_ORDER_BY_USER[int(telegram_user_id)] = oid


def _cache_order_snapshot(
    order_id: str, order: dict[str, Any], telegram_user_id: int
) -> None:
    oid = str(order_id or "").strip()
    if not oid:
        return
    snap = dict(order)
    snap["user_id"] = int(telegram_user_id)
    if "status" not in snap or not str(snap.get("status") or "").strip():
        snap["status"] = "new"
    if "items" not in snap or not isinstance(snap.get("items"), list):
        snap["items"] = _order_items_list(snap)
    _ORDER_SNAPSHOTS[oid] = snap
    _remember_pending_order_for_user(telegram_user_id, oid)


def _order_dict_from_bot_record(rec: dict[str, Any], uid: int) -> dict[str, Any]:
    order = dict(rec)
    order["items"] = _order_items_list(order)
    order.setdefault("total", _order_total_byn(order))
    order.setdefault("delivery", order.get("delivery") or "BY")
    order["user_id"] = int(rec.get("user_id") or uid)
    return order


async def _load_order_for_callback(
    order_id: str, telegram_user_id: int
) -> dict[str, Any] | None:
    """Заказ для inline-кнопок: снимок sync → память бота → API сайта → файл bot-orders."""
    oid = str(order_id or "").strip()
    if not oid:
        return None
    uid = int(telegram_user_id)

    snap = _ORDER_SNAPSHOTS.get(oid)
    if isinstance(snap, dict):
        order = dict(snap)
        order["items"] = _order_items_list(order)
        order.setdefault("total", _order_total_byn(order))
        order.setdefault("delivery", order.get("delivery") or "BY")
        order["user_id"] = uid
        _record_site_order_in_bot(oid, order, uid)
        return order

    existing = BOT_ORDERS.get(oid)
    if isinstance(existing, dict):
        order = _order_dict_from_bot_record(existing, uid)
        _cache_order_snapshot(oid, order, uid)
        return order

    body = await fetch_site_order(oid)
    if isinstance(body, dict):
        order = dict(body)
        order["items"] = _order_items_list(order)
        order.setdefault("total", _order_total_byn(order))
        order.setdefault("delivery", order.get("delivery") or "BY")
        order["user_id"] = uid
        _cache_order_snapshot(oid, order, uid)
        _record_site_order_in_bot(oid, order, uid)
        return order

    _load_bot_orders()
    existing = BOT_ORDERS.get(oid)
    if isinstance(existing, dict):
        order = _order_dict_from_bot_record(existing, uid)
        _cache_order_snapshot(oid, order, uid)
        return order

    return None


def _resolve_order_id_for_site_callback(
    telegram_user_id: int, *, prefer_status: str = "new"
) -> str | None:
    """order_id для confirm_order / cancel_order: sync → последний new у пользователя."""
    uid = int(telegram_user_id)
    pending = _PENDING_ORDER_BY_USER.get(uid)
    if pending and pending in BOT_ORDERS:
        rec = BOT_ORDERS.get(pending)
        if isinstance(rec, dict):
            st = str(rec.get("status") or "new").strip().lower()
            if prefer_status == "new" and st in ("new", "confirmed"):
                return pending
            if prefer_status == "any":
                return pending
    _load_bot_orders()
    found: str | None = None
    for oid, rec in BOT_ORDERS.items():
        if not isinstance(rec, dict):
            continue
        try:
            if int(rec.get("user_id", 0)) != uid:
                continue
        except (TypeError, ValueError):
            continue
        st = str(rec.get("status") or "new").strip().lower()
        if prefer_status == "new" and st not in ("new", "confirmed"):
            continue
        found = oid
    return found


async def _sync_cart_http(request: web.Request) -> web.Response:
    if not _sync_secret_ok(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    user_id = _parse_sync_user_id(body.get("user_id") or body.get("telegram_user_id"))
    if user_id is None:
        return web.json_response({"error": "Invalid user_id"}, status=400)
    cart = _parse_sync_cart(body.get("cart"))
    if not cart:
        cart = _parse_sync_cart(body.get("items"))
    order = body.get("order")
    order_id = str(body.get("order_id") or "").strip()
    if isinstance(order, dict):
        order_id = str(order.get("order_id") or order.get("id") or order_id).strip()
    if order_id and isinstance(order, dict):
        normalized_order = dict(order)
        normalized_order["user_id"] = user_id
        if "items" not in normalized_order:
            normalized_order["items"] = cart
        if "status" not in normalized_order:
            normalized_order["status"] = "new"
        rec = _record_site_order_in_bot(order_id, normalized_order, user_id)
        _cache_order_snapshot(order_id, normalized_order, user_id)
        st = str(normalized_order.get("status") or "new").strip().lower()
        if st == "new" and not body.get("skip_buyer_notify"):
            await _push_site_order_notifications(
                order_id, normalized_order, user_id, rec
            )
    return web.json_response({"ok": True, "user_id": user_id, "cart_count": len(cart), "order_id": order_id})


async def _health_http(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True})


async def _push_site_order_notifications(
    order_id: str,
    order: dict[str, Any],
    telegram_user_id: int,
    record: dict[str, Any],
) -> None:
    """Резерв: сообщение покупателю, если с Vercel не ушло (sync после order/create)."""
    if _TG_APP is None:
        return
    uid = int(telegram_user_id)
    oid = str(order_id or "").strip()
    _cache_order_snapshot(oid, order, uid)
    body = _build_order_draft_message(order, oid)
    try:
        await _TG_APP.bot.send_message(
            chat_id=uid,
            text=SITE_ORDER_INTRO,
            reply_markup=_main_keyboard(),
        )
        await _TG_APP.bot.send_message(
            chat_id=uid,
            text=body,
            reply_markup=_order_draft_keyboard(oid),
        )
    except Exception as e:
        logger.warning("site order notify user (sync backup) %s: %s", uid, e)
        return
    await post_site_mark_buyer_notified(oid, order, uid)


async def _await_details_http(request: web.Request) -> web.Response:
    """Сайт/админка: пометить, что ждём от покупателя текст с данными доставки."""
    if not _sync_secret_ok(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Expected object"}, status=400)
    try:
        uid = int(body.get("user_id"))
        oid = str(body.get("order_id") or "").strip()
    except (TypeError, ValueError):
        return web.json_response({"error": "Invalid user_id"}, status=400)
    if uid <= 0 or not oid:
        return web.json_response({"error": "Invalid payload"}, status=400)
    _AWAIT_ORDER_DETAILS[uid] = oid
    return web.json_response({"ok": True})


async def _telegram_error_handler(
    _update: object, context: ContextTypes.DEFAULT_TYPE
) -> None:
    err = context.error
    if isinstance(err, Conflict):
        logger.error(
            "409 Conflict: другой процесс уже делает getUpdates с TELEGRAM_BOT_TOKEN. "
            "Остановите все другие инстансы бота (старый Render-сервис, локальный bot.py, "
            "репозиторий telegram-bot). На Vercel не должно быть TELEGRAM_BOT_TOKEN. "
            "Если не помогает — BotFather → Revoke token → новый токен только на Render."
        )
        return
    logger.exception("Telegram handler error: %s", err)


async def _start_http_server(_app: Any) -> None:
    global _TG_APP
    _TG_APP = _app
    try:
        await _app.bot.delete_webhook(drop_pending_updates=True)
        wh = await _app.bot.get_webhook_info()
        url = str(getattr(wh, "url", "") or "").strip()
        if url:
            logger.warning("Webhook still set (%s), retry delete", url)
            await _app.bot.delete_webhook(drop_pending_updates=True)
        me = await _app.bot.get_me()
        logger.info(
            "Telegram bot @%s ready (polling, webhook cleared)",
            getattr(me, "username", "?"),
        )
    except Exception as e:
        logger.warning("Telegram startup check: %s", e)
    port_raw = os.getenv("PORT", "").strip()
    if not port_raw:
        return
    try:
        port = int(port_raw)
    except ValueError:
        return
    http_app = web.Application()
    http_app.router.add_get("/", _health_http)
    http_app.router.add_get("/health", _health_http)
    http_app.router.add_post("/api/sync/cart", _sync_cart_http)
    http_app.router.add_post("/api/await-order-details", _await_details_http)
    http_app.router.add_post("/api/send-code", _send_code_http)
    http_app.router.add_post("/api/verify-code", _verify_code_http)
    http_app.router.add_post("/api/telegram-auth", _telegram_auth_http)
    http_app.router.add_post("/api/notify", _notify_http)
    runner = web.AppRunner(http_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info("HTTP sync server started on port %s", port)


def _format_order_admin(
    order_id: str,
    order: dict[str, Any],
    telegram_user_id: int,
    username: str | None,
    record: dict[str, Any],
    *,
    header: str = "✅ Подтверждение заказа (бот)",
) -> str:
    u = f"@{username}" if username else f"id {telegram_user_id}"
    lines = [
        header,
        f"ID заказа: `{order_id}`",
        f"Пользователь: {u} (tg {telegram_user_id})",
        "",
    ]
    dcode = _delivery_price_code(order.get("delivery") or "BY")
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
    pm = str(order.get("payment_method") or record.get("payment_method") or "").strip().lower()
    if pm:
        lines.append(f"💳 Способ оплаты: {_payment_method_label(pm)}")
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
PROMO_SLIDES_PATH = REPO_ROOT / "data" / "promo-slides.json"
# Ссылка «вход на сайт» (?user_id=<telegram id>) — по умолчанию на www-домен.
SITE_LOGIN_ORIGIN = os.getenv("ILLUCARDS_SITE_LOGIN_ORIGIN", "https://www.illucards.by").rstrip("/")
CARDS_PATH = Path(__file__).resolve().parent / "cards.json"

DELIVERY_LABELS: dict[str, str] = {
    "BY": "Беларусь",
    "RU": "Россия",
    "UA": "Украина",
    "OTHER": "Другие страны",
}

DELIVERY_FLAGS: dict[str, str] = {
    "BY": "🇧🇾",
    "RU": "🇷🇺",
    "UA": "🇺🇦",
    "OTHER": "🌍",
}

BONUS_POINTS_PER_CARD_UNIT = 100

BYN_TO_RUB = 30.0


def _delivery_price_code(raw: Any) -> str:
    if isinstance(raw, dict):
        raw = (
            raw.get("country")
            or raw.get("code")
            or raw.get("deliveryCountry")
            or raw.get("delivery_country")
        )
    u = (str(raw or "")).strip().upper()
    if u in ("BY", "BYN", "BELARUS"):
        return "BY"
    if u in ("RU", "RUB", "RUSSIA"):
        return "RU"
    if u in ("UA", "UKRAINE"):
        return "UA"
    if u in ("OT", "OTHER"):
        return "OTHER"
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


def _delivery_charge_byn(dcode: str) -> float:
    d = _delivery_price_code(dcode)
    return round(_delivery_charge_rub(d) / BYN_TO_RUB, 2)


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
    flag = DELIVERY_FLAGS.get(dcode, "🌍")
    if _use_byn_for_delivery(dcode):
        charge = _delivery_charge_byn(dcode)
        return f"🚚 Доставка: {flag} {label} — {charge:g} BYN"
    rub = _delivery_charge_rub(dcode)
    return f"🚚 Доставка: {flag} {label} — {rub:,} RUB".replace(",", " ")


def _order_goods_total_rub(order: dict[str, Any]) -> int:
    items = order.get("items")
    if not isinstance(items, list):
        return 0
    total = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            qty = max(1, int(it.get("quantity", 1)))
        except (TypeError, ValueError):
            qty = 1
        total += int(round(_unit_rub_from_item(it))) * qty
    return total


def _order_checkout_display_total(order: dict[str, Any]) -> tuple[float, str]:
    """(amount, currency label fragment) — как в корзине на сайте."""
    dcode = _delivery_price_code(order.get("delivery") or "BY")
    try:
        total_byn = float(order.get("total", 0) or 0)
    except (TypeError, ValueError):
        total_byn = 0.0
    try:
        spent = max(0, int(order.get("bonus_points_spent") or 0))
    except (TypeError, ValueError):
        spent = 0
    if _use_byn_for_delivery(dcode):
        return total_byn, "BYN"
    goods_rub = _order_goods_total_rub(order)
    del_rub = _delivery_charge_rub(dcode)
    rub_total = max(0, goods_rub + del_rub - spent)
    return float(rub_total), "RUB"


def _format_bonus_discount_order(order: dict[str, Any]) -> str:
    dcode = _delivery_price_code(order.get("delivery") or "BY")
    try:
        spent = max(0, int(order.get("bonus_points_spent") or 0))
    except (TypeError, ValueError):
        spent = 0
    if spent <= 0:
        return ""
    if _use_byn_for_delivery(dcode):
        disc = spent * (3.5 / 100.0)
        return f"{disc:g} BYN"
    return f"{spent:,} RUB".replace(",", " ")


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

_promo_cache: list[dict[str, Any]] | None = None
_promo_cache_ts: float = 0.0
_promo_cache_from_fallback: bool = False


def _parse_promo_slides_payload(data: Any) -> list[dict[str, Any]]:
    raw_items: Any = []
    if isinstance(data, dict) and "items" in data and isinstance(data["items"], list):
        raw_items = data["items"]
    elif isinstance(data, list):
        raw_items = data
    out: list[dict[str, Any]] = []
    for row in raw_items:
        if not isinstance(row, dict):
            continue
        pid = str(row.get("id") or "").strip()
        image_url = str(row.get("imageUrl") or row.get("image_url") or "").strip()
        href = str(row.get("href") or "").strip()
        if not pid or not image_url:
            continue
        out.append({"id": pid, "imageUrl": image_url, "href": href})
    return out


def _load_promo_slides_local() -> list[dict[str, Any]]:
    if not PROMO_SLIDES_PATH.exists():
        return []
    with open(PROMO_SLIDES_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return _parse_promo_slides_payload(raw)


async def _fetch_promo_slides_api() -> list[dict[str, Any]] | None:
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/promo-slides"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers={"Accept": "application/json"}) as resp:
                if resp.status != 200:
                    logger.warning("API promo-slides HTTP %s", resp.status)
                    return None
                try:
                    raw = await resp.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError, ValueError) as e:
                    logger.warning("API promo-slides JSON: %s", e)
                    return None
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("API promo-slides network: %s", e)
        return None
    slides = _parse_promo_slides_payload(raw)
    return slides


async def load_promo_slides() -> list[dict[str, Any]]:
    """Баннеры «Акции на главной» с сайта (как в админке); кеш 60 с; fallback — data/promo-slides.json."""
    global _promo_cache, _promo_cache_ts, _promo_cache_from_fallback

    now = time.monotonic()
    if _promo_cache is not None and (now - _promo_cache_ts) < CACHE_TTL_SEC:
        load_promo_slides.used_local_fallback = _promo_cache_from_fallback  # type: ignore[attr-defined]
        return list(_promo_cache)

    api_list = await _fetch_promo_slides_api()
    if api_list is not None:
        _promo_cache = api_list
        _promo_cache_ts = now
        _promo_cache_from_fallback = False
        load_promo_slides.used_local_fallback = False  # type: ignore[attr-defined]
        return list(api_list)

    try:
        local_list = _load_promo_slides_local()
    except (OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("promo-slides local: %s", e)
        local_list = []

    _promo_cache = local_list
    _promo_cache_ts = now
    _promo_cache_from_fallback = True
    load_promo_slides.used_local_fallback = True  # type: ignore[attr-defined]
    return list(local_list)


load_promo_slides.used_local_fallback = False  # type: ignore[attr-defined]


def _absolute_asset_url(origin: str, path_or_url: str) -> str:
    u = (path_or_url or "").strip()
    if not u:
        return origin + "/"
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("/"):
        return origin.rstrip("/") + u
    return origin.rstrip("/") + "/" + u


def _promo_open_url(origin: str, href: str) -> str:
    """Полный URL для кнопки «На сайте» (Telegram требует http(s))."""
    h = (href or "").strip()
    if not h:
        return origin + "/"
    if h.startswith("http://") or h.startswith("https://"):
        return h
    if h.startswith("//"):
        return "https:" + h
    if h.startswith("#"):
        return origin.rstrip("/") + h
    if h.startswith("/"):
        return origin.rstrip("/") + h
    return h


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
            ["💬 Связь", "📦 Мои заказы"],
            ["🚚 Доставка", "⭐ Бонусы"],
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


def _promo_inline_kb(
    slides: list[dict[str, Any]], idx: int, site_origin: str
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if slides:
        s = slides[idx % len(slides)]
        href = str(s.get("href") or "").strip()
        if href:
            rows.append(
                [
                    InlineKeyboardButton(
                        "🔗 На сайте",
                        url=_promo_open_url(site_origin, href),
                    )
                ]
            )
    rows.append(
        [
            InlineKeyboardButton("◀️", callback_data="promo:prev"),
            InlineKeyboardButton("▶️", callback_data="promo:next"),
        ]
    )
    rows.append([InlineKeyboardButton("⬅️ Назад", callback_data="promo:back")])
    return InlineKeyboardMarkup(rows)


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
    secret = (os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET") or "").strip()
    headers: dict[str, str] = {"Accept": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url,
                headers=headers,
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


async def _cart_snapshot_for_user(
    context: ContextTypes.DEFAULT_TYPE,
    telegram_user_id: int,
) -> tuple[list[dict[str, Any]], str, int, bool]:
    """Корзина для показа/оформления: сначала синхрон с сайта, затем локальная корзина бота."""
    synced_cart: list[dict[str, Any]] = []
    dcode = "BY"
    bonus_points = 0
    state = await fetch_site_user_state(int(telegram_user_id))
    if isinstance(state, dict):
        raw = state.get("cart")
        if isinstance(raw, list):
            synced_cart = [x for x in raw if isinstance(x, dict)]
        raw_dc = state.get("delivery_country") or state.get("deliveryCountry")
        if isinstance(raw_dc, str) and raw_dc.strip().upper() in ("BY", "RU", "UA", "OTHER"):
            dcode = raw_dc.strip().upper()
        bp_raw = state.get("bonus_points")
        if isinstance(bp_raw, (int, float)) and bp_raw >= 0:
            bonus_points = int(bp_raw)
        elif isinstance(bp_raw, str) and bp_raw.strip().isdigit():
            bonus_points = int(bp_raw.strip())
    context.user_data["_delivery_cache"] = {
        "uid": int(telegram_user_id),
        "ts": time.monotonic(),
        "code": dcode,
    }
    local_cart = context.user_data.get("cart") or []
    cart = synced_cart if synced_cart else (local_cart if isinstance(local_cart, list) else [])
    return cart, dcode, bonus_points, bool(synced_cart)


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


async def post_site_mark_buyer_notified(
    order_id: str,
    order: dict[str, Any] | None = None,
    owner_id: int | None = None,
) -> bool:
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/update"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    payload: dict[str, Any] = {
        "order_id": order_id,
        "telegram_buyer_notified": True,
    }
    if isinstance(order, dict):
        oid = owner_id if owner_id is not None else _order_owner_user_id(order_id, order)
        if oid is not None:
            payload["user_id"] = int(oid)
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning(
                        "POST order/update (buyer notified) HTTP %s: %s",
                        resp.status,
                        text,
                    )
                    return False
                return True
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("POST order/update (buyer notified): %s", e)
        return False


async def post_site_order_payment_method(
    order_id: str,
    payment_method: str,
    order: dict[str, Any] | None = None,
    owner_id: int | None = None,
) -> bool:
    """POST /api/order/update — сохранить способ оплаты."""
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/update"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    payload: dict[str, Any] = {
        "order_id": order_id,
        "payment_method": payment_method,
    }
    if isinstance(order, dict):
        oid = owner_id if owner_id is not None else _order_owner_user_id(order_id, order)
        if oid is not None:
            payload["user_id"] = int(oid)
        payload["items"] = _order_items_list(order)
        payload["total"] = _order_total_byn(order)
        payload["delivery"] = _delivery_price_code(str(order.get("delivery") or "BY"))
        username = str(order.get("username") or "").strip().lstrip("@")
        if username:
            payload["username"] = username
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    text = (await resp.text())[:300]
                    logger.warning(
                        "POST order/update (payment) HTTP %s: %s", resp.status, text
                    )
                    return False
                return True
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        logger.warning("POST order/update (payment): %s", e)
        return False


async def post_site_order_status(
    order_id: str,
    status: str,
    order: dict[str, Any] | None = None,
    owner_id: int | None = None,
) -> bool:
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
    payload: dict[str, Any] = {"order_id": order_id, "status": status}
    if isinstance(order, dict):
        oid = owner_id if owner_id is not None else _order_owner_user_id(order_id, order)
        if oid is not None:
            payload["user_id"] = int(oid)
        payload["items"] = _order_items_list(order)
        payload["total"] = _order_total_byn(order)
        payload["delivery"] = _delivery_price_code(str(order.get("delivery") or "BY"))
        username = str(order.get("username") or "").strip().lstrip("@")
        if username:
            payload["username"] = username
    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                headers=headers,
                json=payload,
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


def _site_order_items_from_cart(cart: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for it in cart:
        if not isinstance(it, dict):
            continue
        cid = str(it.get("id") or it.get("ref") or "").strip()
        title = str(it.get("title") or it.get("name") or "").strip()
        try:
            qty = int(it.get("quantity", it.get("qty", 1)))
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, min(99, qty))
        try:
            price_byn = float(it.get("priceByn", it.get("price", 0)) or 0)
        except (TypeError, ValueError):
            price_byn = 0.0
        price_rub = int(round(_unit_rub_from_item(it)))
        if not cid or not title:
            continue
        items.append(
            {
                "id": cid[:120],
                "title": title[:300],
                "quantity": qty,
                "priceByn": max(0.0, price_byn),
                "priceRub": max(0, price_rub),
            }
        )
    return items


async def post_site_order_from_bot(
    telegram_user_id: int,
    username: str | None,
    cart: list[dict[str, Any]],
    delivery_code: str,
    order_id: str | None = None,
) -> dict[str, Any] | None:
    """Создать заказ на сайте из корзины Telegram-бота, чтобы он появился в ЛК."""
    items = _site_order_items_from_cart(cart)
    if not items:
        return None
    goods_byn = sum(float(it["priceByn"]) * int(it["quantity"]) for it in items)
    total_byn = round(goods_byn + _delivery_charge_byn(delivery_code), 2)
    base = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    url = f"{base}/api/order/from-bot"
    secret = os.getenv("ILLUCARDS_ORDER_UPDATE_SECRET", "").strip()
    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    payload = {
        "user_id": int(telegram_user_id),
        "username": username,
        "items": items,
        "total": total_byn,
        "delivery": _delivery_price_code(delivery_code),
        "status": "confirmed",
    }
    if order_id:
        payload["order_id"] = order_id
    timeout = aiohttp.ClientTimeout(total=25)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                data = await resp.json(content_type=None)
                if resp.status != 200 or not isinstance(data, dict):
                    logger.warning("POST order/from-bot HTTP %s: %s", resp.status, str(data)[:300])
                    return None
                return data
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
        logger.warning("POST order/from-bot: %s", e)
        return None


def _bonus_points_to_earn(order: dict[str, Any]) -> int:
    items = order.get("items")
    if not isinstance(items, list):
        return 0
    qty = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            qty += max(0, int(it.get("quantity", 1)))
        except (TypeError, ValueError):
            qty += 1
    return qty * BONUS_POINTS_PER_CARD_UNIT


def _order_item_lines(order: dict[str, Any]) -> list[str]:
    items = order.get("items")
    if not isinstance(items, list):
        items = []
    dcode = _delivery_price_code(order.get("delivery") or "BY")
    use_byn = _use_byn_for_delivery(dcode)
    lines: list[str] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or it.get("name") or "—").strip()
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
            lines.append(f"• {title} — {q} шт. × {p:g} BYN = {sub:g} BYN")
        else:
            ur = _unit_rub_from_item(it)
            sub_r = ur * q
            lines.append(f"• {title} — {q} шт. × {int(round(ur))} RUB = {int(round(sub_r))} RUB")
    if not lines:
        lines.append("—")
    return lines


def _order_total_display(order: dict[str, Any]) -> str:
    amount, cur = _order_checkout_display_total(order)
    if cur == "BYN":
        return f"{amount:g} BYN"
    return f"{int(round(amount)):,} RUB".replace(",", " ")


SITE_ORDER_INTRO = (
    "Вы перешли с сайта IlluCards в Telegram. Сейчас продолжим здесь."
)


def _order_short_ref(order_id: str) -> str:
    oid = str(order_id or "").strip()
    if not oid:
        return "—"
    if len(oid) <= 8:
        return oid
    return oid[-8:].upper()


def _build_order_draft_message(
    order: dict[str, Any], _order_id: str | None = None
) -> str:
    dcode = _delivery_price_code(order.get("delivery") or "BY")
    bonus_earn = _bonus_points_to_earn(order)
    lines = [
        "📦 Ваш заказ",
        "",
        *_order_item_lines(order),
        "",
        _format_delivery_line_order(dcode),
    ]
    try:
        spent = int(order.get("bonus_points_spent") or 0)
    except (TypeError, ValueError):
        spent = 0
    if spent > 0:
        lines.append(f"Списано бонусов: {spent:,}".replace(",", " "))
        disc = _format_bonus_discount_order(order)
        if disc:
            lines.append(f"Скидка бонусами: {disc}")
    lines.append(f"💰 Итого: {_order_total_display(order)}")
    lines.append("")
    lines.append(
        f"⭐ Ориентировочно начислится бонусов с заказа: ~{bonus_earn:,}".replace(",", " ")
    )
    return "\n".join(lines)


def _format_order_text(order: dict[str, Any], order_id: str | None = None) -> str:
    return _build_order_draft_message(order, order_id)


def _payment_selection_message(order: dict[str, Any], order_id: str) -> str:
    ref = _order_short_ref(order_id)
    return (
        "Выберите способ оплаты:\n\n"
        "💳 Карта -> 💵 Перевод -> ₿ Крипта\n"
        "💳 Оплата -> 📸 Скрин -> 🔎 Проверка -> ✅ Готово\n\n"
        f"💳 Оплата по заказу #{ref}"
    )


def _payment_method_label(method: str) -> str:
    m = (method or "").strip().lower()
    if m == "card":
        return "💳 Оплата картой"
    if m == "crypto":
        return "₿ Оплата криптой"
    if m == "phone":
        return "💵 Оплата переводом"
    return method or "—"


def _payment_method_instruction(method: str) -> str:
    m = (method or "").strip().lower()
    env_key = {
        "card": "ILLUCARDS_PAYMENT_CARD_TEXT",
        "crypto": "ILLUCARDS_PAYMENT_CRYPTO_TEXT",
        "phone": "ILLUCARDS_PAYMENT_PHONE_TEXT",
    }.get(m, "")
    custom = (os.getenv(env_key) or "").strip() if env_key else ""
    if custom:
        return custom
    if m == "card":
        return (
            "Оплата банковской картой. Реквизиты и инструкцию пришлёт менеджер "
            "после подтверждения заказа."
        )
    if m == "crypto":
        return (
            "Оплата криптовалютой. Адрес кошелька и сеть уточнит менеджер "
            "после подтверждения заказа."
        )
    if m == "phone":
        return (
            "Перевод по номеру телефона. Номер для оплаты пришлёт менеджер "
            "после подтверждения заказа."
        )
    return "Способ оплаты сохранён."


def _order_draft_keyboard(order_id: str) -> InlineKeyboardMarkup:
    oid = str(order_id or "").strip()
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "✅ Подтвердить заказ", callback_data=f"orderok:{oid}"
                ),
                InlineKeyboardButton("❌ Отменить", callback_data=f"ordercx:{oid}"),
            ],
        ]
    )


def _order_confirm_keyboard(
    order_id: str, telegram_user_id: int, site_status: str
) -> InlineKeyboardMarkup:
    del telegram_user_id, site_status
    return _order_draft_keyboard(order_id)


async def _send_order_intro_and_draft(
    message,
    order: dict[str, Any],
    order_id: str,
    telegram_user_id: int,
) -> bool:
    """Приветствие отдельно, карточка заказа с inline-кнопками — как в UI IlluCards."""
    oid = str(order_id or "").strip()
    if not oid:
        return False
    _cache_order_snapshot(oid, order, telegram_user_id)
    body = _build_order_draft_message(order, oid)
    kb = _order_draft_keyboard(oid)
    try:
        await message.reply_text(SITE_ORDER_INTRO, reply_markup=_main_keyboard())
        await message.reply_text(body, reply_markup=kb)
    except Exception as e:
        logger.exception("order draft send failed order=%s: %s", oid, e)
        try:
            combined = SITE_ORDER_INTRO + "\n\n" + body
            await message.reply_text(
                combined
                + "\n\n(Кнопки временно недоступны — отправьте /start order_"
                + oid
                + ")",
                reply_markup=_main_keyboard(),
            )
        except Exception as e2:
            logger.exception("order draft fallback send failed order=%s: %s", oid, e2)
            return False
    return True


def _payment_method_keyboard(order_id: str) -> InlineKeyboardMarkup:
    oid = str(order_id or "").strip()
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💳 Оплата картой", callback_data=f"orderpay:card:{oid}"
                ),
            ],
            [
                InlineKeyboardButton(
                    "💵 Оплата переводом", callback_data=f"orderpay:phone:{oid}"
                ),
            ],
            [
                InlineKeyboardButton(
                    "₿ Оплата криптой", callback_data=f"orderpay:crypto:{oid}"
                ),
            ],
            [
                InlineKeyboardButton(
                    "❌ Отменить оплату", callback_data=f"orderpaycancel:{oid}"
                ),
            ],
        ]
    )


PAYMENT_CANCELLED_TEXT = (
    "Оплата отменена. Можете снова подтвердить заказ или изменить корзину на сайте."
)


def _order_admin_confirm_keyboard(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "✅ Подтвердить заказ (админ)",
                    callback_data=f"orderadmok:{order_id}",
                )
            ]
        ]
    )


ORDER_DETAILS_REQUEST_TEXT = (
    "✅ Заказ подтверждён менеджером.\n\n"
    "Напишите ваши данные для доставки одним сообщением:\n"
    "• ФИО\n"
    "• адрес\n"
    "• телефон"
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


def _order_owner_user_id(
    order_id: str,
    order: dict[str, Any] | None = None,
    *,
    fallback_uid: int | None = None,
) -> int | None:
    raw = order.get("user_id") if isinstance(order, dict) else None
    if raw is None:
        existing = BOT_ORDERS.get(order_id)
        if isinstance(existing, dict):
            raw = existing.get("user_id")
    try:
        uid = int(raw)
    except (TypeError, ValueError):
        uid = 0
    if uid > 0:
        return uid
    if fallback_uid is not None:
        try:
            fb = int(fallback_uid)
        except (TypeError, ValueError):
            fb = 0
        if fb > 0:
            return fb
    return None


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

    if low0 in ("my_orders", "orders"):
        await show_my_orders(update, context)
        return

    if low0 == "support" or low0.startswith("support_"):
        support = (os.getenv("ILLUCARDS_SUPPORT_TEXT") or "").strip()
        if support:
            await update.message.reply_text(support)
        else:
            await update.message.reply_text(
                "Напишите нам через форму на сайте или в соцсетях — ссылки внизу главной страницы IlluCards."
            )
        return

    oid = _order_id_from_start_args(args)
    if not oid and user and getattr(user, "id", None) is not None:
        pending = _PENDING_ORDER_BY_USER.get(int(user.id))
        if pending:
            oid = str(pending).strip()
            logger.info("start: pending order %s user=%s", oid, user.id)
    if oid:
        if user and getattr(user, "id", None) is not None:
            _record_first_start_and_is_new(int(user.id))
        uid = int(user.id) if user and getattr(user, "id", None) is not None else 0
        order = await _load_order_for_callback(oid, uid) if uid > 0 else None
        if not order:
            order = await fetch_site_order(oid)
        if not order:
            _load_bot_orders()
            rec = BOT_ORDERS.get(oid)
            if isinstance(rec, dict):
                order = dict(rec)
        if not order:
            logger.warning(
                "start order_%s: not found user=%s", oid, getattr(user, "id", None)
            )
            await _reply_text_with_main_menu_and_site(
                update.message,
                "Заказ не найден или сервис недоступен. Попробуйте оформить заказ на сайте ещё раз.",
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
        _cache_order_snapshot(oid, order, int(user.id))
        st = str(order.get("status") or "new").strip().lower()
        already_notified = order.get("telegram_buyer_notified") is True

        if st in ("new", "confirmed") and already_notified:
            await update.message.reply_text(
                "Заказ уже в этом чате выше 👆\n"
                "Нажмите «✅ Подтвердить заказ» под сообщением с заказом.",
                reply_markup=_main_keyboard(),
            )
            return
        if st in ("new", "confirmed") and not already_notified:
            sent = await _send_order_intro_and_draft(
                update.message, order, oid, int(user.id)
            )
            if sent:
                await post_site_mark_buyer_notified(oid, order, user.id)
            else:
                await update.message.reply_text(
                    "Не удалось показать заказ. Попробуйте ещё раз: /start "
                    + f"order_{oid}",
                    reply_markup=_main_keyboard(),
                )
        elif st in ("cancelled", "canceled"):
            await update.message.reply_text(
                _format_order_text(order, oid) + "\n\n❌ Заказ отменён.",
            )
        elif st == "paid":
            await update.message.reply_text(
                _format_order_text(order, oid) + "\n\n💳 Чек оплаты отмечен. Спасибо!",
            )
        else:
            await update.message.reply_text(_format_order_text(order, oid))
        return

    if not user or getattr(user, "id", None) is None:
        await update.message.reply_text("Не удалось определить пользователя.")
        return

    is_new_here = _record_first_start_and_is_new(int(user.id))
    if is_new_here:
        welcome = _default_start_welcome_text(True)
        await update.message.reply_text(
            welcome,
            reply_markup=_site_open_markup(int(user.id)),
        )
        await update.message.reply_text(
            "Каталог, акции на главной и корзина — кнопками ниже.",
            reply_markup=_main_keyboard(),
        )
    else:
        await update.message.reply_text(
            "Меню — кнопками ниже.",
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
    cart, dcode, bonus_points, synced_from_site = await _cart_snapshot_for_user(
        context,
        int(user.id),
    )
    use_byn = _use_byn_for_delivery(dcode)
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
    bonus_line = ""
    if bonus_points > 0:
        bonus_line = f"\n\n💎 Бонусные баллы на сайте: {bonus_points:,}".replace(",", " ")
    elif synced_from_site or cart:
        bonus_line = (
            "\n\n💎 Бонусы начисляются после перевода заказа в «Отправлен» или «Доставлен» на сайте."
        )
    await update.message.reply_text(
        "🛒 Корзина\n\n" + "\n".join(lines) + f"\n\nИтого: {total_suffix}" + bonus_line,
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("Оформить заказ", callback_data="cartcheckout")]]
        ),
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


async def show_promo_slides(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    slides = await load_promo_slides()
    if getattr(load_promo_slides, "used_local_fallback", False):
        await update.message.reply_text("⚠️ Показаны локальные баннеры (сайт недоступен)")
    if not slides:
        await update.message.reply_text(
            "Пока нет баннеров «Акции на главной».\n"
            "Их настраивают в админке сайта (раздел «Акции на главной»)."
        )
        return
    context.user_data["promo_slides"] = slides
    context.user_data["promo_index"] = 0
    mid = await _show_promo_message(
        context, update.message.chat_id, message_id=None
    )
    context.user_data["promo_message_id"] = mid


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    t = update.message.text.strip()

    user = update.effective_user
    if user:
        order_id = _AWAIT_ORDER_DETAILS.pop(int(user.id), None)
        if order_id:
            admin_chat_id = _resolve_admin_chat_id()
            if admin_chat_id:
                uname = (user.username or "").strip()
                who = f"@{uname}" if uname else f"id {user.id}"
                try:
                    await context.bot.send_message(
                        chat_id=int(admin_chat_id),
                        text=(
                            f"📋 Данные доставки по заказу `{order_id}`\n"
                            f"От: {who} (tg {user.id})\n\n{t}"
                        ),
                    )
                except Exception as e:
                    logger.warning("forward order details: %s", e)
            await update.message.reply_text(
                "Спасибо! Данные переданы менеджеру. При необходимости мы уточним детали в этом чате."
            )
            return

    if t in ("🛒 Корзина", "💚 Корзина"):
        await show_cart_text(update, context)
        return
    if t in ("📦 Мои заказы", "📜 Мои заказы"):
        await show_my_orders(update, context)
        return
    if t == "❤️ Избранное":
        await show_favorites_text(update, context)
        return
    if t == "🔥 Акции":
        await show_promo_slides(update, context)
        return
    if t == "💬 Связь":
        support = (os.getenv("ILLUCARDS_SUPPORT_TEXT") or "").strip()
        if support:
            await update.message.reply_text(support)
        else:
            await update.message.reply_text(
                "Напишите нам через форму на сайте или в соцсетях — ссылки внизу главной страницы IlluCards."
            )
        return
    if t == "🚚 Доставка":
        await update.message.reply_text(
            "Условия и сроки доставки — на сайте при оформлении заказа.\n"
            "Нажмите «Открыть сайт» в сообщении с заказом или выберите страну доставки в корзине на сайте."
        )
        return
    if t == "⭐ Бонусы":
        if not user:
            await update.message.reply_text("Не удалось определить пользователя.")
            return
        st = await fetch_site_user_state(int(user.id))
        pts = 0
        if isinstance(st, dict):
            try:
                pts = int(st.get("bonus_points") or 0)
            except (TypeError, ValueError):
                pts = 0
        await update.message.reply_text(
            f"⭐ Ваши бонусные баллы: {pts:,}".replace(",", " ")
            + "\n\nБаллы можно тратить в корзине на сайте. "
            "Начисляются после подтверждения и отправки заказа."
        )
        return
    if t not in ("📦 Каталог", "📦 Категории"):
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
        "Каталог — выберите категорию:",
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


async def _show_promo_message(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    *,
    message_id: int | None,
) -> int:
    """Карусель баннеров с главной (те же данные, что «Акции на главной» в админке)."""
    slides: list[dict[str, Any]] = context.user_data.get("promo_slides") or []
    if not slides:
        raise ValueError("no promo slides")
    idx = int(context.user_data.get("promo_index") or 0) % len(slides)
    context.user_data["promo_index"] = idx
    origin = os.getenv("ILLUCARDS_SITE_ORIGIN", DEFAULT_SITE_ORIGIN).rstrip("/")
    s = slides[idx]
    photo = _absolute_asset_url(origin, str(s.get("imageUrl") or ""))
    cap = f"🔥 Акции на главной — {idx + 1}/{len(slides)}"
    kb = _promo_inline_kb(slides, idx, origin)

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
    data = (q.data or "").strip()
    user = q.from_user
    logger.info("callback_data=%s user=%s", data, getattr(user, "id", None))

    if data in ("confirm_order", "site_confirm", "order_confirm"):
        if not user:
            await q.answer("Ошибка", show_alert=True)
            return
        oid = _resolve_order_id_for_site_callback(int(user.id))
        if not oid:
            await q.answer("Нет активного заказа", show_alert=True)
            return
        data = f"orderok:{oid}"
    elif data.startswith("confirm_order:") or data.startswith("site_confirm:") or data.startswith("order_confirm:"):
        oid = data.split(":", 1)[1].strip()
        if not oid:
            await q.answer("Некорректный заказ", show_alert=True)
            return
        data = f"orderok:{oid}"
    elif data == "cancel_order":
        if not user:
            await q.answer("Ошибка", show_alert=True)
            return
        oid = _resolve_order_id_for_site_callback(int(user.id))
        if not oid:
            await q.answer("Нет активного заказа", show_alert=True)
            return
        data = f"ordercx:{oid}"
    elif data.startswith("cancel_order:"):
        oid = data.split(":", 1)[1].strip()
        if not oid:
            await q.answer("Некорректный заказ", show_alert=True)
            return
        data = f"ordercx:{oid}"

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

            order = await _load_order_for_callback(order_id, int(user.id))
            if not order:
                await q.answer()
                await q.message.reply_text(
                    "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
                )
                return
            owner_id = _order_owner_user_id(
                order_id, order, fallback_uid=int(user.id)
            )
            admin_chat_id = _resolve_admin_chat_id()
            if owner_id is None:
                await q.answer("Не найден владелец заказа", show_alert=True)
                return
            if int(user.id) != int(owner_id) and int(user.id) != int(admin_chat_id or 0):
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

            if site_st == "confirmed":
                await q.answer("Заказ уже подтверждён менеджером")
                try:
                    await q.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            pm_existing = str(order.get("payment_method") or "").strip().lower()
            if pm_existing in ("card", "crypto", "phone"):
                await q.answer("Способ оплаты уже выбран")
                await q.message.reply_text(
                    "Ожидайте подтверждения заказа менеджером. "
                    "После подтверждения мы попросим данные для доставки."
                )
                return

            _record_site_order_in_bot(order_id, order, owner_id)

            await q.answer("Выберите способ оплаты")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text(
                _payment_selection_message(order, order_id),
                reply_markup=_payment_method_keyboard(order_id),
            )
            return
        except Exception as e:
            logger.exception("order confirm failed: %s", e)
            await q.answer()
            await q.message.reply_text(
                "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
            )
            return

    if data.startswith("orderpaycancel:") or data.startswith("orderback:"):
        try:
            order_id = data.split(":", 1)[1].strip()
            if not order_id or not user:
                await q.answer("Некорректный заказ", show_alert=True)
                return
            order = await _load_order_for_callback(order_id, int(user.id))
            if not order:
                await q.answer()
                await q.message.reply_text(
                    "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
                )
                return
            owner_id = _order_owner_user_id(
                order_id, order, fallback_uid=int(user.id)
            )
            if owner_id is None or int(user.id) != int(owner_id):
                await q.answer("Это не ваш заказ", show_alert=True)
                return
            await q.answer()
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text(PAYMENT_CANCELLED_TEXT)
            await q.message.reply_text(
                _build_order_draft_message(order, order_id),
                reply_markup=_order_draft_keyboard(order_id),
            )
            return
        except Exception as e:
            logger.exception("order payment cancel failed: %s", e)
            await q.answer("Не удалось вернуться к заказу", show_alert=True)
            return

    if data.startswith("orderpay:"):
        try:
            parts = data.split(":", 2)
            if len(parts) < 3:
                await q.answer("Некорректный запрос", show_alert=True)
                return
            method = parts[1].strip().lower()
            order_id = parts[2].strip()
            if method not in ("card", "crypto", "phone") or not order_id:
                await q.answer("Некорректный способ оплаты", show_alert=True)
                return
            user = q.from_user
            if not user:
                await q.answer("Ошибка", show_alert=True)
                return

            order = await _load_order_for_callback(order_id, int(user.id))
            if not order:
                await q.answer()
                await q.message.reply_text(
                    "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
                )
                return
            owner_id = _order_owner_user_id(
                order_id, order, fallback_uid=int(user.id)
            )
            if owner_id is None:
                await q.answer("Не найден владелец заказа", show_alert=True)
                return
            if int(user.id) != int(owner_id):
                await q.answer("Это не ваш заказ", show_alert=True)
                return

            site_st = str(order.get("status") or "").strip().lower()
            if site_st in ("cancelled", "canceled"):
                await q.answer("Заказ отменён", show_alert=True)
                return
            if site_st == "confirmed":
                await q.answer("Заказ уже подтверждён")
                return

            order["payment_method"] = method
            rec = _record_site_order_in_bot(order_id, order, owner_id)
            rec["payment_method"] = method
            BOT_ORDERS[order_id] = rec
            _persist_bot_orders()

            if not await post_site_order_payment_method(
                order_id, method, order, owner_id
            ):
                await q.answer("Не удалось сохранить на сайте", show_alert=True)
                return

            admin_chat_id = _resolve_admin_chat_id()
            if admin_chat_id:
                uname = str(order.get("username") or "").strip().lstrip("@") or None
                admin_text = _format_order_admin(
                    order_id,
                    order,
                    owner_id,
                    uname,
                    rec,
                    header="🆕 Заказ: выбран способ оплаты",
                )
                try:
                    admin_msg = await context.bot.send_message(
                        chat_id=int(admin_chat_id),
                        text=admin_text,
                        reply_markup=_order_admin_confirm_keyboard(order_id),
                    )
                    mid = getattr(admin_msg, "message_id", None)
                    if isinstance(mid, int) and mid > 0:
                        await post_site_admin_message_id(order_id, mid)
                except Exception as e:
                    logger.warning("admin notify payment: %s", e)

            await q.answer("Сохранено")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text(
                f"Вы выбрали: {_payment_method_label(method)}\n\n"
                f"{_payment_method_instruction(method)}\n\n"
                f"💳 Оплата по заказу #{_order_short_ref(order_id)}\n\n"
                "Оплатите и пришлите скриншот чека одним сообщением в этот чат.\n"
                "После проверки менеджер подтвердит заказ."
            )
            return
        except Exception as e:
            logger.exception("order payment method failed: %s", e)
            await q.answer("Не удалось сохранить. Повторите позже.", show_alert=True)
            return

    if data.startswith("orderadmok:"):
        try:
            order_id = data.split(":", 1)[1].strip()
            if not order_id:
                await q.answer("Некорректный заказ", show_alert=True)
                return
            user = q.from_user
            if not user:
                await q.answer("Ошибка", show_alert=True)
                return
            admin_chat_id = _resolve_admin_chat_id()
            if not admin_chat_id or int(user.id) != int(admin_chat_id):
                await q.answer("Только для администратора", show_alert=True)
                return

            order = await fetch_site_order(order_id)
            if not order:
                await q.answer("Заказ не найден", show_alert=True)
                return
            owner_id = _order_owner_user_id(order_id, order)
            if owner_id is None:
                await q.answer("Не найден владелец заказа", show_alert=True)
                return

            pm = str(order.get("payment_method") or "").strip().lower()
            if pm not in ("card", "crypto", "phone"):
                await q.answer("Покупатель ещё не выбрал способ оплаты", show_alert=True)
                return

            site_st = str(order.get("status") or "").strip().lower()
            if site_st == "confirmed":
                await q.answer("Уже подтверждён")
                try:
                    await q.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass
                return

            rec = _record_site_order_in_bot(order_id, order, owner_id)
            rec["status"] = "confirmed"
            BOT_ORDERS[order_id] = rec
            _persist_bot_orders()

            if not await post_site_order_status(order_id, "confirmed", order, owner_id):
                await q.answer("Не удалось обновить на сайте", show_alert=True)
                return

            _delete_bot_order(order_id)

            try:
                await context.bot.send_message(
                    chat_id=int(owner_id),
                    text=ORDER_DETAILS_REQUEST_TEXT,
                )
                _AWAIT_ORDER_DETAILS[int(owner_id)] = order_id
            except Exception as e:
                logger.warning("customer details prompt: %s", e)

            await q.answer("Заказ подтверждён")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text(f"Заказ `{order_id}` подтверждён. Покупателю отправлен запрос данных.")
            return
        except Exception as e:
            logger.exception("order admin confirm failed: %s", e)
            await q.answer("Ошибка подтверждения", show_alert=True)
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

            order = await _load_order_for_callback(order_id, int(user.id))
            if not order:
                await q.answer()
                await q.message.reply_text(
                    "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
                )
                return
            owner_id = _order_owner_user_id(
                order_id, order, fallback_uid=int(user.id)
            )
            admin_chat_id = _resolve_admin_chat_id()
            if owner_id is None:
                await q.answer("Не найден владелец заказа", show_alert=True)
                return
            if int(user.id) != int(owner_id) and int(user.id) != int(admin_chat_id or 0):
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

            if site_st == "paid":
                await q.answer(
                    "После отметки чека отмена только через поддержку.",
                    show_alert=True,
                )
                return

            if site_st not in ("new", "confirmed", ""):
                await q.answer(
                    "На этом этапе отмена только через поддержку.",
                    show_alert=True,
                )
                return

            if site_st == "new":
                site_ok = await post_site_order_bot_delete(order_id, owner_id)
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
                rec = _record_site_order_in_bot(order_id, order, owner_id)
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
            await q.answer()
            await q.message.reply_text(
                "Не удалось обработать кнопку. Откройте заказ снова с сайта или отправьте /start."
            )
            return

    if data == "cartcheckout":
        try:
            user = q.from_user
            if not user:
                await q.answer("Ошибка", show_alert=True)
                return
            cart, dcode, _bonus_points, _synced = await _cart_snapshot_for_user(
                context,
                int(user.id),
            )
            items = _site_order_items_from_cart(cart)
            if not items:
                await q.answer("Корзина пуста", show_alert=True)
                return
            result = await post_site_order_from_bot(
                int(user.id),
                (user.username or "").strip() or None,
                cart,
                dcode,
            )
            if not isinstance(result, dict):
                await q.answer("Не удалось оформить заказ на сайте.", show_alert=True)
                return
            order_id = str(result.get("order_id") or "").strip()
            if not order_id:
                await q.answer("Сайт не вернул номер заказа.", show_alert=True)
                return

            goods_byn = sum(float(it["priceByn"]) * int(it["quantity"]) for it in items)
            total_byn = round(goods_byn + _delivery_charge_byn(dcode), 2)
            order = {
                "user_id": int(user.id),
                "username": (user.username or "").strip() or None,
                "items": items,
                "total": total_byn,
                "delivery": _delivery_price_code(dcode),
                "status": "confirmed",
            }
            rec = _record_site_order_in_bot(order_id, order, int(user.id))
            rec["status"] = "confirmed"
            BOT_ORDERS[order_id] = rec
            _persist_bot_orders()
            context.user_data["cart"] = []

            admin_chat_id = _resolve_admin_chat_id()
            if admin_chat_id:
                admin_msg = None
                try:
                    admin_msg = await context.bot.send_message(
                        chat_id=admin_chat_id,
                        text=_format_order_admin(
                            order_id,
                            order,
                            int(user.id),
                            (user.username or "").strip() or None,
                            rec,
                        ),
                    )
                except Exception as e:
                    logger.warning("admin notify bot checkout: %s", e)
                mid = getattr(admin_msg, "message_id", None) if admin_msg else None
                if isinstance(mid, int) and mid > 0:
                    await post_site_admin_message_id(order_id, mid)

            _delete_bot_order(order_id)
            earned = int(result.get("bonus_earned") or 0)
            balance = int(result.get("bonus_points") or 0)
            bonus_note = ""
            if earned > 0:
                bonus_note = (
                    f"\n\n💎 Начислено: {earned:,} баллов. Баланс: {balance:,}."
                ).replace(",", " ")
            await q.answer("Заказ оформлен")
            try:
                await q.edit_message_reply_markup(reply_markup=None)
            except Exception:
                pass
            await q.message.reply_text(
                "✅ Заказ оформлен и появился в личном кабинете.\n\n"
                + _format_order_text(order)
                + bonus_note,
                reply_markup=_order_saved_keyboard(int(user.id)),
            )
            return
        except Exception as e:
            logger.exception("cart checkout failed: %s", e)
            await q.answer("Не удалось оформить заказ. Повторите позже.", show_alert=True)
            return

    if data.startswith("promo:"):
        action = data.split(":", 1)[1]
        chat_id_pb = q.message.chat_id
        slides_pb: list[dict[str, Any]] = context.user_data.get("promo_slides") or []
        if not slides_pb:
            await q.answer("Сначала откройте «🔥 Акции»", show_alert=True)
            return
        if action == "back":
            await q.answer()
            mid = context.user_data.get("promo_message_id")
            try:
                if mid is not None:
                    await context.bot.delete_message(
                        chat_id=chat_id_pb, message_id=int(mid)
                    )
            except Exception:
                pass
            context.user_data["promo_message_id"] = None
            await context.bot.send_message(
                chat_id=chat_id_pb,
                text="Выберите раздел кнопками ниже.",
                reply_markup=_main_keyboard(),
            )
            return
        if action == "prev":
            i = int(context.user_data.get("promo_index") or 0)
            context.user_data["promo_index"] = (i - 1) % len(slides_pb)
        elif action == "next":
            i = int(context.user_data.get("promo_index") or 0)
            context.user_data["promo_index"] = (i + 1) % len(slides_pb)
        else:
            await q.answer()
            return
        await q.answer()
        mid_old = context.user_data.get("promo_message_id")
        mid = await _show_promo_message(
            context,
            chat_id_pb,
            message_id=mid_old if isinstance(mid_old, int) else None,
        )
        context.user_data["promo_message_id"] = mid
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
        await q.answer()
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
            text="Каталог — выберите категорию:",
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


def _main() -> None:
    import sys

    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        logger.error(
            "FATAL: TELEGRAM_BOT_TOKEN is not set. "
            "Render → illucards → Environment → Add TELEGRAM_BOT_TOKEN, Save, redeploy."
        )
        sys.exit(1)
    if ":" not in token or len(token) < 30:
        logger.error(
            "FATAL: TELEGRAM_BOT_TOKEN looks invalid (expected 123456789:ABC... from @BotFather)."
        )
        sys.exit(1)

    logger.info("Python %s", sys.version.split()[0])
    _load_bot_orders()

    app = ApplicationBuilder().token(token).post_init(_start_http_server).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_error_handler(_telegram_error_handler)

    logger.info("Starting Telegram polling + HTTP on PORT=%s", os.getenv("PORT", "(none)"))

    # Python 3.14+: asyncio.get_event_loop() no longer creates a loop in MainThread (PTB run_polling).
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    try:
        app.run_polling(
            drop_pending_updates=True,
            allowed_updates=Update.ALL_TYPES,
        )
    except InvalidToken:
        logger.error(
            "FATAL: Telegram rejected TELEGRAM_BOT_TOKEN. "
            "BotFather → /mybots → @illucards_bot → Revoke token → paste new token in Render Environment."
        )
        sys.exit(1)
    except Exception as exc:
        logger.exception("FATAL: bot crashed on startup: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    _main()
