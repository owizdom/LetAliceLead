import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LetAliceLead — The Central Bank for AI Agents",
  description: "Alice runs an AI lending business. You keep the profits. Powered by PayWithLocus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
