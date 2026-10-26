import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import "./elares.css";
import "./beauty.css";
import ThemeControl from "@/components/ThemeControl";
import { beauty } from "@/lib/beauty";
import PageScrollReset from "@/components/PageScrollReset";
export const metadata: Metadata = {
  title: `${beauty.name} — Gestão de salões de beleza`,
  description: "Sua agenda organizada. Seu negócio em boas mãos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Elares Beauty",
    statusBarStyle: "default",
  },
  icons: { icon: "/icons/elares-192.png", apple: "/icons/elares-180.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FAF9FC" }, { media: "(prefers-color-scheme: dark)", color: "#171220" }],
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeControl />
        <PageScrollReset />
        {children}
      </body>
    </html>
  );
}
