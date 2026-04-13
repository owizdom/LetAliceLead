"use client";

import { useState } from "react";

interface DemoButtonProps {
  apiBase: string;
}

export default function DemoButton({ apiBase }: DemoButtonProps) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleRunDemo() {
    setRunning(true);
    setStatus("Running demo agents...");

    try {
      const res = await fetch(`${apiBase}/api/demo/run`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setStatus(`Demo complete: ${data.results?.length || 0} agents processed`);
      } else {
        setStatus(data.error || "Demo failed");
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setRunning(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRunDemo}
        disabled={running}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          running
            ? "bg-[#1E293B] text-[#94A3B8] cursor-not-allowed"
            : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white cursor-pointer"
        }`}
      >
        {running ? "Running..." : "Run Demo"}
      </button>
      {status && (
        <span className="text-xs text-[#94A3B8]">{status}</span>
      )}
    </div>
  );
}
