import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NEXVORO — Where Innovation Meets Lifestyle",
    template: "%s — NEXVORO",
  },
  description: "Discover thoughtfully selected technology, designed for the way you live. Shop NEXVORO smartphones, audio, gaming, home and more.",
  applicationName: "NEXVORO",
  openGraph: {
    title: "NEXVORO — Where Innovation Meets Lifestyle",
    description: "Technology, considered. Discover the next essentials for work, play and everyday life.",
    siteName: "NEXVORO",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#10100f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="luxury-black" suppressHydrationWarning>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
