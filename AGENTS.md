<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local development

`package.json` `engines` pins **Node 24.x**. Install with `npm ci`, then `cp -n .env.example .env.local`. `npm run dev` serves **http://localhost:3010**.

Open that `localhost` URL. Next.js 16 rejects `/_next` dev assets when the page is opened as `127.0.0.1`, so the UI stays on «Загрузка…» and the cart never hydrates.

The storefront and cart work from git catalog data without Redis or Telegram secrets. Admin login needs `ADMIN_PASSWORD` in `.env.local`. `npm run lint` currently reports existing source errors; `npx tsc --noEmit` and `npm run build` are the clean checks.
