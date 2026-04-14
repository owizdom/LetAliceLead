"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface ShellProps {
  children: React.ReactNode;
  isLive: boolean;
  bankWallet?: string;
  error?: string | null;
}

export default function Shell({ children, isLive, bankWallet, error }: ShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header isLive={isLive} bankWallet={bankWallet} />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-14">
          {error && (
            <div
              className="mb-8 p-4 rounded-lg border"
              style={{ borderColor: "var(--danger)", background: "#FDF2F0" }}
            >
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                Cannot reach Alice: {error}. Start the backend with{" "}
                <code
                  className="font-mono-tokens px-1.5 py-0.5 rounded text-xs"
                  style={{ background: "var(--surface-2)" }}
                >
                  cd alice &amp;&amp; npm run dev
                </code>
              </p>
            </div>
          )}
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <h2 className="font-serif-display text-2xl tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
    </div>
  );
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="mb-12">
      {eyebrow && (
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
          {eyebrow}
        </p>
      )}
      <h1
        className="font-serif-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h1>
      {lead && (
        <p className="text-base max-w-2xl leading-relaxed" style={{ color: "var(--muted)" }}>
          {lead}
        </p>
      )}
    </div>
  );
}
