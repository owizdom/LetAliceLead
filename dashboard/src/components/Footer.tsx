"use client";

export default function Footer() {
  return (
    <footer className="border-t mt-12" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: "var(--muted)" }}>
        <div className="flex items-center gap-6">
          <span>
            <span className="font-serif-display" style={{ color: "var(--text)" }}>LetAliceLead</span> · Credit &amp; procurement infrastructure for autonomous agents
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/owizdom/LetAliceLead"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "var(--muted)" }}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
