type Props = {
  text: string | undefined | null;
  fallback: string;
  /** Дополнительные классы (например `block` для line-clamp у родителя). */
  className?: string;
};

/** Сохраняет переносы строк и пустые строки между абзацами в описании карточки. */
export function CardDescriptionText({ text, fallback, className = "" }: Props) {
  const content = (text ?? "").trim() || fallback;
  return (
    <span className={`whitespace-pre-line ${className}`.trim()}>{content}</span>
  );
}
