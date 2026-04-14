"use client";

import { Loan, CollateralPledge, weiToUSDC, formatUSD } from "@/lib/api";

interface LoansTableProps {
  loans: Loan[];
}

const CHAIN_ICON: Record<string, string> = {
  starknet: "▲",
  ethereum: "◆",
  base: "■",
  other: "●",
};

function healthStyle(h: CollateralPledge['health']): { bg: string; fg: string; label: string } {
  switch (h) {
    case 'healthy':
      return { bg: 'color-mix(in srgb, var(--mint) 35%, var(--surface-1))', fg: 'var(--mint-deep)', label: 'healthy' };
    case 'warn':
      return { bg: 'var(--peach-soft)', fg: 'var(--accent-deep)', label: 'warn' };
    case 'margin_call':
      return { bg: 'color-mix(in srgb, var(--rose) 45%, var(--surface-1))', fg: 'var(--rose-deep)', label: 'margin call' };
  }
}

function statusStyle(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "ACTIVE":
    case "REPAYING":
      return { bg: "var(--accent-soft)", fg: "var(--accent)", label: "Active" };
    case "COMPLETED":
      return { bg: "#EDF4E3", fg: "var(--success)", label: "Repaid" };
    case "DEFAULTED":
      return { bg: "#FDF2F0", fg: "var(--danger)", label: "Default" };
    case "REJECTED":
      return { bg: "var(--surface-2)", fg: "var(--muted)", label: "Rejected" };
    default:
      return { bg: "var(--surface-2)", fg: "var(--muted)", label: status };
  }
}

export default function LoansTable({ loans }: LoansTableProps) {
  const sorted = [...loans].sort((a, b) => b.originatedAt - a.originatedAt);

  if (sorted.length === 0) {
    return (
      <div
        className="rounded-xl border bg-white p-12 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="font-serif-display text-lg mb-2" style={{ color: "var(--text)" }}>
          No loans yet
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Alice hasn&apos;t issued any loans. Run the demo to see her in action.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Borrower
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Principal
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                APR
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Score
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Collateral
              </th>
              <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                LTV
              </th>
              <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Status
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Repaid
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((loan, i) => {
              const principal = weiToUSDC(loan.terms.principalAmount);
              const repaid = weiToUSDC(loan.amountRepaid);
              const total = weiToUSDC(loan.terms.totalRepayment);
              const progress = total > 0 ? (repaid / total) * 100 : 0;
              const { bg, fg, label } = statusStyle(loan.status);

              return (
                <tr
                  key={loan.id}
                  className={i !== sorted.length - 1 ? "border-b" : ""}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-medium" style={{ color: "var(--text)" }}>
                        Agent #{loan.borrowerAgentId}
                      </div>
                      {loan.txHash && (
                        <a
                          href={`https://basescan.org/tx/${loan.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full hover:opacity-85 transition-opacity"
                          style={{
                            color: "var(--sky-deep)",
                            background: "color-mix(in srgb, var(--sky) 45%, var(--surface-1))",
                            border: "1px solid var(--sky-deep)",
                          }}
                          title="Verify disbursement on BaseScan"
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          BaseScan
                        </a>
                      )}
                    </div>
                    <div className="font-mono-tokens text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {loan.borrowerWallet.slice(0, 8)}…{loan.borrowerWallet.slice(-6)}
                      {loan.txHash && (
                        <>
                          {" · tx "}
                          <a
                            href={`https://basescan.org/tx/${loan.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            style={{ color: "var(--sky-deep)" }}
                          >
                            {loan.txHash.slice(0, 8)}…{loan.txHash.slice(-6)}
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono-tokens tabular-nums" style={{ color: "var(--text)" }}>
                    {formatUSD(principal)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono-tokens tabular-nums" style={{ color: "var(--accent)" }}>
                    {loan.terms.interestRateAPR}%
                  </td>
                  <td className="px-5 py-4 text-right font-mono-tokens tabular-nums" style={{ color: "var(--text)" }}>
                    {loan.terms.creditScoreAtOrigination}
                  </td>
                  <td className="px-5 py-4">
                    {loan.collateral ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                          }}
                          title={loan.collateral.chain}
                        >
                          {CHAIN_ICON[loan.collateral.chain] || '●'}
                        </span>
                        <div>
                          <div className="font-mono-tokens text-xs tabular-nums leading-tight" style={{ color: 'var(--text)' }}>
                            {loan.collateral.amount.toFixed(2)} {loan.collateral.asset}
                          </div>
                          <div className="font-mono-tokens text-[10px] tabular-nums leading-tight" style={{ color: 'var(--muted)' }}>
                            ≈ ${loan.collateral.pricedUsdc.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {loan.collateral ? (
                      (() => {
                        const h = healthStyle(loan.collateral.health);
                        return (
                          <span
                            className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                            style={{ background: h.bg, color: h.fg, border: `1px solid ${h.fg}33` }}
                            title={`${loan.collateral.ltvPct.toFixed(1)}% LTV · ${h.label}`}
                          >
                            {loan.collateral.ltvPct.toFixed(0)}%
                          </span>
                        );
                      })()
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: bg, color: fg }}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-right font-mono-tokens text-xs tabular-nums mb-1" style={{ color: "var(--muted)" }}>
                      {formatUSD(repaid)} / {formatUSD(total)}
                    </div>
                    <div
                      className="h-1 rounded-full overflow-hidden ml-auto"
                      style={{ background: "var(--surface-3)", width: "100%" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%`, background: fg }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
