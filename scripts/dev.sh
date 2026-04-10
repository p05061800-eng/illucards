#!/usr/bin/env bash
# Останавливает старый next dev на портах проекта и запускает новый (порт по умолчанию 3010).
set -e
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

exec next dev -H 0.0.0.0 -p "$PORT"
