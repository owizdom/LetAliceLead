"use client";

import { useEffect, useRef } from "react";
import { AuditEntry } from "@/lib/api";
import { useAliceVoice } from "@/lib/aliceVoice";

interface AliceSpeakerProps {
  enabled: boolean;
  auditEntries: AuditEntry[];
}

/**
 * Watches audit for new `agent_loop.tick.action` events and plays a random
 * pre-recorded ElevenLabs clip matching the tool Alice invoked.
 */
export default function AliceSpeaker({ enabled, auditEntries }: AliceSpeakerProps) {
  const speak = useAliceVoice(enabled);
  const lastTsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const action = auditEntries.find((e) => e.action === "agent_loop.tick.action");
    if (!action) return;
    if (action.timestamp <= lastTsRef.current) return;
    lastTsRef.current = action.timestamp;

    const data = action.data as { tool?: string };
    const tool = String(data.tool || "");
    if (tool) speak(tool);
  }, [auditEntries, enabled, speak]);

  return null;
}
