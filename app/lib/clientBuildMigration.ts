/**
 * После деплоя клиенты иначе держат старые данные в localStorage (валюта,
 * некоторые UI-метки). Сравниваем маркер с id текущей сборки и
 * очищаем «волатильные» ключи до гидрации React (см. `app/layout.tsx`).
 *
 * Сессию Telegram / Auth в localStorage не трогаем — пользователь остаётся вошедшим.
 */

export const CLIENT_BUILD_MARKER_KEY = "illucards-app-build-id";

/** Должны совпадать с реальными ключами в контекстах / формах. */
export const LOCAL_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD = [
  "illucards-delivery-country",
  "illucards-currency",
  "illucards-purchased-cards",
] as const;

export const SESSION_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD = [
  "illucards_tg_login_wait_id",
  "illucards-catalog-return-card",
] as const;

/**
 * Клиентская версия миграции без вставки `<script>` в React-дерево.
 */
export function runClientStorageMigration(buildId: string): void {
  try {
    const marker = CLIENT_BUILD_MARKER_KEY;
    if (typeof localStorage !== "undefined" && localStorage.getItem(marker) === buildId) return;
    if (typeof localStorage !== "undefined") {
      for (const key of LOCAL_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD) {
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.setItem(marker, buildId);
      } catch {
        /* ignore */
      }
    }
    if (typeof sessionStorage !== "undefined") {
      for (const key of SESSION_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Минифицированный IIFE для `next/script` strategy=beforeInteractive.
 * `buildId` подставляется только из серверного layout (уже экранирован JSON.stringify).
 */
export function clientStorageMigrationInlineScript(buildId: string): string {
  const marker = JSON.stringify(CLIENT_BUILD_MARKER_KEY);
  const v = JSON.stringify(buildId);
  const keys = JSON.stringify([...LOCAL_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD]);
  const sess = JSON.stringify([...SESSION_STORAGE_KEYS_VOLATILE_ON_NEW_BUILD]);
  return `(function(){try{var m=${marker},b=${v};if(typeof localStorage!=="undefined"&&localStorage.getItem(m)===b)return;var ks=${keys},i,ss=${sess},j;if(typeof localStorage!=="undefined"){for(i=0;i<ks.length;i++){try{localStorage.removeItem(ks[i]);}catch(e){}}try{localStorage.setItem(m,b);}catch(e){}}if(typeof sessionStorage!=="undefined"){for(j=0;j<ss.length;j++){try{sessionStorage.removeItem(ss[j]);}catch(e){}}}}catch(e){}})();`;
}
