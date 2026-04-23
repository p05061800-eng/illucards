"use client";

import Link from "next/link";

type Props = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Для нативной отправки `<form>` */
  required?: boolean;
};

export function PrivacyConsentCheckbox({
  id,
  checked,
  onChange,
  disabled,
  required,
}: Props) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 text-left text-sm leading-snug text-zinc-400"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required={required}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/20 bg-zinc-950 accent-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span>
        Я согласен с{" "}
        <Link
          href="/privacy"
          className="text-violet-300/95 underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          политикой конфиденциальности
        </Link>
      </span>
    </label>
  );
}
