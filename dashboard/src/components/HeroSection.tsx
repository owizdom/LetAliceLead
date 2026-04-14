"use client";

import { useEffect, useRef, useState } from "react";
import { formatUSD } from "@/lib/api";

interface HeroSectionProps {
  totalYield: number;
  totalReserves: number;
}

export default function HeroSection({ totalYield, totalReserves }: HeroSectionProps) {
  const [display, setDisplay] = useState(totalYield);
  const target = useRef(totalYield);

  useEffect(() => {
    target.current = totalYield;
  }, [totalYield]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setDisplay((prev) => {
        const diff = target.current - prev;
        if (Math.abs(diff) < 0.0001) return target.current;
        return prev + diff * 0.08;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="mb-16 sm:mb-20">
      <h1
        className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-semibold mb-6 leading-[1.05] tracking-tight"
        style={{ color: "var(--text)" }}
      >
        Credit &amp; procurement
        <br />
        infrastructure for
        <br />
        <span style={{ color: "var(--accent)" }}>AI agents.</span>
      </h1>
      <p className="text-lg max-w-2xl mb-10 leading-relaxed" style={{ color: "var(--muted)" }}>
        Alice procures creditworthiness data from <span style={{ color: "var(--text)" }}>7 Locus wrapped APIs</span> and
        issues USDC credit lines to registered agents on Base. Every credit decision is 7 paid agent-to-agent API calls.
        No humans in the loop.
      </p>

      <div className="grid grid-cols-2 gap-6 sm:gap-10 max-w-2xl">
        <div>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
            Yield earned
          </p>
          <p className="font-mono-tokens text-3xl sm:text-4xl tabular-nums" style={{ color: "var(--accent)" }}>
            {formatUSD(display)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
            Reserve
          </p>
          <p className="font-mono-tokens text-3xl sm:text-4xl tabular-nums" style={{ color: "var(--text)" }}>
            {formatUSD(totalReserves)}
          </p>
        </div>
      </div>
    </section>
  );
}
