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

export function isAdultAgeGateTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest?.("[data-adult-age-gate]"));
}

export function AdultContentBlurGate({
  isAdult,
  cardId,
  children,
  mode = "full",
}: Props) {
  const uid = useId();
  const buttonId = `adult-gate-btn-${uid}`;
  const ctx = useAdultContentGateOptional();
  const id = cardId?.trim() ?? "";
  const confirmed = id ? (ctx?.isAdultConfirmed(id) ?? false) : false;
  const confirmForCard = useCallback(() => {
    if (id) ctx?.confirmAdultForCard(id);
  }, [ctx, id]);

  const onConfirmPress = useCallback(
    (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      e.preventDefault();
      e.stopPropagation();
      confirmForCard();
    },
    [confirmForCard],
  );

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
          data-adult-age-gate
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-[200] flex justify-center rounded-b-[inherit] p-2 pt-6 touch-manipulation"
        >
          <button
            id={buttonId}
            type="button"
            data-adult-age-gate
            onClick={onConfirmPress}
            onPointerUp={onConfirmPress}
            className="relative z-20 max-w-full touch-manipulation rounded-full border border-rose-400/75 bg-rose-950/95 px-4 py-2.5 text-xs font-semibold text-rose-50 shadow-[0_0_22px_rgba(244,63,94,0.35)] transition hover:bg-rose-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:px-5 sm:py-3 sm:text-sm"
          >
            Мне есть 18 лет
          </button>
        </div>
      ) : null}
    </div>
  );
}
