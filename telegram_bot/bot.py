#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import asyncio
import json
import logging
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

PRODUCTS_API = "https://www.illucards.by/api/products"
CARDS_PATH = Path(__file__).resolve().parent / "cards.json"
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
    img = (raw.get("image") or raw.get("frontImage") or "").strip()
    return {
        "id": str(pid),
        "name": str(name or "—"),
        "category": str(cat).strip(),
        "price": price_f,
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
        [["📦 Категории", "🛒 Корзина"]],
        resize_keyboard=True,
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


def _caption(p: dict[str, Any]) -> str:
    return f"{p.get('name', '—')}\n{p.get('price', '—')}"


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    context.user_data.setdefault("cart", [])
    await update.message.reply_text(
        "IlluCards",
        reply_markup=_main_keyboard(),
    )


async def show_cart_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    cart: list[dict[str, Any]] = context.user_data.get("cart") or []
    if not cart:
        await update.message.reply_text("Корзина пуста.")
        return
    total = 0.0
    lines = []
    for it in cart:
        name = str(it.get("name", "—"))
        price = float(it.get("price") or 0)
        qty = int(it.get("qty", 1))
        sub = price * qty
        total += sub
        lines.append(f"• {name} ×{qty} — {sub:g}")
    await update.message.reply_text(
        "🛒 Корзина\n\n" + "\n".join(lines) + f"\n\nИтого: {total:g}"
    )


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    t = update.message.text.strip()
    if t == "🛒 Корзина":
        await show_cart_text(update, context)
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


async def _show_product_message(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    *,
    message_id: int | None,
) -> int:
    items: list[dict[str, Any]] = context.user_data.get("items") or []
    if not items:
        raise ValueError("no items")
    idx = int(context.user_data.get("index") or 0) % len(items)
    context.user_data["index"] = idx
    p = items[idx]
    photo = (p.get("image") or "").strip()
    cap = _caption(p)
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
    await q.answer()
    chat_id = q.message.chat_id
    data = q.data

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
        mid = await _show_product_message(context, chat_id, message_id=None)
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
    mid = await _show_product_message(context, chat_id, message_id=mid_old)
    context.user_data["product_message_id"] = mid


if __name__ == "__main__":
    import os

    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise Exception("Нет TELEGRAM_BOT_TOKEN")

    app = ApplicationBuilder().token(token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("🚀 Bot started")

    app.run_polling()
