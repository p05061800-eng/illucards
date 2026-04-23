"use client";

import { useId, type ReactNode } from "react";
import { useAdultContentGateOptional } from "@/app/context/AdultContentContext";

type Props = {
  isAdult: boolean;
  children: ReactNode;
  /**
   * `full` — размытие + плашка с подтверждением (герой, товар, 3D).
   * `blurOnly` — только размытие (миниатюры в рельсе, декор в витрине).
   */
  mode?: "full" | "blurOnly";
};

export function AdultContentBlurGate({
  isAdult,
  children,
  mode = "full",
}: Props) {
  const uid = useId();
  const titleId = `adult-gate-title-${uid}`;
  const descId = `adult-gate-desc-${uid}`;
  const ctx = useAdultContentGateOptional();
  const confirmed = ctx?.confirmed ?? false;
  const confirmAdult = ctx?.confirmAdult ?? (() => {});

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
              onClick={confirmAdult}
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
