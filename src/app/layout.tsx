import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { HIDE_GMAIL_FEATURES } from "@/lib/config";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-50 antialiased`}
      >
        <Header />
        <Sidebar hideGmailFeatures={HIDE_GMAIL_FEATURES} />
        <main className="min-h-screen pt-14 md:pl-56">
          <div className="mx-auto max-w-6xl p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
