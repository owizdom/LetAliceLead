"use client";

import { useState } from "react";

interface HeaderProps {
  isLive: boolean;
  bankWallet?: string;
  apiBase: string;
}

export default function Header({ isLive, bankWallet, apiBase }: HeaderProps) {
  const [running, setRunning] = useState(false);

  async function handleRunDemo() {
    setRunning(true);
    try {
      await fetch(`${apiBase}/api/demo/run`, { method: "POST" });
    } catch {
      // swallow — UI will show stale state
    } finally {
      setRunning(false);
    }
  }

  return (
    <header
      className="border-b sticky top-0 z-50 backdrop-blur-md"
      style={{ borderColor: "var(--border)", background: "rgba(250, 249, 247, 0.9)" }}
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="font-serif-display font-semibold tracking-tight text-lg" style={{ color: "var(--text)" }}>
            LetAliceLead
          </a>
          <nav className="hidden md:flex gap-0.5 text-sm">
            <span className="px-3 py-1.5 rounded-md" style={{ color: "var(--muted)" }}>
              Agent Central Bank
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLive ? "pulse-dot" : ""}`}
              style={{ background: isLive ? "var(--success)" : "var(--danger)" }}
            />
            {isLive ? "Connected to Alice" : "Offline"}
          </div>

          {bankWallet && bankWallet !== "unknown" && (
            <a
              href={`https://basescan.org/address/${bankWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block font-mono-tokens text-xs hover:underline"
              style={{ color: "var(--muted)" }}
            >
              {bankWallet.slice(0, 6)}…{bankWallet.slice(-4)}
            </a>
          )}

          <button
            onClick={handleRunDemo}
            disabled={running}
            className="text-sm font-medium px-3.5 py-1.5 rounded-md transition-all disabled:opacity-50"
            style={{
              background: running ? "var(--surface-2)" : "var(--text)",
              color: running ? "var(--muted)" : "var(--bg)",
            }}
          >
            {running ? "Running…" : "Run demo"}
          </button>
        </div>
      </div>
    </header>
  );
}
