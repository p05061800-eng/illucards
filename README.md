# illucards

Магазин и личный кабинет на [Next.js](https://nextjs.org) (App Router). В `package.json` зафиксирован **Node 20.x**.

---

## Гайд: локальная разработка

```bash
npm install
npm run dev
```

- Скрипт `dev` запускает `scripts/dev.sh`: Next слушает **`0.0.0.0`** (удобно с телефона в той же Wi‑Fi), порт по умолчанию **`3010`** (если занят — берётся следующий свободный).
- Открой в браузере: **http://localhost:3010** (или порт из вывода в терминале).
- Админка: **http://localhost:3010/admin**
- Если маршруты «пропали» или Turbopack падает — в `scripts/dev.sh` есть подсказки; по умолчанию dev идёт с **webpack** (`--webpack`).

Сборка и локальный прод:

```bash
npm run build
npm run start
```

`start` поднимает приложение на **`0.0.0.0:3010`**.

Прочее:

```bash
npm run lint
```

### Заказы, корзина и бонусы (как работает в проде)

- **После оформления заказа на сайте** корзина в **браузере** по-прежнему **не очищается автоматически** до прихода данных с сервера (клиент подхватывает пустую корзину из `GET /api/user-state`, когда на сервере её очистили).
- **Синхронизированная корзина** (Redis / синк с ботом) очищается при **`confirmed`** («Принят» — подтверждение в боте/админка с тем же API) **и** при **`paid`** («💳 Чек оплаты отправил» в боте): `POST /api/order/update` → см. `app/api/order/update/route.ts`. После этого обновляется и отображение бонусов в ЛК через тот же user-state.
- В **ЛК** на главной кабинета и в **«Мои заказы»** состав заказа для статусов **не «Новый»** по умолчанию **свёрнут**; раскрывается кнопкой «Показать состав». У **«Нового»** состав показывается сразу (удобно проверить до подтверждения).
- **Бонусные баллы** начисляются один раз на заказ при переходе в подходящий статус (**«Принят»**, **«Чек получен»** / `paid`, отправка/доставка — см. `app/lib/bonusProgram.ts` и `bonus_awarded` в `app/lib/orderTypes.ts`), с защитой от повторного начисления.
- **ЛК: заказы и баллы** отдаются API по cookie `telegram_user_id` (и по Redis/файлу для `GET /api/user-state`). Если в профиле виден Telegram ID, а заказов и баллов нет — проверь cookie (повторный вход), а на **Vercel без постоянного диска** заказы в `data/orders` и файл `data/telegram-user-state.json` не переживают деплой — нужен **VPS/том** или **Upstash Redis** для user-state + хранение заказов вне эфемерной ФС.

---

## Деплой

### Vercel (рекомендуемый путь из репозитория)

В корне есть `vercel.json` (`framework: nextjs`). Скрипты:

```bash
npm run vercel:link    # один раз: привязка к проекту Vercel
npm run vercel:deploy  # прод: npx vercel deploy --prod
```

1. [Vercel CLI](https://vercel.com/docs/cli), логин.
2. `npm run vercel:link`.
3. В [Dashboard](https://vercel.com) → **Settings → Environment Variables** задать переменные из раздела ниже (секреты — только на сервере; для браузера — с префиксом **`NEXT_PUBLIC_`**).
4. Деплой: `npm run vercel:deploy` или push в подключённую к Vercel ветку.

### Git: скрипт `npm run deploy`

Это **не** автодеплой Vercel сам по себе: команда делает `git add .`, при наличии изменений — **`git commit -m "deploy"`** и **`git push`**. Используй осознанно; для обычной работы чаще удобнее ручной `git commit` + `git push`.

### Заказы и файлы на диске

Заказы сохраняются в **`data/orders`** (см. `app/lib/orderPaths.ts`). На **Vercel** (serverless) постоянная запись в такой каталог **как правило непригодна** для продакшена: нужен **VPS/Docker с постоянным томом** для `data/orders` (и при необходимости `public/uploads`) или перенос хранения заказов во внешнее хранилище/БД.

На **VPS**: `git clone`, `npm ci`, `npm run build`, за reverse proxy (nginx/Caddy) — `npm run start` или процесс-менеджер (systemd, pm2).

### Telegram-бот

Каталог **`telegram_bot/`** — отдельный Python-сервис (`requirements.txt`). Деплой на свой хостинг (например Render); URL и секреты должны совпадать с тем, что настроено в Next (синк заказов, коды входа и т.д.).

---

## Переменные окружения

**Сервер (не начинать с `NEXT_PUBLIC_`):**

| Переменная | Назначение (кратко) |
|------------|---------------------|
| `TELEGRAM_BOT_TOKEN` | Бот: авторизация, уведомления, админ |
| `TELEGRAM_WIDGET_COOKIE_SECRET` | Подпись сессии виджета (иначе fallback в коде) |
| `TELEGRAM_ADMIN_CHAT_ID` / `ILLUCARDS_TELEGRAM_ADMIN_CHAT_ID` | Чат админа для заказов |
| `ILLUCARDS_ORDER_UPDATE_SECRET` | Секрет для API обновления заказа / связанных маршрутов |
| `ILLUCARDS_USER_STATE_SYNC_SECRET` | Синхронизация user-state |
| `ILLUCARDS_LOGIN_CODE_SYNC_SECRET` | Внутренний sync кода входа |
| `TELEGRAM_SYNC_API_URL`, `TELEGRAM_SYNC_API_SECRET` | Синк состояния с ботом |
| `TELEGRAM_AUTH_CODE_MAP`, `TELEGRAM_AUTH_CODE_VERIFY_URL` | Поток авторизации по коду |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Redis (или пара `KV_REST_API_*`) |

**Публичные (попадают в клиентский бандл):**

| Переменная | Назначение |
|------------|------------|
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Имя бота для виджета/ссылок |
| `NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME` | Бот заказов (если отдельный) |
| `NEXT_PUBLIC_TELEGRAM_CODE_VERIFY_URL` | URL верификации кода (в коде есть дефолт для бота на Render) |

Точные сценарии использования смотри в `app/api/*` и `app/lib/telegram*.ts`.

---

## Документация Next.js

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploying Next.js](https://nextjs.org/docs/app/building-your-application/deploying)
