"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AliceMonologueProps {
  text?: string;
  agentName?: string;
  timestamp?: number;
}

/**
 * Speech-bubble monologue. A tail on top points up toward Alice's face.
 * Typewriter reveal on each new line.
 */
export default function AliceMonologue({ text }: AliceMonologueProps) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    setShown("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += Math.max(1, Math.ceil(text.length / 90));
      if (i >= text.length) {
        setShown(text);
        setDone(true);
        clearInterval(id);
      } else {
        setShown(text.slice(0, i));
      }
    }, 20);
    return () => clearInterval(id);
  }, [text]);

  if (!text) return null;

  return (
    <section className="max-w-2xl mx-auto px-4 mb-12 sm:mb-16">
      <div className="relative">
        {/* Tail pointing up to Alice */}
        <div
          className="absolute left-1/2 -top-3 w-5 h-5 rotate-45"
          style={{
            transform: "translateX(-50%) rotate(45deg)",
            background: "var(--surface-1)",
            border: "1.5px solid var(--border)",
            borderRight: "none",
            borderBottom: "none",
          }}
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative px-7 py-6 rounded-[28px]"
            style={{
              background: "var(--surface-1)",
              border: "1.5px solid var(--border)",
              boxShadow: "0 10px 30px rgba(184, 90, 61, 0.10), 0 2px 6px rgba(42, 36, 25, 0.04)",
            }}
          >
            <p
              className="font-display italic text-xl sm:text-2xl leading-[1.4] text-center"
              style={{ color: "var(--text)", fontWeight: 500 }}
            >
              {shown}
              {!done && (
                <span
                  className="inline-block w-[3px] align-middle pulse-dot ml-0.5"
                  style={{ height: "0.9em", background: "var(--accent)" }}
                />
              )}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
