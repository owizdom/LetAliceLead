"use client";

import { useEffect, useState } from "react";
import { fetchVerifiedDisbursements, VerifiedDisbursement, Dashboard, Loan } from "@/lib/api";

const POLL_MS = 12_000;

interface HomeProofStripProps {
  /** Optional live dashboard so we can render the cross-chain backing line */
  dashboard?: Dashboard | null;
}

function summarizeCollateral(loans: Loan[]): { strk: number; pricedUsd: number } {
  let strk = 0;
  let pricedUsd = 0;
  for (const l of loans) {
    if (l.collateral?.asset === 'STRK') strk += l.collateral.amount;
    pricedUsd += l.collateral?.pricedUsdc || 0;
  }
  return { strk, pricedUsd };
}

/**
 * Two-line credibility strip for the Brain home page. Top: real USDC moved
 * on Base with a BaseScan link. Bottom: cross-chain backing summary so
 * visitors see Alice reads Starknet + settles Base in the first second.
 */
export default function HomeProofStrip({ dashboard }: HomeProofStripProps) {
  const [list, setList] = useState<VerifiedDisbursement[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetchVerifiedDisbursements();
        if (!stop) setList(r.disbursements);
      } catch {
        /* keep last value on transient failure */
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, []);

  if (list.length === 0 && !dashboard?.crossChainCollateralUsd) return null;

  const totalDisbursed = list.reduce((s, d) => s + d.amountUsdc, 0);
  const latest = list[0];

  const activeLoans = dashboard?.portfolio?.activeLoans ?? [];
  const { strk } = summarizeCollateral(activeLoans);
  const collateralUsd = dashboard?.crossChainCollateralUsd ?? 0;
  const showCrossChain = strk > 0 && collateralUsd > 0;

  return (
    <div className="flex flex-col items-center gap-2 mb-6 sm:mb-8 px-4">
      {list.length > 0 && (
      <a
        href={latest.basescanUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
        style={{
          background: "var(--surface-1)",
          border: "1.5px solid var(--border)",
          boxShadow: "0 4px 14px rgba(184,90,61,0.08)",
        }}
        title={`Latest disbursement: $${latest.amountUsdc.toFixed(2)} USDC — open on BaseScan`}
      >
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0"
          style={{
            background: "color-mix(in srgb, var(--mint) 45%, var(--surface-1))",
            color: "var(--mint-deep)",
            border: "1px solid var(--mint-deep)",
          }}
        >
          ✓
        </span>
        <span
          className="font-display italic font-bold tabular-nums"
          style={{ color: "var(--text)", fontSize: 18 }}
        >
          ${totalDisbursed.toFixed(2)}
        </span>
        <span
          className="text-[12px] sm:text-[13px]"
          style={{ color: "var(--text-soft)" }}
        >
          disbursed on Base
        </span>
        <span
          className="hidden sm:inline-block w-px h-4"
          style={{ background: "var(--border)" }}
        />
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono-tokens uppercase tracking-wider"
          style={{ color: "var(--sky-deep)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {list.length} on BaseScan
        </span>
      </a>
      )}

      {showCrossChain && (
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]"
          style={{
            background: "color-mix(in srgb, var(--sky) 25%, var(--surface-1))",
            border: "1px solid var(--sky-deep)",
            color: "var(--sky-deep)",
          }}
          title="Live cross-chain backing — Bob's Starknet STRK stake priced via CoinGecko, settled on Base"
        >
          <span className="font-mono-tokens uppercase tracking-wider opacity-70">
            cross-chain
          </span>
          <span style={{ color: "var(--text)" }}>
            <span className="font-mono-tokens tabular-nums font-bold">{Math.round(strk)}</span>{" "}
            STRK on Starknet backing{" "}
            <span className="font-mono-tokens tabular-nums font-bold">${collateralUsd.toFixed(2)}</span>{" "}
            of USDC loans on Base
          </span>
        </div>
      )}
    </div>
  );
}
