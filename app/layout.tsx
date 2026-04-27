import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist_Mono, Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import Header from "@/components/Header";
import { RefreshToHome } from "@/components/RefreshToHome";
import { FloatingCartFab } from "@/components/FloatingCartFab";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Providers } from "./providers";
import "./globals.css";

/** Без этого на телефоне страница может вести себя как «десктоп по ширине» — мелкий текст и сдвиги. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

/** Заголовки (латиница — сам шрифт; кириллица автоматически через Inter в стеке). */
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IlluCards — премиальные коллекционные карточки",
  description:
    "Премиальные 3D и Vario коллекционные карточки с голографическими эффектами.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const telegramOrderBot =
    process.env.NEXT_PUBLIC_TELEGRAM_ORDER_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
    "";

  return (
    <html
      lang="ru"
      className={`${inter.variable} ${bebasNeue.variable} ${geistMono.variable} antialiased`}
      data-telegram-order-bot={telegramOrderBot}
    >
      <body className="flex flex-col overflow-x-hidden bg-[var(--background)] text-zinc-100 antialiased [color-scheme:dark]">
        <Providers>
          <RefreshToHome />
          <Header />
          <div className="wrapper main relative z-0 flex w-full min-w-0 flex-col overflow-x-hidden">
            {children}
          </div>
          <SiteFooter />
          <FloatingCartFab />
          <ScrollToTopButton />
        </Providers>
      </body>
    </html>
  );
}
