import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const heading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "bestdeals — Good finds. Great prices.",
  description:
    "One little corner of the internet for worthwhile deals. Discover the latest finds from Slickdeals, HotUKDeals and DealNews, and save your favorites.",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: "#f8f9f6" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${heading.variable}`}>
      <body>{children}</body>
    </html>
  );
}
