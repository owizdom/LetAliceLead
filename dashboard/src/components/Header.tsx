"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  isLive: boolean;
  bankWallet?: string;
}

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/ledger", label: "Ledger" },
  { href: "/policy", label: "Policy" },
  { href: "/about", label: "About" },
];

export default function Header({ isLive, bankWallet }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header
      className="border-b sticky top-0 z-50 backdrop-blur-md"
      style={{ borderColor: "var(--border)", background: "rgba(250, 249, 247, 0.9)" }}
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/"
            className="font-serif-display font-semibold tracking-tight text-lg"
            style={{ color: "var(--text)" }}
          >
            LetAliceLead
          </Link>
          <nav className="hidden md:flex gap-0.5 text-sm">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    color: active ? "var(--text)" : "var(--muted)",
                    background: active ? "var(--surface-2)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          {isLive && (
            <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ background: "var(--success)" }}
              />
              Live
            </div>
          )}

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
        </div>
      </div>
    </header>
  );
}
