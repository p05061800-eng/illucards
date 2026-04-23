"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categories } from "@/data/categories";
import { DraggableImageFrame } from "./components/DraggableImageFrame";
import type { StoredCard } from "../api/cards/route";
import { maxCategoryOrderInCategory } from "../lib/adminCategoryOrder";
import { resolveCardArtBoxAspectCss } from "../lib/cardAspectRatio";
import {
  categoryFocusContainStyle,
  DEFAULT_IMAGE_FOCUS,
} from "../lib/imageFocus";
import { useIntrinsicImageAspect } from "../lib/useIntrinsicImageAspect";
import { apiUrl } from "../lib/apiUrl";
import { isFrontHoverVideoUrl } from "../lib/frontHoverMotionUrl";

type AdminCardFormProps = {
  /** Каталог — для порядка в категории при добавлении карточки. */
  allCards?: StoredCard[];
  editingCard?: StoredCard | null;
  onCancelEdit?: () => void;
  onSuccess?: () => void;
};

async function uploadImageFile(
  file: File,
  opts?: { cardCategory?: string },
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.cardCategory === "TMNT") {
    fd.append("cardCategory", "TMNT");
  }
  const res = await fetch(apiUrl("/api/upload"), { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка загрузки"
    );
  }
  return data.url;
}

async function uploadVideoFile(
  file: File,
  opts?: { cardCategory?: string },
): Promise<{ url: string; transcoded?: boolean }> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.cardCategory === "TMNT") {
    fd.append("cardCategory", "TMNT");
  }
  const res = await fetch(apiUrl("/api/upload-video"), {
    method: "POST",
    body: fd,
  });
  const data = (await res.json()) as {
    url?: string;
    transcoded?: boolean;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Ошибка загрузки видео"
    );
  }
  return { url: data.url, transcoded: data.transcoded };
}

