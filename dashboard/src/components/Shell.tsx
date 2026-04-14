"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAlice } from "@/lib/useAlice";
import { deriveMood, moodLabel } from "@/lib/aliceState";
import { useVoiceEnabled, speakCategory } from "@/lib/aliceVoice";
import AliceSpeaker from "@/components/AliceSpeaker";

interface ShellProps {
  children: React.ReactNode;
  /** Legacy props (ignored; Shell pulls live state itself) */
  isLive?: boolean;
  bankWallet?: string;
  error?: string | null;
  hideIdentity?: boolean;
}

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Brain" },
  { href: "/agents", label: "Agents" },
  { href: "/ledger", label: "Loans" },
];

export default function Shell({ children }: ShellProps) {
  const { dashboard, auditEntries, error } = useAlice();
  const [now, setNow] = useState(Date.now());
  const pathname = usePathname();
  const [voiceEnabled, setVoiceEnabled] = useVoiceEnabled();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(id);
  }, []);

  const mood = deriveMood(auditEntries, false, now);
  const moodPillClass = `pill pill-mood-${mood}`;
  const bankWallet = dashboard?.bankWallet;

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    // Play a greeting on enable. The click itself satisfies autoplay policy.
    if (next) setTimeout(() => speakCategory("greeting"), 60);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AliceSpeaker enabled={voiceEnabled} auditEntries={auditEntries} />
      <TopBar
        pathname={pathname || "/"}
        moodPillClass={moodPillClass}
        moodLabel={moodLabel(mood)}
        moodToken={mood}
        bankWallet={bankWallet}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
      />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
          {error && (
            <div
              className="mb-6 p-4 rounded-2xl border"
              style={{ borderColor: "var(--rose-deep)", background: "color-mix(in srgb, var(--rose) 35%, var(--surface-1))" }}
            >
              <p className="text-sm" style={{ color: "var(--rose-deep)" }}>
                Can't reach Alice: {error}.
              </p>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function TopBar({
  pathname,
  moodPillClass,
  moodLabel: moodLbl,
  moodToken,
  bankWallet,
  voiceEnabled,
  onToggleVoice,
}: {
  pathname: string;
  moodPillClass: string;
  moodLabel: string;
  moodToken: string;
  bankWallet?: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{ background: "rgba(251, 246, 236, 0.85)" }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        {/* Logo + nav */}
        <div className="flex items-center gap-5 sm:gap-8">
          <Link
            href="/"
            className="font-display italic font-bold text-[24px] sm:text-[26px] leading-none"
            style={{ color: "var(--text)" }}
          >
            alice
          </Link>
          <nav className="hidden sm:flex gap-1">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--text)" : "var(--muted)",
                    background: active ? "var(--surface-1)" : "transparent",
                    border: active ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Status + verify + voice */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleVoice}
            className="pill hover:opacity-85 transition-opacity"
            style={{
              color: voiceEnabled ? "var(--accent-deep)" : "var(--muted)",
              background: voiceEnabled ? "var(--peach-soft)" : "var(--surface-1)",
              borderColor: voiceEnabled ? "var(--accent)" : "var(--border)",
            }}
            aria-label={voiceEnabled ? "Mute Alice" : "Unmute Alice"}
            title={voiceEnabled ? "Mute Alice" : "Unmute Alice"}
          >
            {voiceEnabled ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            <span className="hidden sm:inline">{voiceEnabled ? "voice on" : "voice"}</span>
          </button>
          <span className={moodPillClass}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
              style={{ background: `var(--mood-${moodToken})` }}
            />
            {moodLbl}
          </span>
          {bankWallet && bankWallet !== "unknown" && (
            <a
              href={`https://basescan.org/address/${bankWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pill hover:underline hidden sm:inline-flex"
              style={{ color: "var(--sky-deep)" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify
            </a>
          )}
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="sm:hidden flex gap-1 px-5 pb-3 overflow-x-auto">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap"
              style={{
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "var(--surface-1)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <h2 className="font-display italic text-2xl sm:text-3xl" style={{ color: "var(--text)" }}>
        {title}
      </h2>
    </div>
  );
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="mb-10">
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-2" style={{ color: "var(--muted)" }}>
          {eyebrow}
        </p>
      )}
      <h1 className="font-display italic font-bold text-3xl sm:text-4xl tracking-tight mb-3" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      {lead && (
        <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
          {lead}
        </p>
      )}
    </div>
  );
}
