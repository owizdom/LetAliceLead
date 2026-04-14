"use client";

import { useEffect, useRef, useState } from "react";
import { RegisteredAgentData, ProcurementSummary } from "@/lib/api";

interface AgentRaceProps {
  agents: RegisteredAgentData[];
  /** Optional live monologue from Alice — surfaces in the speech bubble when fresh */
  monologue?: string;
  /** Live Locus procurement totals; displayed as HUD inside the stage */
  procurement?: ProcurementSummary;
}

const PALETTE: { core: string; mid: string; deep: string }[] = [
  { core: "#FFE0CF", mid: "#F4B393", deep: "#D97757" }, // peach
  { core: "#D8EFDF", mid: "#A8D0B4", deep: "#5A8A66" }, // mint
  { core: "#DDEBF6", mid: "#B5D1E5", deep: "#3F6A8A" }, // sky
  { core: "#F6CEC9", mid: "#E8A7A2", deep: "#B04B44" }, // rose
  { core: "#E5DAF1", mid: "#C9B8E0", deep: "#7B62A8" }, // lavender
  { core: "#FBEDC4", mid: "#F5DCA0", deep: "#C49A3D" }, // butter
];

// Mid-size stage — runner is supporting ambient motion but readable, not a
// thin ribbon. Face above + monologue below still carry the message.
const STAGE_HEIGHT = 180;
const GROUND_Y = 116;
const RUNNER_SIZE = 36;
const NAME_OFFSET = 20;
const OBSTACLE_W = 22;
const OBSTACLE_H = 28;
const GRAVITY = 0.55;
const JUMP_VELOCITY = 11.4;
const SPEED = 4.4;
const METERS_PER_PX = 0.05;

// PALETTE[0] (peach) is reserved for Alice. Borrower agents get mint/sky/rose/etc.
function colorForAgent(agentId: number) {
  return PALETTE[1 + (agentId % (PALETTE.length - 1))];
}

interface RunnerState {
  agentId: number;
  name: string;
  baseX: number;
  y: number;
  vy: number;
  color: { core: string; mid: string; deep: string };
  bobPhase: number; // for visual "running" tilt
  isLeader?: boolean;
}

const ALICE_RUNNER_ID = -1;

interface Obstacle {
  id: number;
  x: number;
}

