"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";

export default function Result() {
  const params = useParams();
  const isWinner = false; // mock: player lost

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-8">
          {/* Winner banner */}
          <div className="text-center space-y-3 animate-slide-up">
            <div className="text-6xl">{isWinner ? "🏆" : "💀"}</div>
            <h1
              className="font-[family-name:var(--font-press-start)] text-xl"
              style={isWinner ? {
                background: "linear-gradient(90deg, #ff4400 0%, #ffaa00 40%, #0088ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              } : {
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {isWinner ? "VICTORY!" : "DEFEATED"}
            </h1>
          </div>

          {/* Payout */}
          <div className="pixel-border p-4 text-center space-y-2 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="text-white/40 text-sm">PRIZE PAID</div>
            <div className="font-[family-name:var(--font-press-start)] text-lg text-white">
              200 USDC
            </div>
            <div className="font-mono text-xs text-white/40">
              tx: 0xa8f0e874...b377{" "}
              <span className="text-white/50 underline cursor-pointer">View on explorer</span>
            </div>
          </div>

          {/* Final HP summary */}
          <div className="pixel-border p-4 space-y-4 animate-slide-up" style={{ animationDelay: "400ms" }}>
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 text-center">
              FINAL STANDINGS
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50 text-center">
                  PLAYER 1 (YOU)
                </div>
                <div className="flex gap-2 justify-center">
                  <GameCard element={0} atk={8} def={4} hp={0} maxHp={20} isDead size="sm" />
                  <GameCard element={2} atk={9} def={3} hp={0} maxHp={18} isDead size="sm" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="font-[family-name:var(--font-press-start)] text-[8px] text-[#0088ff] text-center">
                  PLAYER 2 (WINNER)
                </div>
                <div className="flex gap-2 justify-center">
                  <GameCard element={2} atk={9} def={3} hp={0} maxHp={18} isDead size="sm" />
                  <GameCard element={1} atk={5} def={8} hp={15} maxHp={22} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Match stats */}
          <div className="pixel-border p-4 space-y-3 animate-slide-up" style={{ animationDelay: "600ms" }}>
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 text-center">
              MATCH STATS
            </div>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Total turns:</span>
                  <span className="text-white">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Decisive hit:</span>
                  <span className="text-[#ff2244]">13 dmg</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Duration:</span>
                  <span className="text-white">2m 15s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">MVP:</span>
                  <span className="text-[#0088ff]">Frost Tide</span>
                </div>
              </div>
            </div>
          </div>

          {/* Elemental breakdown */}
          <div className="pixel-border p-4 space-y-3 animate-slide-up" style={{ animationDelay: "800ms" }}>
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 text-center">
              ELEMENTAL BREAKDOWN
            </div>
            <div className="space-y-2 font-mono text-sm">
              {[
                { matchup: "FIRE > LIGHTNING", label: "Fire vs Lightning", avg: "13 dmg/turn", effective: true, color: "#ff4400" },
                { matchup: "LIGHTNING > WATER", label: "Lightning vs Water", avg: "10 dmg/turn", effective: true, color: "#ffaa00" },
                { matchup: "WATER > FIRE", label: "Water vs Fire", avg: "6 dmg/turn", effective: true, color: "#0088ff" },
                { matchup: "LIGHTNING > FIRE", label: "Lightning vs Fire", avg: "1 dmg/turn", effective: false, color: "#ffaa00" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-press-start)] text-[7px]" style={{ color: row.color }}>{row.matchup}</span>
                  </div>
                  <span className={row.effective ? "text-white" : "text-white/30"}>
                    {row.avg}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center animate-slide-up" style={{ animationDelay: "1000ms" }}>
            <Link href="/lobby" className="pixel-btn text-xs">
              PLAY AGAIN
            </Link>
            <button
              className="pixel-btn text-xs"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/result/${params.id}`)}
            >
              SHARE MATCH
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
