"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Creature from "@/components/creatures";

export default function Home() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 200),   // title
      setTimeout(() => setStep(2), 800),   // creatures
      setTimeout(() => setStep(3), 1600),  // subtitle
      setTimeout(() => setStep(4), 2200),  // cta
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] relative overflow-hidden">

      {/* ═══ HERO — full viewport ═══ */}
      <section className="flex-1 flex flex-col items-center justify-center min-h-screen px-6 relative">

        {/* Ambient glow — 3 element colors blurred behind creatures */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-full max-w-3xl h-[400px]">
            <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-[0.07] blur-[80px]"
              style={{ background: "#ff4400" }} />
            <div className="absolute left-1/2 -translate-x-1/2 top-[30%] w-56 h-56 rounded-full opacity-[0.06] blur-[90px]"
              style={{ background: "#ffaa00" }} />
            <div className="absolute right-[10%] top-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-[0.07] blur-[80px]"
              style={{ background: "#0088ff" }} />
          </div>
        </div>

        {/* Title */}
        <h1
          className={`relative z-10 font-[family-name:var(--font-press-start)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-[0.15em] mb-16 transition-all duration-1000 ease-out ${
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{
            background: "linear-gradient(90deg, #ff4400 0%, #ffaa00 40%, #0088ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          ELEMENTZZ
        </h1>

        {/* Creatures — THE hero */}
        <div
          className={`relative z-10 flex items-end justify-center gap-8 sm:gap-14 md:gap-20 mb-16 transition-all duration-1000 ease-out ${
            step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {/* Fire — Inferno */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ filter: "drop-shadow(0 4px 24px rgba(255,68,0,0.3))" }}>
              <Creature element={0} size={110} />
            </div>
            <span className="font-[family-name:var(--font-press-start)] text-[9px] tracking-wider" style={{ color: "#ff4400" }}>
              INFERNO
            </span>
          </div>

          {/* Lightning — Volt Phantom (center, elevated) */}
          <div className="flex flex-col items-center gap-3 -mt-10">
            <div style={{ filter: "drop-shadow(0 4px 32px rgba(255,170,0,0.35))" }}>
              <Creature element={2} size={140} />
            </div>
            <span className="font-[family-name:var(--font-press-start)] text-[9px] tracking-wider" style={{ color: "#ffaa00" }}>
              VOLT PHANTOM
            </span>
          </div>

          {/* Water — Frost Tide */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ filter: "drop-shadow(0 4px 24px rgba(0,136,255,0.3))" }}>
              <Creature element={1} size={110} />
            </div>
            <span className="font-[family-name:var(--font-press-start)] text-[9px] tracking-wider" style={{ color: "#0088ff" }}>
              FROST TIDE
            </span>
          </div>
        </div>

        {/* Subtitle — one line */}
        <p
          className={`relative z-10 text-xl sm:text-2xl text-white/40 font-[family-name:var(--font-vt323)] tracking-widest mb-12 text-center transition-all duration-700 ${
            step >= 3 ? "opacity-100" : "opacity-0"
          }`}
        >
          On-chain PvP. Autonomous agents. Real stakes.
        </p>

        {/* CTA — white, not green */}
        <div
          className={`relative z-10 transition-all duration-700 ${
            step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <Link
            href="/onboard"
            className="inline-block px-10 py-4 border-2 border-white/80 text-white font-[family-name:var(--font-press-start)] text-xs tracking-widest hover:bg-white hover:text-[#050505] transition-colors duration-200 cursor-pointer"
          >
            PLAY NOW
          </Link>
        </div>

        {/* Elemental triangle — subtle, below CTA */}
        <div
          className={`relative z-10 mt-16 flex items-center gap-3 text-white/20 transition-all duration-700 ${
            step >= 4 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-[family-name:var(--font-press-start)] text-[7px]" style={{ color: "#ff440060" }}>FIRE</span>
          <span className="text-sm">›</span>
          <span className="font-[family-name:var(--font-press-start)] text-[7px]" style={{ color: "#ffaa0060" }}>LIGHTNING</span>
          <span className="text-sm">›</span>
          <span className="font-[family-name:var(--font-press-start)] text-[7px]" style={{ color: "#0088ff60" }}>WATER</span>
          <span className="text-sm">›</span>
          <span className="font-[family-name:var(--font-press-start)] text-[7px]" style={{ color: "#ff440060" }}>FIRE</span>
        </div>
      </section>

      {/* ═══ CARD PREVIEW — show the actual product ═══ */}
      <section className="relative z-10 py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Left — a game card */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Glow behind card */}
                <div className="absolute inset-0 blur-[60px] opacity-20" style={{ background: "linear-gradient(135deg, #ff4400, #ffaa00)" }} />
                <div className="relative border-2 border-white/10 bg-[#0a0a0a] p-6 w-[220px]">
                  <div className="flex justify-center mb-4">
                    <Creature element={0} size={120} />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="font-[family-name:var(--font-press-start)] text-[10px]" style={{ color: "#ff4400" }}>INFERNO</div>
                    <div className="font-[family-name:var(--font-press-start)] text-[7px] text-white/30">FIRE ELEMENTAL</div>
                    <div className="flex justify-between font-[family-name:var(--font-press-start)] text-[8px] text-white/50 pt-2 border-t border-white/5">
                      <span>ATK <span style={{ color: "#ff4400" }}>8</span></span>
                      <span>DEF <span style={{ color: "#ff4400" }}>4</span></span>
                      <span>HP <span style={{ color: "#ff4400" }}>20</span></span>
                    </div>
                    {/* HP bar */}
                    <div className="w-full h-1.5 bg-white/5 overflow-hidden">
                      <div className="h-full w-full" style={{ background: "#ff4400" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — text */}
            <div className="space-y-6">
              <h2 className="font-[family-name:var(--font-press-start)] text-sm text-white/90 leading-7">
                Each card is its<br />own wallet.
              </h2>
              <p className="text-lg text-white/40 leading-8">
                Every card agent is an ERC-8004 autonomous smart account deployed on-chain. It holds its own identity, decides its own moves, and fights without your input.
              </p>
              <div className="flex items-center gap-6 pt-2">
                <div className="text-center">
                  <div className="font-[family-name:var(--font-press-start)] text-lg text-white/80">3</div>
                  <div className="text-xs text-white/30 mt-1">Elements</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="font-[family-name:var(--font-press-start)] text-lg text-white/80">2</div>
                  <div className="text-xs text-white/30 mt-1">Cards each</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <div className="font-[family-name:var(--font-press-start)] text-lg text-white/80">20</div>
                  <div className="text-xs text-white/30 mt-1">Max turns</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT PLAYS — horizontal flow ═══ */}
      <section className="relative z-10 py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-px bg-white/5">
            {[
              { label: "SUMMON", desc: "Connect wallet. Get 2 random agents.", color: "#ff4400", icon: <Creature element={0} size={48} /> },
              { label: "STAKE", desc: "Create room. Put up USDC. Opponent matches.", color: "#ffaa00", icon: <Creature element={2} size={48} /> },
              { label: "BATTLE", desc: "Agents fight autonomously. Winner takes all.", color: "#0088ff", icon: <Creature element={1} size={48} /> },
            ].map((s) => (
              <div key={s.label} className="bg-[#050505] p-8 text-center space-y-4">
                <div className="flex justify-center">{s.icon}</div>
                <div className="font-[family-name:var(--font-press-start)] text-[10px]" style={{ color: s.color }}>{s.label}</div>
                <p className="text-sm text-white/35 leading-6">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/20">ELEMENTZZ</span>
          <div className="flex items-center gap-4 text-white/20 font-mono text-xs">
            <span>Base Sepolia</span>
            <span className="text-white/10">|</span>
            <span>ERC-8004</span>
            <span className="text-white/10">|</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
