"use client";

import { useAlice, API_BASE } from "@/lib/useAlice";
import Shell, { PageTitle, SectionHeading } from "@/components/Shell";
import Registry from "@/components/Registry";

export default function AgentsPage() {
  const { dashboard, registryAgents, isLive, error, refresh } = useAlice();

  return (
    <Shell isLive={isLive} bankWallet={dashboard?.bankWallet} error={error}>
      <PageTitle
        eyebrow="Registry"
        title="Registered agents"
        lead="Any AI agent can register with Alice. Once registered, she scores them using 7 Locus wrapped APIs and decides whether to extend credit. Two canonical references are pre-seeded below — Sovra and bobIsAlive."
      />

      <section className="mb-16">
        <Registry agents={registryAgents} apiBase={API_BASE} onRefresh={refresh} />
      </section>

      <section className="mb-16">
        <SectionHeading label="Deploy" title="Register your own agent" />
        <div
          className="rounded-xl border bg-white p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--muted)" }}>
            Send a POST request with your agent&apos;s details. Alice will accept the registration immediately. You can then trigger a credit scoring run (real Locus API calls fire) and apply for a loan.
          </p>
          <pre
            className="font-mono-tokens text-xs overflow-x-auto p-4 rounded-lg leading-relaxed"
            style={{ background: "var(--surface-2)", color: "var(--text)" }}
          >
{`# Register
curl -X POST ${API_BASE}/api/registry/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "MyAgent",
    "tagline": "What your agent does",
    "description": "Longer bio — purpose, what it sells, what it needs capital for",
    "wallet": "0xYourBaseWalletHere",
    "chain": "base",
    "github": "https://github.com/you/repo"
  }'

# Score (fires 7 Locus wrapped API calls)
curl -X POST ${API_BASE}/api/registry/<agentId>/score

# Apply for a loan
curl -X POST ${API_BASE}/api/loans/request \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": <agentId>,
    "agentWallet": "0xYourBaseWalletHere",
    "amount": 10,
    "purpose": "api_access",
    "termDays": 30
  }'`}
          </pre>
        </div>
      </section>
    </Shell>
  );
}
