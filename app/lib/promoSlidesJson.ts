export type PromoSlide = {
  id: string;
  imageUrl: string;
  /** Ссылка при клике: `/card/…`, `#collection`, `https://…` */
  href: string;
  /** Если false — не показываем в карусели на главной. */
  active: boolean;
};

export type PromoCustomOrder = {
  imageUrl: string;
  /** URL кнопки «Примеры» на левой плашке. */
  href: string;
};

export type PromoHomeConfig = {
  customOrder: PromoCustomOrder;
  items: PromoSlide[];
};

export type PromoSlidesFile = PromoHomeConfig;

const MAX_PROMO_ITEMS = 40;

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function asTrimmed(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function readActive(row: object): boolean {
  if (!("active" in row)) return true;
  const v = (row as { active?: unknown }).active;
  if (v === false || v === "false" || v === 0) return false;
  return true;
}

function readSlideRow(row: unknown, allowEmptyImage: boolean): PromoSlide | null {
  if (!row || typeof row !== "object") return null;
  const id = isNonEmptyString((row as { id?: unknown }).id)
    ? (row as { id: string }).id.trim()
    : "";
  const imageUrl = asTrimmed((row as { imageUrl?: unknown }).imageUrl);
  const href = asTrimmed((row as { href?: unknown }).href);
  if (!id) return null;
  if (!allowEmptyImage && !imageUrl) return null;
  return { id, imageUrl, href, active: readActive(row) };
}

function readCustomOrder(raw: unknown): PromoCustomOrder {
  if (!raw || typeof raw !== "object") {
    return { imageUrl: "", href: "" };
  }
  return {
    imageUrl: asTrimmed((raw as { imageUrl?: unknown }).imageUrl),
    href: asTrimmed((raw as { href?: unknown }).href),
  };
}

function uniqueId(base: string, seen: Set<string>): string {
  let id = base.trim() || "promo";
  while (seen.has(id)) id = `${id}-x`;
  seen.add(id);
  return id;
}

function itemsFromUnknown(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items?: unknown }).items)
  ) {
    return (raw as { items: unknown[] }).items;
  }
  return [];
}

/**
 * Старый формат был плоским `{ items }` из двух слотов на главной.
 * Первая позиция с картинкой → «Карточка на заказ», остальные → карусель акций.
 */
function migrateLegacyItems(rows: unknown[]): PromoHomeConfig {
  const parsed: PromoSlide[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const slide = readSlideRow(row, true);
    if (!slide) continue;
    slide.id = uniqueId(slide.id, seen);
    parsed.push(slide);
  }
  const firstWithArt = parsed.findIndex((s) => s.imageUrl.length > 0);
  if (firstWithArt < 0) {
    return {
      customOrder: { imageUrl: "", href: "" },
      items: parsed,
    };
  }
  const head = parsed[firstWithArt];
  const rest = parsed.filter((_, i) => i !== firstWithArt);
  return {
    customOrder: { imageUrl: head.imageUrl, href: head.href },
    items: rest,
  };
}

export function parsePromoHomeConfig(data: unknown): PromoHomeConfig {
  if (!data || typeof data !== "object") {
    return { customOrder: { imageUrl: "", href: "" }, items: [] };
  }
  const obj = data as { customOrder?: unknown; items?: unknown };
  const hasCustomKey = Object.prototype.hasOwnProperty.call(obj, "customOrder");
  if (hasCustomKey) {
    const seen = new Set<string>();
    const items: PromoSlide[] = [];
    for (const row of itemsFromUnknown(obj)) {
      const slide = readSlideRow(row, true);
      if (!slide) continue;
      slide.id = uniqueId(slide.id, seen);
      items.push(slide);
      if (items.length >= MAX_PROMO_ITEMS) break;
    }
    return {
      customOrder: readCustomOrder(obj.customOrder),
      items,
    };
  }
  return migrateLegacyItems(itemsFromUnknown(obj));
}

/** Все слоты (включая пустые) — для обратной совместимости. */
export function parsePromoSlots(data: unknown): PromoSlide[] {
  return parsePromoHomeConfig(data).items;
}

/** Только акции с картинкой. */
export function parsePromoSlides(data: unknown): PromoSlide[] {
  return parsePromoHomeConfig(data).items.filter(
    (s) => s.imageUrl.length > 0 && s.active,
  );
}

export function customOrderForHero(
  customOrder: PromoCustomOrder | undefined | null,
): PromoCustomOrder | null {
  const imageUrl = customOrder?.imageUrl?.trim() ?? "";
  if (!imageUrl) return null;
  return {
    imageUrl,
    href: customOrder?.href?.trim() ?? "",
  };
}

export function promoCarouselForHero(items: PromoSlide[]): PromoSlide[] {
  return items.filter((s) => s.active && s.imageUrl.trim().length > 0);
}

export function normalizePromoHomeForSave(data: unknown): PromoHomeConfig {
  const parsed = parsePromoHomeConfig(data);
  const seen = new Set<string>();
  const items: PromoSlide[] = [];
  for (const it of parsed.items) {
    const imageUrl = it.imageUrl?.trim() ?? "";
    let id = it.id?.trim() ?? "";
    if (!id) id = `promo-${items.length}`;
    id = uniqueId(id, seen);
    items.push({
      id,
      imageUrl,
      href: it.href?.trim() ?? "",
      active: it.active !== false,
    });
    if (items.length >= MAX_PROMO_ITEMS) break;
  }
  return {
    customOrder: {
      imageUrl: parsed.customOrder.imageUrl.trim(),
      href: parsed.customOrder.href.trim(),
    },
    items,
  };
}

export function emptyPromoSlide(): PromoSlide {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `promo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, imageUrl: "", href: "", active: true };
}
