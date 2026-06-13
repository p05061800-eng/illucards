import { parseImageFocus, type ImageFocus } from "@/app/lib/imageFocus";

export type MenuJsonItem = {
  name: string;
  link: string;
  image: string;
  imageFocus?: ImageFocus;
};

export type MenuJsonSection = {
  title: string;
  items: MenuJsonItem[];
};

export function parseMenuJson(raw: unknown): MenuJsonSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((section) => {
    const s = section as Record<string, unknown>;
    const title = typeof s.title === "string" ? s.title : "";
    const itemsRaw = Array.isArray(s.items) ? s.items : [];
    const items: MenuJsonItem[] = itemsRaw.map((it) => {
      const o = it as Record<string, unknown>;
      const item: MenuJsonItem = {
        name: typeof o.name === "string" ? o.name : "",
        link: typeof o.link === "string" ? o.link : "",
        image: typeof o.image === "string" ? o.image : "",
      };
      const f = parseImageFocus(o.imageFocus);
      if (f) {
        item.imageFocus = f;
      }
      return item;
    });
    return { title, items };
  });
}
