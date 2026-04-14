import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: Fraunces — variable serif, using the SOFT axis for rounded friendly
// personality on the wordmark and headlines. Not Inter. Not Playfair. Not generic.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display-loaded",
  display: "swap",
});

// Body: Instrument Sans — distinctive geometric humanist sans, warmer than
// Inter/Roboto with softly rounded terminals. Pairs with Fraunces.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body-loaded",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full"
        style={{ fontFamily: "var(--font-body-loaded), 'Instrument Sans', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
