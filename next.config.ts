import type { NextConfig } from "next";

/** Попадает в клиентский бандл и в RSC layout — при каждом новом деплое (новый commit) сброс волатильного LS. */
const nextPublicAppBuildId =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.npm_package_version?.trim() ||
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: nextPublicAppBuildId,
  },
  turbopack: {},
  /** Меньше модулей в бандле при импорте из barrel-пакетов (легче dev/build). */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  /**
   * Меньше файлов под watch → ниже риск EMFILE на macOS.
   * Без этого Watchpack иногда «роняет» dev и даёт 404 на `/` и `/api/*`.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      const extraIgnored = [
        "**/public/uploads/**",
        "**/.next/cache/**",
      ];
      const wo = config.watchOptions ?? {};
      const prev = wo.ignored;
      /** Next может задавать `ignored` как RegExp — в общий массив их смешивать нельзя (падает схема Webpack). */
      const stringPrev: string[] = Array.isArray(prev)
        ? prev.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        : typeof prev === "string" && prev.trim().length > 0
          ? [prev.trim()]
          : [];
      const ignored = [...stringPrev, ...extraIgnored];
      config.watchOptions = { ...wo, ignored: [...new Set(ignored)] };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/category/:path*",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
