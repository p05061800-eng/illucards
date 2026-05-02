"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CardRarity } from "@/app/lib/cardRarityTags";
import { useCategoryTiles } from "@/app/context/CategoryFramesContext";
import { getCardArtIntrinsicSize } from "@/app/lib/cardArtIntrinsicSize";
import { cardRequiresAgeConfirmation } from "@/app/lib/cardRequiresAgeConfirmation";
import { AdultContentBlurGate } from "@/app/components/AdultContentBlurGate";

export type OrderLineRowModel = {
  id: string;
  title: string;
  quantity: number;
  frontImage?: string;
  category?: string;
  rarity?: CardRarity;
};

type Tone = "light" | "dark";

type Props = {
  line: OrderLineRowModel;
  tone?: Tone;
  /** Узкая колонка миниатюры как в выезжающей корзине */
  compact?: boolean;
  /** Цена × кол-во и т.п. */
  subtitle?: ReactNode;
  /** Сумма строки справа */
  trailing?: ReactNode;
};

const shellTone: Record<Tone, string> = {
  light:
    "flex items-start gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3 sm:gap-4 sm:p-3.5",
  dark:
    "flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:gap-4",
};

const thumbTone: Record<Tone, string> = {
  light:
    "flex shrink-0 items-start justify-center self-start overflow-visible rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80",
  dark:
    "flex shrink-0 items-start justify-center self-start overflow-visible rounded-2xl bg-zinc-900 ring-1 ring-white/10",
};

const titleTone: Record<Tone, string> = {
  light:
    "line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 transition hover:text-violet-700 sm:text-[15px]",
  dark:
    "line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 transition hover:text-purple-200",
};

const titlePlainTone: Record<Tone, string> = {
  light: "line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 sm:text-[15px]",
  dark: "line-clamp-2 text-sm font-semibold leading-snug text-zinc-100",
};

export function OrderLineRow({
  line,
  tone = "light",
  compact = false,
  subtitle,
  trailing,
}: Props) {
  const categoryTiles = useCategoryTiles();
  const art = getCardArtIntrinsicSize(line.category, categoryTiles);
  const thumbW = compact ? "w-[3.25rem] sm:w-[3.5rem]" : "w-[4.5rem] sm:w-[5.25rem]";
  const sizes = compact ? "52px" : "84px";
  const isAdult = cardRequiresAgeConfirmation({ rarity: line.rarity });

  return (
    <div className={shellTone[tone]}>
      <div className={`${thumbTone[tone]} ${thumbW}`}>
        {line.frontImage ? (
          <AdultContentBlurGate isAdult={isAdult} cardId={line.id} mode="blurOnly">
            <Image
              src={line.frontImage}
              alt=""
              width={art.width}
              height={art.height}
              className="h-auto w-full rounded-2xl"
              sizes={sizes}
              unoptimized={
                line.frontImage.startsWith("/") || line.frontImage.startsWith("data:")
              }
              style={{
                width: "100%",
                height: "auto",
                objectFit: "unset",
              }}
            />
          </AdultContentBlurGate>
        ) : (
          <div
            className={`flex min-h-[2.75rem] w-full items-center justify-center text-xs ${
              tone === "light" ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            —
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {line.id ? (
              <Link href={`/card/${encodeURIComponent(line.id)}`} className={titleTone[tone]}>
                {line.title}
              </Link>
            ) : (
              <span className={titlePlainTone[tone]}>{line.title}</span>
            )}
            {subtitle ? (
              <div
                className={
                  tone === "light"
                    ? "mt-1 text-xs tabular-nums text-zinc-600 sm:text-sm"
                    : "mt-1 text-xs tabular-nums text-purple-200/80"
                }
              >
                {subtitle}
              </div>
            ) : null}
          </div>
          {trailing ? (
            <div
              className={`shrink-0 text-sm font-semibold tabular-nums sm:text-base ${
                tone === "light" ? "text-zinc-900" : "text-zinc-100"
              }`}
            >
              {trailing}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
