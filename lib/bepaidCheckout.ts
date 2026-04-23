/**
 * Встраиваемый checkout bePaid (beGateway).
 * @see https://docs.bepaid.by/en/integration/widget/setup/
 */

import type {
  BeGatewayParams,
  BePaidWidgetCloseStatus,
} from "@/types/begateway";

export const BEPAID_WIDGET_SCRIPT = "https://js.bepaid.by/widget/be_gateway.js";
export const BEPAID_CHECKOUT_URL = "https://checkout.bepaid.by";

/** Тестовый public key из документации bePaid (замените на NEXT_PUBLIC_BEPAID_PUBLIC_KEY). */
export const BEPAID_TEST_PUBLIC_KEY_FALLBACK =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxMS2arTU9LY/CzxIZOS5+0sWzkMWjFfok31BlHT5Mw0BnQ28to7qFJebeemJjClCzSDwix8eZsXzpclO1yRt8jkmxqAbn8UFfDw+CGdmT3uBMC2+8BfE0aVKhztG5RtTJBBUcGsgJ4hfd4LYeUJMTHdBtF8pmhTfuZJrZj9xVgnarWmhRX568yRTq92VBrYKt0hxUabvmm5Z5weIrWLbtg0FEMRRGjtjx02ePDNAvDxfu08xXwax8wUrNjEuJcKC42iJAPM3oCOky9lBTnaiQpcRCBthScAN8lZmEaJg31l0eLCsUHYysYz5ILurCYHWjLPr7qjWWRVcitLdhJZDCQIDAQAB";

export function getBePaidPublicKey(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BEPAID_PUBLIC_KEY) {
    return process.env.NEXT_PUBLIC_BEPAID_PUBLIC_KEY.trim();
  }
  return BEPAID_TEST_PUBLIC_KEY_FALLBACK;
}

let scriptPromise: Promise<void> | null = null;

/** Подключает checkout.js один раз. */
export function loadBeGatewayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Только в браузере"));
  }
  if (window.BeGateway) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${BEPAID_WIDGET_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("bePaid: ошибка загрузки")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = BEPAID_WIDGET_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Не удалось загрузить виджет оплаты"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type PayOptions = {
  /** Сумма в минимальных единицах валюты (копейки для BYN/RUB). */
  amountMinor: number;
  currency: string;
  description: string;
  trackingId: string;
  test?: boolean;
  onClose: (status: BePaidWidgetCloseStatus) => void;
};

/**
 * Открывает встроенный виджет оплаты (iframe), без ухода со страницы.
 */
export function pay(options: PayOptions): void {
  if (typeof window === "undefined" || !window.BeGateway) {
    throw new Error("BeGateway не загружен — вызовите loadBeGatewayScript() раньше");
  }

  const publicKey = getBePaidPublicKey();

  const params: BeGatewayParams = {
    checkout_url: BEPAID_CHECKOUT_URL,
    fromWebview: true,
    checkout: {
      iframe: true,
      test: options.test ?? true,
      transaction_type: "payment",
      public_key: publicKey,
      order: {
        amount: options.amountMinor,
        currency: options.currency,
        description: options.description,
        tracking_id: options.trackingId,
      },
    },
    closeWidget: options.onClose,
  };

  new window.BeGateway(params).createWidget();
}
