"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuditEntry } from "@/lib/api";
import { Mood, moodLabel } from "@/lib/aliceState";

interface AliceFaceProps {
  mood: Mood;
  auditEntries: AuditEntry[];
}

const VENDOR_KEYS = ["exa", "firecrawl", "brave", "perplexity", "tavily", "coingecko", "alphavantage"];

export default function AliceFace({ mood, auditEntries }: AliceFaceProps) {
  const [sparkles, setSparkles] = useState<{ id: number; tx: number; ty: number }[]>([]);
  const seenVendor = useRef<Record<string, number>>({});
  const sparkleId = useRef(0);

  // Detect new vendor.called events → emit sparkle off Alice's face
  useEffect(() => {
    const newSparkles: { id: number; tx: number; ty: number }[] = [];
    for (const key of VENDOR_KEYS) {
      const ts = auditEntries.find((e) => e.action === `locus.api.${key}.called`)?.timestamp ?? 0;
      const last = seenVendor.current[key] ?? 0;
      if (ts > last) {
        seenVendor.current[key] = ts;
        newSparkles.push({
          id: ++sparkleId.current,
          tx: (Math.random() - 0.5) * 180,
          ty: -60 - Math.random() * 80,
        });
      }
    }
    if (newSparkles.length) {
      setSparkles((prev) => [...prev, ...newSparkles].slice(-12));
    }
  }, [auditEntries]);

  const faceClass = `alice-face ${mood}`;

  return (
    <section className="relative pt-6 sm:pt-10">
      {/* Status headline */}
      <div className="text-center mb-8 sm:mb-10">
        <AnimatePresence mode="wait">
          <motion.h2
            key={mood}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-display italic font-bold text-[40px] sm:text-[56px] leading-[1] tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Alice is{" "}
            <span style={{ color: `var(--mood-${mood})` }}>
              {moodLabel(mood).replace("…", "")}
              {mood === "thinking" && <AnimatedDots />}
            </span>
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* The face */}
      <div className="relative flex items-center justify-center mb-10 sm:mb-12">
        <div className="relative float-bob">
          <div className={faceClass}>
            {/* eyes */}
            <div className="alice-eye left blink" />
            <div className="alice-eye right blink blink-delay" />
            {/* cheeks */}
            <div className="alice-cheek left" />
            <div className="alice-cheek right" />
            {/* mouth */}
            <div className={`alice-mouth ${mood === "paused" ? "paused" : ""}`} />
          </div>

          {/* sparkles that fly off on vendor calls */}
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="absolute text-2xl"
              style={{
                left: "50%",
                top: "40%",
                ["--tx" as string]: `${s.tx}px`,
                ["--ty" as string]: `${s.ty}px`,
                animation: "sparkle-fly 1.6s ease-out forwards",
              }}
              onAnimationEnd={() => {
                setSparkles((prev) => prev.filter((x) => x.id !== s.id));
              }}
            >
              ✦
            </span>
          ))}
        </div>
      </div>

    </section>
  );
}

/**
 * Three dots that fade in sequence — classic "thinking…" indicator.
 */
function AnimatedDots() {
  return (
    <span className="inline-block ml-2 align-baseline">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-full mx-0.5 pulse-dot"
          style={{
            background: "currentColor",
            animationDelay: `${i * 0.25}s`,
          }}
        />
      ))}
    </span>
  );
}
