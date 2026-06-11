"use client";

import { useEffect } from "react";

const CANONICAL_ORIGIN = "https://www.illucards.by";

/** illucards.by → www.illucards.by (один origin для cookie и API). */
export function CanonicalHostRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (host !== "illucards.by") return;
    const dest = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(dest);
  }, []);

  return null;
}
