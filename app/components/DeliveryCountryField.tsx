"use client";

import type { DeliveryCountry } from "../lib/delivery";
import { DELIVERY_COUNTRY_OPTIONS } from "../lib/delivery";

type Props = {
  id?: string;
  value: DeliveryCountry | null;
  onChange: (country: DeliveryCountry | null) => void;
  className?: string;
};

export function DeliveryCountryField({
  id,
  value,
  onChange,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-2xl border border-violet-500/35 bg-gradient-to-br from-violet-950/50 via-purple-950/30 to-black/50 p-4 shadow-[0_0_28px_rgba(124,58,237,0.18)] ring-1 ring-inset ring-violet-400/15 ${className}`.trim()}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-2 w-2 shrink-0 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]"
            aria-hidden
          />
          <label
            htmlFor={id}
            className="text-sm font-semibold tracking-tight text-violet-100"
          >
            Страна доставки
          </label>
        </div>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onChange(null);
            else onChange(v as DeliveryCountry);
          }}
          className={
            "w-full cursor-pointer rounded-xl border-2 border-violet-400/45 bg-black/55 px-4 py-3.5 text-base font-medium text-zinc-50 outline-none " +
            "shadow-inner shadow-black/40 transition " +
            "hover:border-violet-400/70 hover:bg-black/65 " +
            "focus:border-violet-400 focus:ring-2 focus:ring-violet-400/45 " +
            (value ? "" : "text-violet-200/90 ")
          }
        >
          <option value="" className="bg-zinc-900 text-zinc-300">
            Выберите страну…
          </option>
          {DELIVERY_COUNTRY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id} className="bg-zinc-900">
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
