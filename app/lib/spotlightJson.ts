/**
 * Слайды витрины на главной (переключение точками и стрелками вверху).
 */

export type SpotlightSlideRow =
  | {
      kind: "novelties";
      id: string;
      title: string;
      description: string;
      /** Картинка над текстом (опционально) */
      imageUrl?: string;
    }
  | {
      kind: "promo";
      id: string;
      title: string;
      description: string;
      detailHref: string;
      detailLabel: string;
      imageUrl?: string;
    };

export type SpotlightConfig = {
  slides: SpotlightSlideRow[];
};

export const DEFAULT_SPOTLIGHT_SLIDES: SpotlightSlideRow[] = [
  {
    kind: "novelties",
    id: "novelties",
    title: "Новинки",
    description:
      "Крупная карточка в витрине — текущая новинка. Листайте стрелками по бокам; другие разделы — точками и стрелками вверху.",
  },
  {
    kind: "promo",
    id: "offers",
    title: "Спецпредложения",
    description:
      "Подборки со скидками и акции — загляните в каталог и оформите заказ выгодно.",
    detailHref: "#collection",
    detailLabel: "В коллекцию",
  },
  {
    kind: "promo",
    id: "sale",
    title: "Акция",
    description:
      "Карточки со сниженной ценой. Количество ограничено — успейте забрать любимые позиции.",
    detailHref: "#collection",
    detailLabel: "Смотреть карточки",
  },
  {
    kind: "promo",
    id: "auction",
    title: "Аукцион",
    description:
      "Редкие лоты и торги за коллекционные карточки. Следите за обновлениями и участвуйте в аукционах.",
    detailHref: "#collection",
    detailLabel: "Подробнее",
  },
];

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseSlide(row: unknown): SpotlightSlideRow | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const kind = trimStr(o.kind);
  const id = trimStr(o.id) || `slide-${Math.random().toString(36).slice(2, 9)}`;
  const title = trimStr(o.title) || "Без названия";
  const description = trimStr(o.description) || "";
  const imageUrl = trimStr(o.imageUrl);

  if (kind === "novelties") {
    return {
      kind: "novelties",
      id: id || "novelties",
      title,
      description,
      ...(imageUrl ? { imageUrl } : {}),
    };
  }
  if (kind === "promo") {
    return {
      kind: "promo",
      id,
      title,
      description,
      detailHref: trimStr(o.detailHref) || "#collection",
      detailLabel: trimStr(o.detailLabel) || "Подробнее",
      ...(imageUrl ? { imageUrl } : {}),
    };
  }
  return null;
}

export function parseSpotlightConfig(raw: unknown): SpotlightConfig {
  if (!raw || typeof raw !== "object") {
    return { slides: [...DEFAULT_SPOTLIGHT_SLIDES] };
  }
  const root = raw as Record<string, unknown>;
  const slidesRaw = root.slides;
  if (!Array.isArray(slidesRaw) || slidesRaw.length === 0) {
    return { slides: [...DEFAULT_SPOTLIGHT_SLIDES] };
  }
  const slides: SpotlightSlideRow[] = [];
  for (const row of slidesRaw) {
    const s = parseSlide(row);
    if (s) slides.push(s);
  }
  if (slides.length === 0) {
    return { slides: [...DEFAULT_SPOTLIGHT_SLIDES] };
  }
  return { slides };
}

export function normalizeSpotlightConfig(config: SpotlightConfig): SpotlightConfig {
  const seen = new Set<string>();
  const slides = config.slides.map((s, i) => {
    let id = s.id.trim() || `slide-${i}`;
    while (seen.has(id)) {
      id = `${id}-${i}`;
    }
    seen.add(id);
    if (s.kind === "novelties") {
      return {
        kind: "novelties" as const,
        id,
        title: s.title.trim() || "Новинки",
        description: s.description.trim(),
        ...(s.imageUrl?.trim() ? { imageUrl: s.imageUrl.trim() } : {}),
      };
    }
    return {
      kind: "promo" as const,
      id,
      title: s.title.trim() || "Подборка",
      description: s.description.trim(),
      detailHref: s.detailHref.trim() || "#collection",
      detailLabel: s.detailLabel.trim() || "Подробнее",
      ...(s.imageUrl?.trim() ? { imageUrl: s.imageUrl.trim() } : {}),
    };
  });
  return { slides };
}
