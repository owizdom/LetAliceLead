"use client";

import { useEffect, useRef, useState } from "react";
import { PriceTicker as TickerData } from "@/lib/api";

interface PriceTickerProps {
  ticker?: TickerData;
}

function useSmoothNumber(target: number, speed = 0.16): number {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => { ref.current = target; }, [target]);
  useEffect(() => {
    let raf: number;
    const tick = () => {
      setVal((p) => {
        const diff = ref.current - p;
        if (Math.abs(diff) < 0.0001) return ref.current;
        return p + diff * speed;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return val;
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatChange(pct: number | null): { text: string; sign: 'up' | 'down' | 'flat' } {
  if (pct == null || !Number.isFinite(pct)) return { text: "—", sign: 'flat' };
  const sign = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
  const text = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  return { text, sign };
}

function formatCountdown(unixSec: number | null, now: number): string {
  if (!unixSec) return "—";
  const remainMs = unixSec * 1000 - now;
  if (remainMs <= 0) return "settling…";
  const m = Math.floor(remainMs / 60_000);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return `${Math.floor(remainMs / 1000)}s`;
}

/**
 * Three-stream live ticker: STRK · ETH (Locus CoinGecko) + Sovra auction.
 * Renders the cross-chain dimension visually before any loan data shows.
 */
export default function PriceTicker({ ticker }: PriceTickerProps) {
  const now = useNow(1000);
  const strk = ticker?.strkUsd ?? 0;
  const eth = ticker?.ethUsd ?? 0;
  const sovra = ticker?.sovraTopBidUsdc ?? 0;
  const animStrk = useSmoothNumber(strk);
  const animEth = useSmoothNumber(eth);
  const animSovra = useSmoothNumber(sovra);

  const strkChange = formatChange(ticker?.strkChange24h ?? null);
  const ethChange = formatChange(ticker?.ethChange24h ?? null);
  const settleIn = formatCountdown(ticker?.sovraNextSettleAt ?? null, now);

  const colorFor = (sign: 'up' | 'down' | 'flat') =>
    sign === 'up' ? 'var(--mint-deep)' : sign === 'down' ? 'var(--rose-deep)' : 'var(--muted)';

  return (
    <div
      className="mb-6 px-5 py-3 rounded-2xl border flex items-center gap-2 sm:gap-4 overflow-x-auto"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface-1)",
        boxShadow: "0 4px 14px rgba(184,90,61,0.06)",
      }}
    >
      {/* Live dot */}
      <span
        className="hidden sm:inline-block w-1.5 h-1.5 rounded-full pulse-dot shrink-0"
        style={{ background: "var(--accent)" }}
      />

      {/* STRK */}
      <Stream
        label="STRK"
        chain="Starknet"
        price={animStrk}
        decimals={4}
        change={strkChange}
        colorAccent="var(--sky-deep)"
      />
      <Divider />

      {/* ETH */}
      <Stream
        label="ETH"
        chain="Base"
        price={animEth}
        decimals={2}
        change={ethChange}
        colorAccent="var(--accent-deep)"
      />
      <Divider />

      {/* Sovra auction */}
      <div className="flex items-baseline gap-2 shrink-0">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.18em] font-semibold leading-none" style={{ color: "var(--muted)" }}>
            Sovra · auction
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className="font-display italic font-bold text-lg sm:text-xl tabular-nums leading-none"
              style={{ color: "var(--accent)" }}
            >
              ${animSovra.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono-tokens" style={{ color: "var(--muted)" }}>
              top bid · {ticker?.sovraBidCount ?? 0} bid{ticker?.sovraBidCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <span
          className="text-[10px] font-mono-tokens uppercase tracking-wider whitespace-nowrap shrink-0"
          style={{ color: colorFor('flat') }}
        >
          settles {settleIn}
        </span>
      </div>
    </div>
  );
}

function Stream({
  label,
  chain,
  price,
  decimals,
  change,
  colorAccent,
}: {
  label: string;
  chain: string;
  price: number;
  decimals: number;
  change: { text: string; sign: 'up' | 'down' | 'flat' };
  colorAccent: string;
}) {
  const changeColor =
    change.sign === 'up' ? 'var(--mint-deep)' : change.sign === 'down' ? 'var(--rose-deep)' : 'var(--muted)';
  return (
    <div className="flex flex-col shrink-0">
      <span className="text-[9px] uppercase tracking-[0.18em] font-semibold leading-none" style={{ color: "var(--muted)" }}>
        {label} · {chain}
      </span>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className="font-display italic font-bold text-lg sm:text-xl tabular-nums leading-none"
          style={{ color: colorAccent }}
        >
          ${price.toFixed(decimals)}
        </span>
        <span className="text-[10px] font-mono-tokens tabular-nums" style={{ color: changeColor }}>
          {change.text}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <span
      className="hidden sm:block w-px h-8 shrink-0"
      style={{ background: "var(--border)" }}
    />
  );
}
