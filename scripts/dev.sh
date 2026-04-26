#!/usr/bin/env bash
# Останавливает старый next dev на портах проекта и запускает новый (порт по умолчанию 3010).
set -e
# macOS: при низком ulimit Watchpack падает с EMFILE → маршруты не поднимаются (404).
ulimit -n 10240 2>/dev/null || ulimit -n 8192 2>/dev/null || ulimit -n 4096 2>/dev/null || true
PORT="${PORT:-3010}"
if command -v lsof >/dev/null 2>&1; then
  for p in 3002 "$PORT"; do
    PIDS=$(lsof -ti ":$p" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "Освобождаю порт $p (PID: $PIDS)..."
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
  done
  sleep 0.4
fi
# Next.js 16: lock «другой dev уже запущен»
rm -f .next/dev/lock 2>/dev/null || true
# Если Turbopack «ломается» (panic, missing *.sst) — остановите dev и выполните: rm -rf .next
#
# По умолчанию — webpack: на macOS при «too many open files» (EMFILE) Turbopack/Watchpack может
# не подхватить маршруты, и тогда / и /api/* отдают 404. Webpack стабильнее. Для Turbopack:
#   NEXT_DEV_TURBOPACK=1 npm run dev

# Подсказка для входа с телефона / планшета в той же Wi‑Fi (см. -H 0.0.0.0 ниже)
LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  for iface in en0 en1 bridge100; do
    LAN_IP=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    [ -n "$LAN_IP" ] && break
  done
fi
if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

echo ""
echo "  Открыть на этом компьютере:  http://localhost:$PORT"
echo "  Админка:                       http://localhost:$PORT/admin"
if [ -n "$LAN_IP" ]; then
  echo "  С другого устройства (Wi‑Fi): http://$LAN_IP:$PORT/admin"
else
  echo "  С другого устройства: подставь IP этого Mac в Wi‑Fi (Системные настройки → Сеть) → http://<IP>:$PORT/admin"
fi
echo ""

if [ -n "${NEXT_DEV_TURBOPACK:-}" ]; then
  exec next dev -H 0.0.0.0 -p "$PORT"
else
  exec next dev -H 0.0.0.0 -p "$PORT" --webpack
fi
