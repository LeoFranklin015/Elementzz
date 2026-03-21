"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import Creature from "@/components/creatures";

type Phase = "intro" | "summoning" | "revealed";

const MOCK_CARDS = [
  { element: 0 as const, atk: 8, def: 4, hp: 20, maxHp: 20, address: "0x4e9Ae000FD0ebb7583CAb53c77F6C891B9aBC213" },
  { element: 2 as const, atk: 9, def: 3, hp: 18, maxHp: 18, address: "0x1B8924cb7585DE72455b94ad36aa2AEfA492B045" },
];

export default function Onboard() {
  const [phase, setPhase] = useState<Phase>("intro");

  const handleSummon = () => {
    setPhase("summoning");
    setTimeout(() => setPhase("revealed"), 4000);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ═══ INTRO ═══ */}
      {phase === "intro" && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-12 text-center">
            {/* Three creatures — center one is the mystery summon */}
            <div className="flex items-end justify-center gap-10 mb-4">
              <div className="animate-slide-up opacity-40" style={{ animationDelay: "0ms", filter: "drop-shadow(0 4px 16px rgba(0,136,255,0.2))" }}>
                <Creature element={1} size={80} />
              </div>
              <div className="animate-slide-up -mt-4" style={{ animationDelay: "200ms" }}>
                {/* Pixel card back — two mystery cards */}
                <div className="flex gap-3">
                  {[0, 1].map(i => (
                    <div
                      key={i}
                      className="w-16 h-22 border-2 border-white/20 bg-[#0a0a0a] flex flex-col items-center justify-center gap-1 p-2"
                      style={{ boxShadow: "0 4px 20px rgba(255,170,0,0.1)" }}
                    >
                      <span className="font-[family-name:var(--font-press-start)] text-white/20" style={{ fontSize: "18px" }}>?</span>
                      <div className="w-8 h-0.5 bg-white/10" />
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5" style={{ background: "#ff4400", opacity: 0.4 }} />
                        <div className="w-1.5 h-1.5" style={{ background: "#ffaa00", opacity: 0.4 }} />
                        <div className="w-1.5 h-1.5" style={{ background: "#0088ff", opacity: 0.4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="animate-slide-up opacity-40" style={{ animationDelay: "400ms", filter: "drop-shadow(0 4px 16px rgba(255,68,0,0.2))" }}>
                <Creature element={0} size={80} />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-[family-name:var(--font-press-start)] text-lg sm:text-xl text-white/90 leading-8">
                SUMMON YOUR<br />BATTLE AGENTS
              </h1>
              <p className="text-xl text-white/40 max-w-md mx-auto leading-8">
                Two autonomous card agents will be deployed to your wallet.
                Each card is its own on-chain wallet that fights for you.
              </p>
            </div>

            {/* What you get */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { label: "2 CARDS", desc: "Unique agents", color: "#ff4400" },
                { label: "RANDOM", desc: "Element assigned", color: "#ffaa00" },
                { label: "ON-CHAIN", desc: "ERC-8004 identity", color: "#0088ff" },
              ].map((item) => (
                <div key={item.label} className="pixel-border p-3 text-center">
                  <div className="font-[family-name:var(--font-press-start)] text-[9px] mb-1" style={{ color: item.color }}>
                    {item.label}
                  </div>
                  <div className="text-sm text-white/40">{item.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={handleSummon} className="pixel-btn text-sm px-10 py-4">
              SUMMON CARDS
            </button>
          </div>
        </main>
      )}

      {/* ═══ SUMMONING ═══ */}
      {phase === "summoning" && (
        <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
          {/* Background pulse effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-96 h-96 rounded-full opacity-[0.07]"
              style={{
                background: "radial-gradient(circle, #ffaa00 0%, transparent 70%)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
          </div>

          <div className="relative z-10 max-w-lg w-full space-y-8 text-center">
            {/* Spinning card backs */}
            <div className="flex justify-center gap-8">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="w-32 h-44 pixel-border flex items-center justify-center"
                  style={{
                    background: "var(--bg-panel)",
                    animation: `card-flip ${2 + i * 0.3}s ease-in-out infinite`,
                  }}
                >
                  <span className="text-4xl" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>?</span>
                </div>
              ))}
            </div>

            <h2 className="font-[family-name:var(--font-press-start)] text-sm text-white/90">
              DEPLOYING AGENTS...
            </h2>

            {/* Progress steps */}
            <div className="pixel-border p-5 text-left space-y-3">
              {[
                { text: "Creating CardAgent contract #1", done: true, color: "#ff4400" },
                { text: "Creating CardAgent contract #2", done: true, color: "#0088ff" },
                { text: "Assigning elements & stats", done: true, color: "#ffaa00" },
                { text: "Registering in ERC-8004 registry", done: false, color: "white" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 font-mono text-sm">
                  <div
                    className={`w-3 h-3 border ${
                      step.done
                        ? "border-white/40"
                        : "border-white/40 animate-pulse"
                    }`}
                    style={{ background: step.done ? step.color : "transparent" }}
                  />
                  <span className={step.done ? "text-white/50" : "text-white/80"}>
                    {step.text}
                  </span>
                  {step.done && <span className="text-white/40">OK</span>}
                  {!step.done && <span className="animate-blink text-white/80">...</span>}
                </div>
              ))}
            </div>

            {/* Loading bar */}
            <div className="space-y-2">
              <div className="w-full h-3 bg-[#0a0a0a] border border-white/10 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    background: "linear-gradient(90deg, #ff4400, #ffaa00, #0088ff)",
                    animation: "load-bar 4s linear forwards",
                  }}
                />
              </div>
              <div className="font-mono text-xs text-white/40">
                tx: 0xf1f008a588619339ea42...{" "}
                <span className="text-white/50 underline cursor-pointer">View on BaseScan</span>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes card-flip {
              0%, 100% { transform: rotateY(0deg); }
              50% { transform: rotateY(180deg); }
            }
            @keyframes load-bar {
              from { width: 0%; }
              to { width: 100%; }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.1; }
              50% { transform: scale(1.3); opacity: 0.2; }
            }
          `}</style>
        </main>
      )}

      {/* ═══ REVEALED ═══ */}
      {phase === "revealed" && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-3xl w-full space-y-10 text-center">
            <h2 className="font-[family-name:var(--font-press-start)] text-lg text-white/90 animate-slide-up">
              YOUR AGENTS ARE READY
            </h2>

            {/* Cards with creatures above */}
            <div className="flex justify-center gap-10 flex-wrap">
              {MOCK_CARDS.map((card, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 400}ms` }}
                >
                  {/* Creature floating above card */}
                  <div style={{
                    filter: `drop-shadow(0 0 16px ${["#ff440060", "#0088ff60", "#ffaa0060"][card.element]})`,
                  }}>
                    <Creature element={card.element} size={100} />
                  </div>
                  <GameCard {...card} size="lg" />
                </div>
              ))}
            </div>

            {/* Info text */}
            <div className="pixel-border p-5 max-w-md mx-auto space-y-2 animate-slide-up" style={{ animationDelay: "800ms" }}>
              <p className="text-lg text-white/70">
                These agents fight <span className="text-white">autonomously</span> on your behalf.
              </p>
              <p className="text-white/40">
                Stake USDC, enter a battle room, and let them clash.
              </p>
            </div>

            <div className="animate-slide-up" style={{ animationDelay: "1000ms" }}>
              <Link href="/lobby" className="pixel-btn text-sm px-10 py-4">
                ENTER THE LOBBY →
              </Link>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
