"use client";

import { Loan, weiToUSDC, formatUSD } from "@/lib/api";

interface LoansTableProps {
  loans: Loan[];
}

function statusColor(status: string): string {
  switch (status) {
    case "ACTIVE": return "#10B981";
    case "REPAYING": return "#34D399";
    case "COMPLETED": return "#8B5CF6";
    case "DEFAULTED": return "#EF4444";
    case "REJECTED": return "#94A3B8";
    default: return "#94A3B8";
  }
}

export default function LoansTable({ loans }: LoansTableProps) {
  const sorted = [...loans].sort((a, b) => b.originatedAt - a.originatedAt);

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
      <h3 className="text-sm uppercase tracking-wider text-[#94A3B8] mb-3">
        Loan Book ({loans.length})
      </h3>

      {sorted.length === 0 ? (
        <p className="text-[#94A3B8] text-sm italic">No loans yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#64748B] text-xs uppercase tracking-wider border-b border-[#1E293B]">
                <th className="text-left py-2 pr-3">Borrower</th>
                <th className="text-right py-2 px-3">Principal</th>
                <th className="text-right py-2 px-3">APR</th>
                <th className="text-right py-2 px-3">Score</th>
                <th className="text-center py-2 px-3">Status</th>
                <th className="text-right py-2 pl-3">Repaid</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((loan) => {
                const principal = weiToUSDC(loan.terms.principalAmount);
                const repaid = weiToUSDC(loan.amountRepaid);
                const total = weiToUSDC(loan.terms.totalRepayment);
                const progress = total > 0 ? (repaid / total) * 100 : 0;
                const color = statusColor(loan.status);

                return (
                  <tr key={loan.id} className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/30">
                    <td className="py-2 pr-3">
                      <span className="text-[#F1F5F9]">Agent #{loan.borrowerAgentId}</span>
                      <br />
                      <span className="text-[#64748B] text-xs font-mono">
                        {loan.borrowerWallet.slice(0, 6)}...{loan.borrowerWallet.slice(-4)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatUSD(principal)}
                    </td>
                    <td className="text-right py-2 px-3 tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "#34D399" }}>
                      {loan.terms.interestRateAPR}%
                    </td>
                    <td className="text-right py-2 px-3 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                      {loan.terms.creditScoreAtOrigination}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ backgroundColor: color + "20", color }}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="text-right py-2 pl-3">
                      <div className="w-full bg-[#1E293B] rounded-full h-1.5 mb-1">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs text-[#94A3B8] tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {formatUSD(repaid)} / {formatUSD(total)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
