/** `/api/media/x` → `/uploads/x` — на Vercel файл с CDN, не через serverless. */
export function publicCdnUploadUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith("/api/media/")) {
    return `/uploads/${t.slice("/api/media/".length)}`;
  }
  return t;
}