export function AdminCardForm({
  allCards = [],
  editingCard = null,
  onCancelEdit,
  onSuccess,
}: AdminCardFormProps) {
  const isEdit = Boolean(editingCard);
  const [categoryOrderInput, setCategoryOrderInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(
    categories[0]?.name ?? "Marvel"
  );
  const [categoryBgUrl, setCategoryBgUrl] = useState<string | null>(null);
  const [effect, setEffect] = useState<
    "vario" | "morphing" | "3d-horizontal"
  >("3d-horizontal");
  /** Плавный кроссфейд трёх слоёв (ultra + оборот + лицо) на витрине — только с фоном категории. */
  const [varioSmoothBlend, setVarioSmoothBlend] = useState(false);
  /** Инерция следования за курсором (0.05–0.6). */
  const [varioSmoothing, setVarioSmoothing] = useState("0.18");
  const [price, setPrice] = useState("");
  /** Рубли РФ для витрины (если пусто — на сайте считается × курс). */
  const [priceRub, setPriceRub] = useState("");
  const [rarity, setRarity] = useState("limited");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  /** Короткое MP4 при наведении в 3D (тот же кадр, что лицевая картинка). */
  const [hoverMotionUrl, setHoverMotionUrl] = useState<string | null>(null);
  /** Vario: необязательная средняя картинка между лицом и оборотом. */
  const [middleImageUrl, setMiddleImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const hoverMotionRef = useRef<HTMLInputElement>(null);
  const middleRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const categoryBgRef = useRef<HTMLInputElement>(null);
  const [inStock, setInStock] = useState(true);
  const [frontFocus, setFrontFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [middleFocus, setMiddleFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [backFocus, setBackFocus] = useState(DEFAULT_IMAGE_FOCUS);
  const [categoryBgFocus, setCategoryBgFocus] = useState(DEFAULT_IMAGE_FOCUS);
  useEffect(() => {
    if (!editingCard) {
      setFrontImageUrl(null);
      setHoverMotionUrl(null);
      setMiddleImageUrl(null);
      setBackImageUrl(null);
      setCategoryBgUrl(null);
      setFrontFocus(DEFAULT_IMAGE_FOCUS);
      setMiddleFocus(DEFAULT_IMAGE_FOCUS);
      setBackFocus(DEFAULT_IMAGE_FOCUS);
      setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
      return;
    }
    setTitle(editingCard.title ?? "");
    setDescription(editingCard.description ?? "");
    const cat = editingCard.category?.trim() ?? "";
    const catOk = categories.some((c) => c.name === cat);
    setCategory(catOk && cat ? cat : categories[0].name);
    const rawEff = editingCard.effect?.trim().toLowerCase() ?? "";
    const eff: "vario" | "morphing" | "3d-horizontal" =
      rawEff === "vario"
        ? "vario"
        : rawEff === "morphing"
          ? "morphing"
          : "3d-horizontal";
    setEffect(eff);
    setPrice(
      editingCard.price !== undefined && editingCard.price !== null
        ? String(editingCard.price)
        : ""
    );
    setPriceRub(
      editingCard.priceRub != null && Number.isFinite(editingCard.priceRub)
        ? String(editingCard.priceRub)
        : ""
    );
    setRarity(editingCard.rarity ?? "limited");
    setFrontImageUrl(editingCard.frontImage?.trim() || null);
    setHoverMotionUrl(editingCard.frontHoverGif?.trim() || null);
    setMiddleImageUrl(
      eff === "vario" ? editingCard.middleImage?.trim() || null : null
    );
    setBackImageUrl(
      eff === "vario" || eff === "morphing"
        ? editingCard.backImage?.trim() || null
        : null
    );
    setCategoryBgUrl(editingCard.categoryBg?.trim() || null);
    setInStock(editingCard.inStock !== false);
    setFrontFocus(editingCard.frontImageFocus ?? DEFAULT_IMAGE_FOCUS);
    setMiddleFocus(editingCard.middleImageFocus ?? DEFAULT_IMAGE_FOCUS);
    setBackFocus(editingCard.backImageFocus ?? DEFAULT_IMAGE_FOCUS);
    setCategoryBgFocus(editingCard.categoryBgFocus ?? DEFAULT_IMAGE_FOCUS);
    setCategoryOrderInput(
      editingCard.categoryOrder != null
        ? String(editingCard.categoryOrder)
        : ""
    );
    setVarioSmoothBlend(Boolean(editingCard.varioSmoothBlend));
    setVarioSmoothing(
      editingCard.varioSmoothing != null &&
        Number.isFinite(editingCard.varioSmoothing)
        ? String(editingCard.varioSmoothing)
        : "0.18"
    );
    setStatus("idle");
    setMessage("");
  }, [editingCard]);

  useEffect(() => {
    if (editingCard) return;
    setCategoryOrderInput(
      String(maxCategoryOrderInCategory(allCards, category) + 1)
    );
  }, [editingCard, category, allCards]);

  const { aspectRatioCss: frontFileAspect } = useIntrinsicImageAspect(
    frontImageUrl?.trim() || undefined,
  );
  /** Пропорции превью = пиксели лица в данных или интринсик загруженного файла. */
  const resolvedCardArtAspectCss = useMemo(
    () =>
      resolveCardArtBoxAspectCss(
        {
          category: editingCard?.category ?? category,
          frontImageWidth: editingCard?.frontImageWidth,
          frontImageHeight: editingCard?.frontImageHeight,
        },
        frontFileAspect,
        null,
      ),
    [
      editingCard?.id,
      editingCard?.category,
      category,
      editingCard?.frontImageWidth,
      editingCard?.frontImageHeight,
      frontFileAspect,
    ],
  );

  /** Превью: `contain` + фокус; `aspect-ratio` как на витрине (для TMNT — постер 761×1024). */
  const adminPreviewObjectFit = "contain" as const;

  async function onHoverMotionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name.trim().toLowerCase();
    const okType =
      file.type === "video/mp4" ||
      file.type === "video/quicktime" ||
      name.endsWith(".mp4") ||
      name.endsWith(".m4v");
    if (!okType) {
      setStatus("error");
      setMessage("Нужен файл MP4 (короткий ролик того же кадра, что лицевая сторона).");
      return;
    }
    setStatus("loading");
    setMessage("Загрузка MP4…");
    try {
      const { url, transcoded } = await uploadVideoFile(file, {
        cardCategory: category === "TMNT" ? "TMNT" : undefined,
      });
      setHoverMotionUrl(url);
      setStatus("idle");
      if (category === "TMNT") {
        setMessage(
          transcoded
            ? "Ролик перекодирован в кадр 761×1024 (как фон)."
            : "Ролик сохранён без перекодирования. Для кадра 761×1024 установите ffmpeg в системе (например: brew install ffmpeg).",
        );
      } else {
        setMessage("");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onFrontChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка лицевой стороны…");
    try {
      const url = await uploadImageFile(file, {
        cardCategory: category === "TMNT" ? "TMNT" : undefined,
      });
      setFrontImageUrl(url);
      setFrontFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onMiddleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка средней стороны…");
    try {
      const url = await uploadImageFile(file, {
        cardCategory: category === "TMNT" ? "TMNT" : undefined,
      });
      setMiddleImageUrl(url);
      setMiddleFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onBackChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("loading");
    setMessage("Загрузка оборота…");
    try {
      const url = await uploadImageFile(file, {
        cardCategory: category === "TMNT" ? "TMNT" : undefined,
      });
      setBackImageUrl(url);
      setBackFocus(DEFAULT_IMAGE_FOCUS);
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onCategoryBgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImageFile(file, {
        cardCategory: category === "TMNT" ? "TMNT" : undefined,
      });
      setCategoryBgUrl(url);
      setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!frontImageUrl?.trim()) {
      setStatus("error");
      setMessage("Загрузите лицевую сторону (файл).");
      return;
    }
    if (
      (effect === "vario" || effect === "morphing") &&
      !backImageUrl?.trim()
    ) {
      setStatus("error");
      setMessage(
        effect === "morphing"
          ? "Для Morphing загрузите второе изображение (крупный герой)."
          : "Для Vario загрузите оборотную сторону (второе изображение)."
      );
      return;
    }

    setStatus("loading");
    setMessage("");

    const fd = new FormData();
    if (isEdit && editingCard) {
      fd.set("cardId", editingCard.id);
    }
    fd.set("title", title);
    fd.set("description", description);
    fd.set("category", category);
    fd.set("effect", effect);
    fd.set("price", price.trim() === "" ? "0" : price.trim());
    fd.set("priceRub", priceRub.trim());
    fd.set("rarity", rarity);

    fd.set("frontImageUrl", frontImageUrl);
    fd.set(
      "middleImageUrl",
      effect === "vario" ? (middleImageUrl ?? "") : ""
    );
    fd.set(
      "backImageUrl",
      effect === "vario" || effect === "morphing" ? (backImageUrl ?? "") : ""
    );
    if (categoryBgUrl?.trim()) {
      fd.set("categoryBgUrl", categoryBgUrl);
    }
    fd.set("frontHoverGifUrl", hoverMotionUrl?.trim() ?? "");

    fd.set("inStock", inStock ? "on" : "off");
    fd.set("frontImageFocus", JSON.stringify(frontFocus));
    fd.set("middleImageFocus", JSON.stringify(middleFocus));
    fd.set("backImageFocus", JSON.stringify(backFocus));
    fd.set("categoryBgFocus", JSON.stringify(categoryBgFocus));
    fd.set("categoryOrder", categoryOrderInput.trim());
    if (effect === "vario") {
      fd.set("varioSmoothBlend", varioSmoothBlend ? "on" : "off");
    }
    if (effect === "vario" || effect === "morphing") {
      fd.set("varioSmoothing", varioSmoothing.trim() || "0.18");
    }

    try {
      const res = await fetch(apiUrl("/api/cards"), {
        method: isEdit ? "PATCH" : "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(
          typeof data.error === "string" ? data.error : "Не удалось сохранить."
        );
        return;
      }
      setStatus("success");
      setMessage(isEdit ? "Изменения сохранены." : "Карточка добавлена.");
      onSuccess?.();
      if (!isEdit) {
        setTitle("");
        setDescription("");
        setCategory(categories[0].name);
        setCategoryBgUrl(null);
        setEffect("3d-horizontal");
        setPrice("");
        setPriceRub("");
        setRarity("limited");
        setFrontImageUrl(null);
        setHoverMotionUrl(null);
        setMiddleImageUrl(null);
        setBackImageUrl(null);
        if (frontRef.current) frontRef.current.value = "";
        if (hoverMotionRef.current) hoverMotionRef.current.value = "";
        if (middleRef.current) middleRef.current.value = "";
        if (backRef.current) backRef.current.value = "";
        if (categoryBgRef.current) categoryBgRef.current.value = "";
        setFrontFocus(DEFAULT_IMAGE_FOCUS);
        setMiddleFocus(DEFAULT_IMAGE_FOCUS);
        setBackFocus(DEFAULT_IMAGE_FOCUS);
        setCategoryBgFocus(DEFAULT_IMAGE_FOCUS);
        setCategoryOrderInput(
          String(maxCategoryOrderInCategory(allCards, categories[0].name) + 1)
        );
        setVarioSmoothBlend(false);
        setVarioSmoothing("0.18");
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка сети. Попробуйте снова.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-purple-500/15 bg-black/50 px-2.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-purple-500/40 focus:outline-none focus:ring-1 focus:ring-purple-500/30";

  const selectClass =
    "w-full rounded-lg border border-purple-500/15 bg-black/50 px-2.5 py-2 text-sm text-white focus:border-purple-500/40 focus:outline-none focus:ring-1 focus:ring-purple-500/30";

  const fieldLabelClass =
    "mb-1 block text-xs font-semibold tracking-tight text-zinc-200";

  /** Превью лица/оборота: узкая колонка — миниатюра, форма тянется на всю ширину блока. */
  const productImagePreviewFrameClass =
    "w-full overflow-visible rounded-lg border border-purple-500/20 shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-purple-500/10";

  const productImagePreviewRowClass =
    "mt-2 w-full max-w-[9.5rem] overflow-visible px-0.5 sm:max-w-[11rem]";

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-none space-y-3 rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-950/35 to-black/70 p-4 shadow-[0_0_36px_rgba(88,28,135,0.12)] sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
        <label htmlFor="title" className={fieldLabelClass}>
          Название
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="Например, Карточка #7"
        />
        </div>

        <div>
        <label htmlFor="category" className={fieldLabelClass}>
          Категория
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-zinc-500">
            Превью — в пропорциях загруженного лица (как на витрине).
          </span>
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        </div>

        <div>
        <label htmlFor="categoryOrder" className={fieldLabelClass}>
          Порядок в категории
          <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
            Меньше — выше в каталоге. Пусто при правке — без номера.
          </span>
        </label>
        <input
          id="categoryOrder"
          name="categoryOrder"
          type="number"
          min={0}
          max={999999}
          inputMode="numeric"
          value={categoryOrderInput}
          onChange={(e) => setCategoryOrderInput(e.target.value)}
          className={inputClass}
          placeholder={
            isEdit ? "Например 10" : String(maxCategoryOrderInCategory(allCards, category) + 1)
          }
        />
        </div>
      </div>

      <div>
        <label htmlFor="categoryBgFile" className={fieldLabelClass}>
          Фон категории (изображение)
          {isEdit ? (
            <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
              Пусто — не менять
            </span>
          ) : null}
        </label>
        <input
          id="categoryBgFile"
          name="categoryBgFile"
          ref={categoryBgRef}
          type="file"
          accept="image/*"
          onChange={onCategoryBgChange}
          className="block w-full text-xs text-zinc-300 file:mr-2 file:rounded-md file:border-0 file:bg-purple-600 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-purple-500"
        />
        {categoryBgUrl ? (
          <div
            className={`${productImagePreviewRowClass} max-h-[min(36vh,280px)] overflow-y-auto`}
          >
            <div className={productImagePreviewFrameClass}>
              {/*
                Не используем рамку лица карточки: фон категории — отдельный файл
                (постер, баннер); без aspect + cover превью целиком по файлу.
              */}
              <DraggableImageFrame
                src={categoryBgUrl}
                value={categoryBgFocus}
                onChange={setCategoryBgFocus}
                hint={
                  category === "TMNT"
                    ? "Для TMNT файл сохраняется как постер 761×1024 (обложка). Фокус — для витрины."
                    : "По размеру файла, без обрезки. Фокус в данных — для витрины."
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="effect" className={fieldLabelClass}>
          Эффект карточки
        </label>
        <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
          <strong>3D</strong> — одна картинка. <strong>Vario</strong> — две стороны.{" "}
          <strong>Morphing</strong> — масштаб + две картинки.
        </p>
        <select
          id="effect"
          name="effect"
          value={effect}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== "vario" && v !== "morphing" && v !== "3d-horizontal") {
              return;
            }
            setEffect(v);
            if (v === "3d-horizontal") {
              setMiddleImageUrl(null);
              setBackImageUrl(null);
              setVarioSmoothBlend(false);
              if (middleRef.current) middleRef.current.value = "";
              if (backRef.current) backRef.current.value = "";
            }
            if (v === "morphing") {
              setMiddleImageUrl(null);
              setVarioSmoothBlend(false);
              if (middleRef.current) middleRef.current.value = "";
            }
          }}
          className={selectClass}
        >
          <option value="3d-horizontal">3D</option>
          <option value="vario">Vario</option>
          <option value="morphing">Morphing</option>
        </select>
      </div>

      {effect === "vario" ? (
        <div className="rounded-lg border border-purple-500/20 bg-black/30 px-3 py-2">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              name="varioSmoothBlend"
              checked={varioSmoothBlend}
              onChange={(e) => setVarioSmoothBlend(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-purple-500/40 bg-black/60 text-purple-500 focus:ring-purple-500/40"
            />
            <span>
              <span className="font-medium">Плавная смена трёх слоёв</span>
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                Наклонный слой (фон категории), оборот и лицо плавно перетекают
                при движении курсора. Нужен загруженный фон категории. В сетке
                коллекции, где третий слой скрыт, остаётся обычное варио (лицо
                и оборот).
              </span>
            </span>
          </label>
          <div className="mt-2">
            <label
              htmlFor="varioSmoothing"
              className="mb-1 block text-[11px] font-medium text-zinc-400"
            >
              Плавность (инерция курсора), 0.05–0.6
            </label>
            <input
              id="varioSmoothing"
              name="varioSmoothing"
              type="number"
              min={0.05}
              max={0.6}
              step={0.01}
              inputMode="decimal"
              value={varioSmoothing}
              onChange={(e) => setVarioSmoothing(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      ) : effect === "morphing" ? (
        <div className="rounded-lg border border-purple-500/20 bg-black/30 px-3 py-2">
          <p className="text-[11px] leading-snug text-zinc-500">
            Лицо — мелкий герой, второй файл — крупный; морфинг по горизонтали.
          </p>
          <div className="mt-2">
            <label
              htmlFor="varioSmoothingMorph"
              className="mb-1 block text-[11px] font-medium text-zinc-400"
            >
              Плавность (инерция курсора), 0.05–0.6
            </label>
            <input
              id="varioSmoothingMorph"
              name="varioSmoothing"
              type="number"
              min={0.05}
              max={0.6}
              step={0.01}
              inputMode="decimal"
              value={varioSmoothing}
              onChange={(e) => setVarioSmoothing(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className={fieldLabelClass}>
            Цена (BYN)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="priceRub"
            className={fieldLabelClass}
          >
            Цена (RUB)
            <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
              Пусто — по курсу от BYN
            </span>
          </label>
          <input
            id="priceRub"
            name="priceRub"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={priceRub}
            onChange={(e) => setPriceRub(e.target.value)}
            placeholder=""
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="rarity"
            className={fieldLabelClass}
          >
            Редкость
          </label>
          <select
            id="rarity"
            name="rarity"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className={selectClass}
          >
            <option value="common">Обычная</option>
            <option value="limited">Лимитированная</option>
            <option value="adult">18+</option>
            <option value="replica">Реплики</option>
            <option value="novelty">Новинки</option>
            <option value="hot_price">Горячая цена</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="description"
          className={fieldLabelClass}
        >
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y min-h-[4.5rem]`}
          placeholder="Краткое описание карточки"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="inStock"
          name="inStock"
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-purple-500/40 text-purple-600"
        />
        <label htmlFor="inStock" className="text-xs text-zinc-300">
          В наличии
          <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
            Без галочки на сайте показывается «Уже раскупили».
          </span>
        </label>
      </div>

      <div>
        <label
          htmlFor="frontImage"
          className={fieldLabelClass}
        >
          {effect === "morphing"
            ? "Лицевая сторона (мелкий герой / начало морфинга)"
            : "Лицевая сторона"}
          {isEdit ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Загрузите файл только если нужно заменить изображение
            </span>
          ) : null}
          {category === "TMNT" ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Для TMNT изображение сохраняется как 761×1024 (как фон категории).
            </span>
          ) : null}
        </label>
        <input
          ref={frontRef}
          id="frontImage"
          name="frontImage"
          type="file"
          accept="image/*"
          onChange={onFrontChange}
          className="block w-full cursor-pointer text-xs text-zinc-400 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-[0_0_12px_rgba(168,85,247,0.28)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {frontImageUrl ? (
          <div className={productImagePreviewRowClass}>
            <div className={productImagePreviewFrameClass}>
              <DraggableImageFrame
                key={`front-${resolvedCardArtAspectCss}`}
                src={frontImageUrl}
                value={frontFocus}
                onChange={setFrontFocus}
                aspectRatioCss={resolvedCardArtAspectCss}
                objectFit={adminPreviewObjectFit}
                imageStyle={categoryFocusContainStyle(frontFocus)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="hoverMotion"
          className={fieldLabelClass}
        >
          MP4 при наведении (3D-витрина)
          <span className="mt-0.5 block text-xs font-normal text-zinc-500">
            Необязательно. Тот же кадр, что у лицевой картинки — при наведении на
            карточку в 3D показывается короткий ролик. Формат MP4 (загрузка в{" "}
            <code className="text-zinc-400">/uploads/videos/</code>).
            {category === "TMNT"
              ? " Для TMNT ролик по возможности перекодируется в кадр 761×1024 (как фон); нужен ffmpeg в системе."
              : ""}
          </span>
        </label>
        <input
          ref={hoverMotionRef}
          id="hoverMotion"
          name="hoverMotion"
          type="file"
          accept="video/mp4,.mp4,.m4v"
          onChange={onHoverMotionChange}
          className="block w-full cursor-pointer text-xs text-zinc-400 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-[0_0_12px_rgba(168,85,247,0.28)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {hoverMotionUrl ? (
          <div className="mt-2 flex w-full max-w-[11rem] flex-col items-stretch gap-1.5 sm:max-w-[12rem]">
            {resolvedCardArtAspectCss ? (
              <div
                className="relative w-full max-w-full overflow-hidden rounded-lg border border-purple-500/25 bg-black"
                style={{ aspectRatio: resolvedCardArtAspectCss }}
              >
                {isFrontHoverVideoUrl(hoverMotionUrl) ? (
                  <video
                    src={hoverMotionUrl}
                    controls
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain"
                    style={categoryFocusContainStyle(frontFocus)}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- legacy GIF
                  <img
                    src={hoverMotionUrl}
                    alt="Превью при наведении"
                    className="absolute inset-0 h-full w-full object-contain"
                    style={categoryFocusContainStyle(frontFocus)}
                    draggable={false}
                    decoding="async"
                  />
                )}
              </div>
            ) : isFrontHoverVideoUrl(hoverMotionUrl) ? (
              <video
                src={hoverMotionUrl}
                controls
                muted
                playsInline
                className="block h-auto w-full max-w-full rounded-lg border border-purple-500/25"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- legacy GIF
              <img
                src={hoverMotionUrl}
                alt="Превью при наведении"
                className="block h-auto w-full max-w-full rounded-lg border border-purple-500/25"
              />
            )}
            <button
              type="button"
              className="text-xs font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
              onClick={() => {
                setHoverMotionUrl(null);
                if (hoverMotionRef.current) hoverMotionRef.current.value = "";
              }}
            >
              Убрать ролик
            </button>
          </div>
        ) : null}
      </div>

      {effect === "vario" || effect === "morphing" ? (
      <>
      {effect === "vario" ? (
      <div>
        <label
          htmlFor="middleImage"
          className={fieldLabelClass}
        >
          Средняя сторона (Vario), между лицом и оборотом
          <span className="mt-0.5 block text-xs font-normal text-zinc-500">
            Необязательно. На витрине при движении курсора: лицо → середина →
            оборот (при включённом плавном смешении с ultra — четыре слоя по
            горизонтали).
            {category === "TMNT"
              ? " Для TMNT файл сохраняется как 761×1024 (как фон категории)."
              : ""}
          </span>
        </label>
        <input
          ref={middleRef}
          id="middleImage"
          name="middleImage"
          type="file"
          accept="image/*"
          onChange={onMiddleChange}
          className="block w-full cursor-pointer text-xs text-zinc-400 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-[0_0_12px_rgba(168,85,247,0.28)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {middleImageUrl ? (
          <div className={productImagePreviewRowClass}>
            <div className={productImagePreviewFrameClass}>
              <DraggableImageFrame
                key={`mid-${resolvedCardArtAspectCss}`}
                src={middleImageUrl}
                value={middleFocus}
                onChange={setMiddleFocus}
                aspectRatioCss={resolvedCardArtAspectCss}
                objectFit={adminPreviewObjectFit}
                imageStyle={categoryFocusContainStyle(middleFocus)}
              />
            </div>
          </div>
        ) : null}
        {isEdit && middleImageUrl ? (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
            onClick={() => {
              setMiddleImageUrl(null);
              setMiddleFocus(DEFAULT_IMAGE_FOCUS);
              if (middleRef.current) middleRef.current.value = "";
            }}
          >
            Убрать среднюю сторону
          </button>
        ) : null}
      </div>
      ) : null}
      <div>
        <label
          htmlFor="backImage"
          className={fieldLabelClass}
        >
          {effect === "morphing"
            ? "Второе изображение (крупный герой)"
            : "Оборотная сторона (Vario)"}
          {isEdit ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Загрузите файл только если нужно заменить изображение
            </span>
          ) : null}
          {category === "TMNT" ? (
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Для TMNT изображение сохраняется как 761×1024 (как фон категории).
            </span>
          ) : null}
        </label>
        <input
          ref={backRef}
          id="backImage"
          name="backImage"
          type="file"
          accept="image/*"
          onChange={onBackChange}
          className="block w-full cursor-pointer text-xs text-zinc-400 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-violet-600 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white file:shadow-[0_0_12px_rgba(168,85,247,0.28)] hover:file:from-purple-500 hover:file:to-violet-500"
        />
        {backImageUrl ? (
          <div className={productImagePreviewRowClass}>
            <div className={productImagePreviewFrameClass}>
              <DraggableImageFrame
                key={`back-${resolvedCardArtAspectCss}`}
                src={backImageUrl}
                value={backFocus}
                onChange={setBackFocus}
                aspectRatioCss={resolvedCardArtAspectCss}
                objectFit={adminPreviewObjectFit}
                imageStyle={categoryFocusContainStyle(backFocus)}
              />
            </div>
          </div>
        ) : null}
      </div>
      </>
      ) : null}

      {message ? (
        <p
          className={
            status === "error"
              ? "text-xs text-red-400"
              : "text-xs text-emerald-400"
          }
        >
          {message}
        </p>
      ) : null}

      <div
        className={`flex flex-col gap-2 ${isEdit ? "sm:flex-row sm:items-stretch" : ""}`}
      >
        {isEdit ? (
          <button
            type="button"
            onClick={() => onCancelEdit?.()}
            className="w-full rounded-lg border border-white/20 bg-black/30 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/5 sm:w-auto sm:shrink-0"
          >
            Отмена
          </button>
        ) : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full flex-1 rounded-lg bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/25 transition hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_32px_rgba(192,132,252,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? "Сохранение…"
            : isEdit
              ? "Сохранить"
              : "Добавить карточку"}
        </button>
      </div>
    </form>
  );
}
