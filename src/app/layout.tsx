import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { HIDE_GMAIL_FEATURES } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3D Model Aggregator",
  description:
    "Unified search and favorites across MakerWorld, Printables, Thingiverse, Cults3D, and Thangs.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getI18n();

  return (
    <html lang={locale} className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-50 antialiased`}
      >
        <I18nProvider locale={locale} messages={messages}>
          <Header />
          <Sidebar hideGmailFeatures={HIDE_GMAIL_FEATURES} />
          <MobileNav hideGmailFeatures={HIDE_GMAIL_FEATURES} />
          <ServiceWorkerRegistration />
          <main className="min-h-screen pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-56">
            <div className="mx-auto max-w-6xl p-6">{children}</div>
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
