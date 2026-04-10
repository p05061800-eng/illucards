"use client";

import { useEffect } from "react";

type Props = {
  show: boolean;
  onClose: () => void;
};

export function FavoritePopup({ show, onClose }: Props) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-[195] animate-bounce rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      ❤️ Добавлено в избранное
    </div>
  );
}
