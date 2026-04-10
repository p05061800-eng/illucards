/**
 * Относительный путь к API для fetch() в браузере — тот же origin, что и страница
 * (localhost, LAN IP, продакшен-домен). Не хардкодить хост.
 */
export function apiUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
