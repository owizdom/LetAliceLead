"use client";

import { useEffect, useState } from "react";
import { fetchVerifiedDisbursements, VerifiedDisbursement } from "@/lib/api";

const POLL_MS = 12_000;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/**
 * Pulls verified loan disbursements directly from Locus's transaction history.
 * Bypasses Alice's in-memory loan state so the on-chain record is preserved
 * across restarts. Each row deep-links to BaseScan.
 */
export default function VerifiedDisbursements() {
  const [disbursements, setDisbursements] = useState<VerifiedDisbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetchVerifiedDisbursements();
        if (!stop) setDisbursements(r.disbursements);
      } catch {
        // keep last-known on transient failure
      } finally {
        if (!stop) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  if (loading) return null;
  if (disbursements.length === 0) {
    return (
      <div
        className="mb-8 px-5 py-3 rounded-2xl border text-center"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          No on-chain loan disbursements yet. The first one will appear here once it confirms on Base.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
            style={{ background: "var(--mint-deep)" }}
          />
          <h3
            className="text-[10px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: "var(--muted)" }}
          >
            Verified on BaseScan · pulled from Locus tx history
          </h3>
        </div>
        <span
          className="text-[10px] font-mono-tokens"
          style={{ color: "var(--muted)" }}
        >
          {disbursements.length} on-chain
        </span>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        {disbursements.slice(0, 5).map((d, i) => (
          <a
            key={d.id}
            href={d.basescanUrl || `https://basescan.org/address/${d.toAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-5 py-3 hover:bg-[color-mix(in_srgb,var(--peach-soft)_50%,transparent)] transition-colors"
            style={{
              borderTop: i === 0 ? undefined : "1px solid var(--border-light)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--mint) 45%, var(--surface-1))",
                  color: "var(--mint-deep)",
                  border: "1px solid var(--mint-deep)",
                }}
                title="Confirmed on Base"
              >
                ✓
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-display italic font-bold tabular-nums"
                    style={{ color: "var(--text)", fontSize: 18 }}
                  >
                    ${d.amountUsdc.toFixed(2)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    USDC → {d.toAddress.slice(0, 6)}…{d.toAddress.slice(-4)}
                  </span>
                </div>
                {d.memo && (
                  <p
                    className="text-[11px] truncate mt-0.5"
                    style={{ color: "var(--text-soft)", maxWidth: "32rem" }}
                  >
                    {d.memo}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="text-[10px] font-mono-tokens"
                style={{ color: "var(--muted)" }}
              >
                {timeAgo(d.createdAt)}
              </span>
              {d.txHash && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{
                    color: "var(--sky-deep)",
                    background: "color-mix(in srgb, var(--sky) 45%, var(--surface-1))",
                    border: "1px solid var(--sky-deep)",
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  BaseScan
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
