/** Данные, которые отдаёт Telegram Login Widget после авторизации у @BotFather. */

export type TelegramWidgetAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/** Профиль после проверки подписи на сервере (без hash). */
export type TelegramVerifiedProfile = {
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
};

export function getTelegramBotUsername(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) {
    return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.replace(/^@/, "").trim();
  }
  return "";
}
