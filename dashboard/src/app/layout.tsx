import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-loaded",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LetAliceLead — Agent Credit & Procurement",
  description: "Credit & procurement infrastructure for AI agents. Alice procures creditworthiness data from 7 Locus wrapped APIs and issues USDC credit lines on Base. Powered by PayWithLocus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sourceSerif.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-sans-loaded), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