interface Cloud {
  id: number;
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export default function AgentRace({ agents, monologue, procurement }: AgentRaceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(800);
  const [, setTick] = useState(0); // forces re-render at 60fps
  const [meters, setMeters] = useState(0);
  const [bestMeters, setBestMeters] = useState(0);
  const bestMetersRef = useRef(0);

  // Runner state held in refs so the loop stays stable
  const runnersRef = useRef<RunnerState[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const obstacleIdRef = useRef(0);
  const cloudIdRef = useRef(0);
  const metersRef = useRef(0);
  const nextSpawnRef = useRef(280);
  const nextCloudRef = useRef(60);
  const hillARef = useRef(0);
  const hillBRef = useRef(0);

  // Sync runners list — borrowers cluster on the left, Alice leads way ahead on the right
  useEffect(() => {
    const sorted = [...agents].sort((a, b) => a.agentId - b.agentId).slice(0, 5);
    const BORROWER_SPACING = 56;
    const LEADER_GAP = 150;

    const borrowerRunners: RunnerState[] = sorted.map((a, i) => {
      const existing = runnersRef.current.find((r) => r.agentId === a.agentId);
      return {
        agentId: a.agentId,
        name: a.name,
        baseX: 48 + i * BORROWER_SPACING,
        y: existing?.y ?? 0,
        vy: existing?.vy ?? 0,
        color: colorForAgent(a.agentId),
        bobPhase: i * 0.7,
      };
    });

    const packBackX = borrowerRunners.length
      ? borrowerRunners[borrowerRunners.length - 1].baseX
      : 48;
    const aliceExisting = runnersRef.current.find((r) => r.agentId === ALICE_RUNNER_ID);
    const alice: RunnerState = {
      agentId: ALICE_RUNNER_ID,
      name: "Alice",
      baseX: packBackX + LEADER_GAP,
      y: aliceExisting?.y ?? 0,
      vy: aliceExisting?.vy ?? 0,
      color: PALETTE[0],
      bobPhase: borrowerRunners.length * 0.7,
      isLeader: true,
    };

    runnersRef.current = [...borrowerRunners, alice];
  }, [agents]);

  // Measure stage width
  useEffect(() => {
    const measure = () => {
      if (stageRef.current) setStageW(stageRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Restore best (persisted across visits) + live meters (persisted across route nav)
  useEffect(() => {
    try {
      const best = Number(localStorage.getItem("alice-runner-best") || 0);
      if (best > 0) {
        bestMetersRef.current = best;
        setBestMeters(best);
      }
      const live = Number(sessionStorage.getItem("alice-runner-meters") || 0);
      if (live > 0) {
        metersRef.current = live;
        setMeters(Math.floor(live));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // No canned-quip rotation — Alice's real monologue is shown by the
  // dedicated AliceMonologue component on the page. The runner here is
  // ambient motion only.

  // Game loop
  useEffect(() => {
    let raf = 0;
    let lastFrame = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(2, (t - lastFrame) / 16.67);
      lastFrame = t;

      // Move obstacles
      const moved = obstaclesRef.current
        .map((o) => ({ ...o, x: o.x - SPEED * dt }))
        .filter((o) => o.x + OBSTACLE_W > -30);

      nextSpawnRef.current -= SPEED * dt;
      if (nextSpawnRef.current <= 0) {
        moved.push({ id: ++obstacleIdRef.current, x: stageW + 60 });
        nextSpawnRef.current = 240 + Math.random() * 280;
      }
      obstaclesRef.current = moved;

      // Update each runner
      for (const r of runnersRef.current) {
        // Gravity
        r.vy -= GRAVITY * dt;
        r.y += r.vy * dt;
        if (r.y <= 0) {
          r.y = 0;
          r.vy = 0;
        }
        // Auto-jump when an obstacle is close to THIS runner's x
        if (r.y <= 0.5) {
          const aliceLeft = r.baseX;
          const aliceRight = r.baseX + RUNNER_SIZE;
          for (const o of moved) {
            const dist = o.x - aliceRight;
            if (dist > 0 && dist < 110) {
              r.vy = JUMP_VELOCITY;
              break;
            }
          }
        }
        r.bobPhase += 0.18 * dt;
      }

      // Clouds
      cloudsRef.current = cloudsRef.current
        .map((c) => ({ ...c, x: c.x - c.speed * dt }))
        .filter((c) => c.x + 80 > -50);
      nextCloudRef.current -= dt;
      if (nextCloudRef.current <= 0) {
        cloudsRef.current.push({
          id: ++cloudIdRef.current,
          x: stageW + 30,
          y: 18 + Math.random() * 60,
          scale: 0.6 + Math.random() * 0.7,
          speed: 0.4 + Math.random() * 0.6,
        });
        nextCloudRef.current = 80 + Math.random() * 160;
      }

      // Parallax
      hillARef.current = (hillARef.current - SPEED * 0.18 * dt) % 600;
      hillBRef.current = (hillBRef.current - SPEED * 0.42 * dt) % 480;

      // Score
      metersRef.current += SPEED * dt * METERS_PER_PX;
      const m = Math.floor(metersRef.current);
      setMeters(m);
      if (m > bestMetersRef.current) {
        bestMetersRef.current = m;
        // Only publish to React state + storage every 25m — avoids churn
        if (m % 25 === 0) {
          setBestMeters(m);
          try { localStorage.setItem("alice-runner-best", String(m)); } catch { /* ignore */ }
        }
      }
      // Snapshot live meters to sessionStorage every ~5m so route-nav preserves it
      if (m % 5 === 0) {
        try { sessionStorage.setItem("alice-runner-meters", String(metersRef.current)); } catch { /* ignore */ }
      }

      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      // Final flush on unmount so the next mount picks up exactly where we left
      try { sessionStorage.setItem("alice-runner-meters", String(metersRef.current)); } catch { /* ignore */ }
    };
  }, [stageW]);

  void monologue; // monologue is rendered by the page-level AliceMonologue, not here
  return (
    <section className="max-w-3xl mx-auto px-4 mb-10 sm:mb-12">
      {/* Stage */}
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-[28px] select-none"
        style={{
          height: STAGE_HEIGHT,
          background:
            "linear-gradient(180deg, #FFE9D2 0%, #FBD9C4 55%, #F4C5A6 100%)",
          border: "1.5px solid var(--border)",
          boxShadow: "inset 0 -10px 30px rgba(184,90,61,0.06)",
        }}
        aria-label="Borrower agents racing autonomously"
      >
        {/* Sun */}
        <div
          className="absolute rounded-full float-bob-slow"
          style={{
            right: 36,
            top: 18,
            width: 38,
            height: 38,
            background: "radial-gradient(circle at 35% 35%, #FFF5DC, #FACC94)",
            boxShadow: "0 0 36px rgba(250, 204, 148, 0.65), 0 0 12px rgba(255, 233, 196, 0.85)",
          }}
        />

        {/* Clouds */}
        {cloudsRef.current.map((c) => (
          <Cloud key={c.id} x={c.x} y={c.y} scale={c.scale} />
        ))}

        {/* Back hills */}
        <svg
          className="absolute bottom-0 left-0 opacity-50"
          height="80"
          viewBox="0 0 1200 80"
          preserveAspectRatio="none"
          style={{ width: "200%", transform: `translateX(${hillARef.current}px)` }}
        >
          <path
            d="M0 80 L0 50 Q 100 18 200 40 T 400 35 T 600 30 T 800 38 T 1000 32 T 1200 36 L 1200 80 Z"
            fill="#E89B79"
          />
        </svg>

        {/* Front hills */}
        <svg
          className="absolute bottom-0 left-0 opacity-65"
          height="60"
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          style={{ width: "200%", transform: `translateX(${hillBRef.current}px)` }}
        >
          <path
            d="M0 60 L0 35 Q 80 8 160 28 T 320 22 T 480 28 T 640 18 T 800 26 T 960 20 T 1200 26 L 1200 60 Z"
            fill="#D97757"
          />
        </svg>

        {/* Ground */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: GROUND_Y + RUNNER_SIZE,
            bottom: 0,
            background: "linear-gradient(180deg, #C75935 0%, #A04826 100%)",
          }}
        />
        <div
          className="absolute left-0 right-0"
          style={{
            top: GROUND_Y + RUNNER_SIZE,
            height: 2,
            background: "rgba(58, 25, 12, 0.55)",
          }}
        />
        <div
          className="absolute left-0 right-0 opacity-25 pointer-events-none"
          style={{
            top: GROUND_Y + RUNNER_SIZE + 6,
            bottom: 0,
            backgroundImage:
              "radial-gradient(circle at 12% 35%, rgba(60,28,15,0.5) 1px, transparent 2px), radial-gradient(circle at 38% 70%, rgba(60,28,15,0.5) 1px, transparent 2px), radial-gradient(circle at 64% 30%, rgba(60,28,15,0.5) 1px, transparent 2px), radial-gradient(circle at 86% 65%, rgba(60,28,15,0.5) 1px, transparent 2px)",
            backgroundSize: "120px 60px",
          }}
        />

        {/* Score top-right */}
        <div
          className="absolute top-3 right-5 text-right font-mono-tokens tabular-nums"
          style={{ color: "var(--text)" }}
        >
          <div className="text-base font-bold leading-none">{meters} m</div>
          {bestMeters > 0 && (
            <div className="text-[10px] mt-1 opacity-70">best · {bestMeters} m</div>
          )}
        </div>

        {/* Procurement HUD top-left — real-time USDC + calls Alice has spent on vendors */}
        <ProcurementHUD procurement={procurement} />

        {/* Mushrooms */}
        {obstaclesRef.current.map((o) => (
          <Mushroom key={o.id} x={o.x} groundTop={GROUND_Y + RUNNER_SIZE} />
        ))}

        {/* Runners */}
        {runnersRef.current.map((r) => (
          <Runner key={r.agentId} runner={r} />
        ))}
      </div>
    </section>
  );
}

function Runner({ runner }: { runner: RunnerState }) {
  const isJumping = runner.y > 0.5;
  const tilt = isJumping ? -8 : Math.sin(runner.bobPhase) * 2;
  return (
    <div
      className="absolute"
      style={{
        left: runner.baseX,
        top: GROUND_Y - runner.y,
        width: RUNNER_SIZE,
        height: RUNNER_SIZE,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div
        className="relative w-full h-full rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 32%, ${runner.color.core} 0%, ${runner.color.mid} 45%, ${runner.color.deep} 100%)`,
          boxShadow: `inset -5px -7px 12px rgba(0,0,0,0.18), inset 3px 4px 10px rgba(255,255,255,0.5), 0 5px 12px ${runner.color.deep}55`,
          animation: !isJumping ? "breathe 0.45s ease-in-out infinite" : undefined,
        }}
      >
        {/* eyes */}
        <div
          className="absolute rounded-full"
          style={{ left: "30%", top: "40%", width: 4, height: 4, background: "#2A1A0F" }}
        />
        <div
          className="absolute rounded-full"
          style={{ right: "30%", top: "40%", width: 4, height: 4, background: "#2A1A0F" }}
        />
        {/* mouth */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: isJumping ? "20%" : "26%",
            width: isJumping ? 14 : 10,
            height: isJumping ? 7 : 4,
            borderBottom: "2px solid #2A1A0F",
            borderRadius: "0 0 14px 14px",
          }}
        />
      </div>

      {/* Name label above */}
      <div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
        style={{
          top: -NAME_OFFSET,
          fontSize: runner.isLeader ? 11 : 10,
          fontWeight: runner.isLeader ? 800 : 700,
          letterSpacing: 0.5,
          color: runner.color.deep,
          textShadow: "0 1px 0 rgba(255,251,244,0.85)",
          padding: runner.isLeader ? "2px 8px" : "1px 6px",
          background: runner.color.core,
          borderRadius: 999,
          border: `1px solid ${runner.color.deep}`,
          boxShadow: runner.isLeader ? `0 3px 10px ${runner.color.deep}44` : undefined,
        }}
      >
        {runner.isLeader && (
          <span style={{ marginRight: 3, fontSize: 9 }}>★</span>
        )}
        {runner.name}
      </div>

      {/* Shadow */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: RUNNER_SIZE + runner.y + 2,
          width: Math.max(8, RUNNER_SIZE - runner.y * 0.4),
          height: 5,
          background: "rgba(58, 25, 12, 0.28)",
          borderRadius: "50%",
          filter: "blur(2px)",
          opacity: Math.max(0.25, 1 - runner.y / 110),
        }}
      />
    </div>
  );
}

function useSmoothNumber(target: number, speed = 0.14): number {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    ref.current = target;
  }, [target]);
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

function ProcurementHUD({ procurement }: { procurement?: ProcurementSummary }) {
  const spend = procurement?.totalSpendUsdc ?? 0;
  const calls = procurement?.callCount ?? 0;
  const animSpend = useSmoothNumber(spend);
  const animCalls = useSmoothNumber(calls);

  // Pulse when calls increment (a vendor just got paid)
  const [pulse, setPulse] = useState(false);
  const prevCalls = useRef(calls);
  useEffect(() => {
    if (calls > prevCalls.current) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 800);
      prevCalls.current = calls;
      return () => clearTimeout(id);
    }
    prevCalls.current = calls;
  }, [calls]);

  return (
    <div
      className="absolute top-3 left-4"
      style={{
        color: "var(--text)",
        transition: "text-shadow 0.5s",
        textShadow: pulse ? "0 0 14px rgba(255,255,255,0.9)" : "none",
      }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-display italic font-bold tabular-nums leading-none"
          style={{ fontSize: 22, color: "var(--text)" }}
        >
          ${animSpend.toFixed(3)}
        </span>
        <span
          className="font-mono-tokens tabular-nums font-semibold"
          style={{ fontSize: 13, color: "rgba(26,16,6,0.75)" }}
        >
          · {Math.round(animCalls)}
        </span>
      </div>
      <div
        className="font-mono-tokens uppercase tracking-wider"
        style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(26,16,6,0.6)", marginTop: 3 }}
      >
        spent on vendors
      </div>
    </div>
  );
}

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: y, transform: `scale(${scale})`, transformOrigin: "left top" }}
    >
      <div
        style={{
          position: "relative",
          width: 56,
          height: 22,
          background: "rgba(255, 251, 244, 0.9)",
          borderRadius: 22,
          boxShadow: "0 4px 14px rgba(184,90,61,0.10)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 8,
            top: -10,
            width: 22,
            height: 22,
            background: "rgba(255, 251, 244, 0.9)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 26,
            top: -16,
            width: 28,
            height: 28,
            background: "rgba(255, 251, 244, 0.9)",
            borderRadius: "50%",
          }}
        />
      </div>
    </div>
  );
}

function Mushroom({ x, groundTop }: { x: number; groundTop: number }) {
  // Stylized rock — neutral palette, no Mario sprite. Two stacked dome
  // shapes with a soft highlight to read as terrain.
  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: groundTop - OBSTACLE_H,
        width: OBSTACLE_W,
        height: OBSTACLE_H,
      }}
    >
      {/* Main rock body */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: 0,
          height: OBSTACLE_H,
          background: "linear-gradient(180deg, #8C7E69 0%, #5A4F3F 100%)",
          borderRadius: "50% 50% 18% 18% / 60% 60% 24% 24%",
          boxShadow: "inset -2px -3px 0 rgba(0,0,0,0.18), inset 2px 2px 0 rgba(255,255,255,0.10)",
        }}
      />
      {/* Highlight crease */}
      <div
        className="absolute"
        style={{
          left: "30%",
          top: "20%",
          width: "32%",
          height: "8%",
          background: "rgba(255, 251, 244, 0.18)",
          borderRadius: "50%",
          filter: "blur(1px)",
        }}
      />
    </div>
  );
}
