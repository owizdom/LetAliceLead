"use client";

import { useEffect, useRef, useState } from "react";
import { formatUSD } from "@/lib/api";

interface HeroYieldProps {
  totalYield: number;
  isLive: boolean;
}

export default function HeroYield({ totalYield, isLive }: HeroYieldProps) {
  const [displayValue, setDisplayValue] = useState(totalYield);
  const targetRef = useRef(totalYield);

  useEffect(() => {
    targetRef.current = totalYield;
  }, [totalYield]);

  // Animate toward target
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setDisplayValue((prev) => {
        const diff = targetRef.current - prev;
        if (Math.abs(diff) < 0.001) return targetRef.current;
        return prev + diff * 0.08;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="text-center py-8">
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isLive ? "bg-[#34D399] pulse-dot" : "bg-[#94A3B8]"}`} />
        <span className="text-xs uppercase tracking-widest text-[#94A3B8]">
          {isLive ? "Live" : "Connecting..."} — Total Yield Earned
        </span>
      </div>
      <div
        className="text-6xl font-bold tabular-nums yield-glow"
        style={{ color: "#34D399", fontFamily: "var(--font-mono)" }}
      >
        {formatUSD(displayValue)}
      </div>
      <p className="text-[#94A3B8] text-sm mt-3">
        Alice runs your AI lending business. You keep the profits.
      </p>
    </div>
  );
}
