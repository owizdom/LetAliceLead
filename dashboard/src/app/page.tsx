"use client";

import { useEffect, useState } from "react";
import { useAlice } from "@/lib/useAlice";
import { deriveMood } from "@/lib/aliceState";
import Shell from "@/components/Shell";
import AliceFace from "@/components/AliceFace";
import AliceRunner from "@/components/AliceRunner";
import AliceMonologue from "@/components/AliceMonologue";

export default function BrainPage() {
  const { dashboard, auditEntries, registryAgents } = useAlice();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mood = deriveMood(auditEntries, false, now);

  return (
    <Shell>
      <AliceFace mood={mood} auditEntries={auditEntries} />
      <AliceRunner
        agents={registryAgents}
        monologue={dashboard?.latestMonologue?.text}
        procurement={dashboard?.procurement}
      />
      <AliceMonologue
        text={dashboard?.latestMonologue?.text}
        agentName={dashboard?.latestMonologue?.agentName}
        timestamp={dashboard?.latestMonologue?.timestamp}
      />
    </Shell>
  );
}
