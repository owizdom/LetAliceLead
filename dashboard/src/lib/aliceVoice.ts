"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "alice-voice-enabled";
const MIN_GAP_MS = 3500;

// Manifest matches scripts/generate-voice.mjs output. Files live in /public/voice/.
const VOICE_FILES: Record<string, string[]> = {
  greeting: ["greeting-00.mp3", "greeting-01.mp3", "greeting-02.mp3"],
  rescore_agent: [
    "rescore_agent-00.mp3",
    "rescore_agent-01.mp3",
    "rescore_agent-02.mp3",
    "rescore_agent-03.mp3",
    "rescore_agent-04.mp3",
    "rescore_agent-05.mp3",
  ],
  adjust_rate: [
    "adjust_rate-00.mp3",
    "adjust_rate-01.mp3",
    "adjust_rate-02.mp3",
    "adjust_rate-03.mp3",
    "adjust_rate-04.mp3",
  ],
  pause_lending: [
    "pause_lending-00.mp3",
    "pause_lending-01.mp3",
    "pause_lending-02.mp3",
    "pause_lending-03.mp3",
  ],
  resume_lending: [
    "resume_lending-00.mp3",
    "resume_lending-01.mp3",
    "resume_lending-02.mp3",
    "resume_lending-03.mp3",
  ],
  note: ["note-00.mp3", "note-01.mp3", "note-02.mp3", "note-03.mp3"],
  wait: [
    "wait-00.mp3",
    "wait-01.mp3",
    "wait-02.mp3",
    "wait-03.mp3",
    "wait-04.mp3",
    "wait-05.mp3",
    "wait-06.mp3",
  ],
};

const VOICE_BASE = "/voice/";

// Keep a single <Audio> element that we swap src on — cheap and avoids preload of 33 files
let currentAudio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

function playFile(file: string, volume = 0.9): void {
  if (typeof window === "undefined") return;
  if (typeof document !== "undefined" && document.hidden) return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;

  // Stop anything currently playing
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const audio = new Audio(`${VOICE_BASE}${file}`);
  audio.volume = volume;
  audio.play().catch((err) => {
    // Autoplay policies can reject without user gesture; swallow quietly
    if (process.env.NODE_ENV === "development") {
      console.debug("[aliceVoice] play blocked:", err?.message || err);
    }
  });
  currentAudio = audio;
}

export function useVoiceEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabledState] = useState(false);
  useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!v && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }, []);
  return [enabled, setEnabled];
}

/**
 * Hook returning a `speak(category)` that plays a random clip from that category.
 * Respects enabled flag, tab visibility, and a 3.5s rate limit.
 */
export function useAliceVoice(enabled: boolean) {
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const play = useCallback((category: keyof typeof VOICE_FILES | string) => {
    if (!enabledRef.current) return;
    const pool = VOICE_FILES[category];
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random() * pool.length)];
    playFile(file);
  }, []);

  return play;
}

/**
 * Categories map 1:1 with Alice's tool names, plus `greeting` for the initial
 * toggle-on moment.
 */
export function speakCategory(category: string) {
  if (!VOICE_FILES[category]) return;
  const file = VOICE_FILES[category][Math.floor(Math.random() * VOICE_FILES[category].length)];
  playFile(file);
}
