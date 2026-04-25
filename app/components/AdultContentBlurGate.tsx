"use client";

import { useId, useCallback, type ReactNode } from "react";
import { useAdultContentGateOptional } from "@/app/context/AdultContentContext";

type Props = {
  isAdult: boolean;
  /** Без id при isAdult контент остаётся закрытым. */
  cardId?: string;
  children: ReactNode;
  /**
   * `full` — размытие + плашка с подтверждением (герой, товар, 3D).
   * `blurOnly` — только размытие (миниатюры в рельсе, декор в витрине).
   */
  mode?: "full" | "blurOnly";
};

export type AgeConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function AgeConfirmDialog({
  open,
  onClose,
  onConfirm,
}: AgeConfirmDialogProps) {
  const uid = useId();
  const titleId = `age-confirm-${uid}`;
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-rose-500/45 bg-zinc-950/95 p-6 shadow-[0_0_40px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/20">
        <p
          id={titleId}
          className="text-center text-lg font-semibold tracking-tight text-white"
        >
          Вам есть 18?
        </p>
        <p className="mt-2 text-center text-xs leading-relaxed text-zinc-400">
          Подтвердите возраст, чтобы открыть эту карточку.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Нет
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-rose-400/70 bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Да
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdultContentBlurGate({
  isAdult,
  cardId,
  children,
  mode = "full",
}: Props) {
  const uid = useId();
  const titleId = `adult-gate-title-${uid}`;
  const descId = `adult-gate-desc-${uid}`;
  const ctx = useAdultContentGateOptional();
  const id = cardId?.trim() ?? "";
  const confirmed = id ? (ctx?.isAdultConfirmed(id) ?? false) : false;
  const confirmForCard = useCallback(() => {
    if (id) ctx?.confirmAdultForCard(id);
  }, [ctx, id]);

  const locked = isAdult && !confirmed;

  if (!isAdult) {
    return <>{children}</>;
  }

  const blurWrap = (
    <div
      className={
        locked
          ? "pointer-events-none select-none blur-2xl saturate-[0.65]"
          : ""
      }
    >
      {children}
    </div>
  );

  if (mode === "blurOnly") {
    return <div className="relative min-h-0 min-w-0">{blurWrap}</div>;
  }

  return (
    <div className="relative isolate min-h-0 min-w-0 overflow-visible">
      {blurWrap}
      {locked ? (
        <div
          className="absolute inset-0 z-[120] flex flex-col items-center justify-center gap-3 rounded-[inherit] p-4 text-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div
            className="absolute inset-0 rounded-[inherit] bg-black/65 backdrop-blur-[3px]"
            aria-hidden
          />
          <div className="relative z-10 flex max-w-[16rem] flex-col items-center gap-3">
            <p
              id={titleId}
              className="text-sm font-semibold tracking-tight text-white"
            >
              Контент 18+
            </p>
            <p
              id={descId}
              className="text-xs leading-snug text-zinc-300"
            >
              Чтобы увидеть изображение, подтвердите, что вам уже исполнилось 18
              лет.
            </p>
            <button
              type="button"
              onClick={confirmForCard}
              className="pointer-events-auto rounded-full border border-rose-400/75 bg-rose-950/95 px-4 py-2.5 text-sm font-semibold text-rose-50 shadow-[0_0_22px_rgba(244,63,94,0.35)] transition hover:bg-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Мне есть 18 лет
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
