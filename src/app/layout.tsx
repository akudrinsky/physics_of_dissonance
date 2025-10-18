import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "katex/dist/katex.min.css";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Physics of Dissonance",
  description: "A modern, interactive theory of dissonance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (typeof window !== "undefined") {
    try {
      const bc = new BroadcastChannel("dissonance-audio");
      // stop others on route changes and visibility changes
      const stopAll = () => { try { bc.postMessage({ type: "stop-others", src: "route-change" }); } catch {} };
      window.addEventListener("pagehide", stopAll);
      window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") stopAll(); });
    } catch {}
  }
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-8rem)]">
          {children}
        </main>
        <Footer />
        <SpeedInsights />
      </body>
    </html>
  );
}
