import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import Header from "@/components/Header";
import { RefreshToHome } from "@/components/RefreshToHome";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex flex-col overflow-x-visible bg-[var(--background)] text-zinc-100 antialiased [color-scheme:dark]">
        <Providers>
          <RefreshToHome />
          <Header />
          <div className="wrapper relative z-0 flex w-full min-w-0 flex-col overflow-visible">
            {children}
          </div>
          <SiteFooter />
          <ScrollToTopButton />
        </Providers>
      </body>
    </html>
  );
}
