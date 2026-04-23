import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Меньше модулей в бандле при импорте из barrel-пакетов (легче dev/build). */
  experimental: {
    optimizePackageImports: ["lucide-react"],
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
