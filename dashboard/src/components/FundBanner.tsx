"use client";

import { useState } from "react";

interface FundBannerProps {
  bankWallet?: string;
  reserves: number;
}

const COPY_TIMEOUT_MS = 1500;

export default function FundBanner({ bankWallet, reserves }: FundBannerProps) {
  const [copied, setCopied] = useState(false);

  // Only show if wallet is empty
  if (reserves > 0) return null;
  if (!bankWallet || bankWallet === "unknown") return null;

  async function copyAddress() {
    if (!bankWallet) return;
    try {
      await navigator.clipboard.writeText(bankWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="mb-12 p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 justify-between"
      style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
    >
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
          Alice&apos;s wallet is empty
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
          Send USDC on <span className="font-medium">Base</span> to Alice&apos;s wallet to enable real on-chain lending.
          Until funded, loans are recorded but USDC transfers do not fire.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <code
          className="font-mono-tokens text-xs px-3 py-1.5 rounded-md"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          {bankWallet.slice(0, 8)}…{bankWallet.slice(-6)}
        </code>
        <button
          onClick={copyAddress}
          className="text-xs font-medium px-3 py-1.5 rounded-md transition-all"
          style={{
            background: copied ? "var(--success)" : "var(--text)",
            color: "var(--bg)",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`https://basescan.org/address/${bankWallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium px-3 py-1.5 rounded-md"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          BaseScan ↗
        </a>
      </div>
    </div>
  );
}
