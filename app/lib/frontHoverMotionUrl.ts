/** Короткое видео при наведении на лицо (MP4/WebM/MOV в `/uploads/videos/`). */
export function isFrontHoverVideoUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  return (
    t.endsWith(".mp4") ||
    t.endsWith(".m4v") ||
    t.endsWith(".webm") ||
    t.endsWith(".mov")
  );
}
