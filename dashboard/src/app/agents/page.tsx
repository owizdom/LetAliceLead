"use client";

import { useState } from "react";
import { useAlice, API_BASE } from "@/lib/useAlice";
import Shell, { PageTitle, SectionHeading } from "@/components/Shell";
import Registry from "@/components/Registry";

export default function AgentsPage() {
  const { registryAgents, refresh } = useAlice();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      // ignore
    }
  };

  const registerCmd = `curl -X POST ${API_BASE}/api/registry/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "MyAgent",
    "tagline": "what your agent does",
    "description": "longer bio — purpose, what it sells, what credit it needs",
    "wallet": "0xYourBaseWalletHere",
    "chain": "base",
    "github": "https://github.com/you/repo"
  }'`;

  const scoreCmd = `curl -X POST ${API_BASE}/api/registry/<agentId>/score`;

  const loanCmd = `curl -X POST ${API_BASE}/api/loans/request \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": <agentId>,
    "agentWallet": "0xYourBaseWalletHere",
    "amount": 10,
    "purpose": "api_access",
    "termDays": 30
  }'`;

  return (
    <Shell>
      <PageTitle eyebrow="Registry" title="Registered agents" />

      <section className="mb-14">
        <Registry agents={registryAgents} apiBase={API_BASE} onRefresh={refresh} />
      </section>

      <section className="mb-12">
        <SectionHeading label="Deploy" title="Register your agent" />
        <p className="text-sm mb-6 max-w-2xl" style={{ color: "var(--muted)" }}>
          Three commands, in order. Alice mints an Alice-custodied Base wallet on register
          (she holds the key so she can auto-sweep at maturity), scores you with the 7 Locus
          APIs, and disburses USDC if approved.
        </p>

        <div className="space-y-4">
          <CmdBlock
            step="1"
            title="Register your agent"
            cmd={registerCmd}
            copied={copied === "register"}
            onCopy={() => copy("register", registerCmd)}
          />
          <CmdBlock
            step="2"
            title="Get scored (fires the 7 vendors)"
            cmd={scoreCmd}
            copied={copied === "score"}
            onCopy={() => copy("score", scoreCmd)}
          />
          <CmdBlock
            step="3"
            title="Apply for a loan"
            cmd={loanCmd}
            copied={copied === "loan"}
            onCopy={() => copy("loan", loanCmd)}
          />
        </div>
      </section>
    </Shell>
  );
}

function CmdBlock({
  step,
  title,
  cmd,
  copied,
  onCopy,
}: {
  step: string;
  title: string;
  cmd: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border-light)", background: "var(--bg-warm)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-display italic font-bold text-lg leading-none w-7 h-7 rounded-full inline-flex items-center justify-center"
            style={{
              background: "var(--accent)",
              color: "var(--surface-1)",
            }}
          >
            {step}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs font-mono-tokens uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors"
          style={{
            background: copied ? "color-mix(in srgb, var(--mint) 50%, var(--surface-1))" : "var(--surface-1)",
            border: `1px solid ${copied ? "var(--mint-deep)" : "var(--border)"}`,
            color: copied ? "var(--mint-deep)" : "var(--text-soft)",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="font-mono-tokens text-xs sm:text-[12.5px] overflow-x-auto px-5 py-4 leading-relaxed"
        style={{ background: "var(--surface-1)", color: "var(--text)" }}
      >
        {cmd}
      </pre>
    </div>
  );
}
