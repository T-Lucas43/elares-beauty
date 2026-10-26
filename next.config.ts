import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { cpus: 1 },
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit"],
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: (
    process.env.DEV_ALLOWED_ORIGINS || "localhost,127.0.0.1"
  ).split(","),
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};
export default config;
