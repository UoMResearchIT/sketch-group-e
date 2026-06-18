import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "./convex-client-provider";
import { ThemeInit } from "./theme-init";
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
  title: "r/place — Convex Live Canvas",
  description:
    "A real-time collaborative pixel canvas powered by Convex — paint, zoom, and create pixel art live with others.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeInit />
      </head>
      <body className="h-full overflow-hidden flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
