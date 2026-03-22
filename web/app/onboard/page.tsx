"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import Creature from "@/components/creatures";
import { useOnboard, useHasCards, usePlayerCardAddresses, useCardStats, useUsdcBalance } from "@/lib/useOnboard";
import { useGrantSessionPermissions } from "@/lib/useSessionPermissions";
import { loadSessionKey, getStoredPermissionId } from "@/lib/sessionKey";
import { formatUnits, parseUnits, encodeFunctionData } from "viem";
import { useSendCalls, useWriteContract } from "wagmi";
import { MOCK_USDC, BATTLE_ROOM, CARD_FACTORY, mockUsdcAbi, cardFactoryAbi } from "@/lib/contracts";

type Phase = "intro" | "summoning" | "granting" | "revealed";

export default function Onboard() {
  const { address, isConnected } = useAccount();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // On-chain reads
  const { data: hasCards, refetch: refetchHasCards } = useHasCards(address);
  const { data: cardAddrs, refetch: refetchCards } = usePlayerCardAddresses(address);
  const card0 = useCardStats(cardAddrs?.[0]);
  const card1 = useCardStats(cardAddrs?.[1]);
  const { data: usdcBal } = useUsdcBalance(address);

  // Actions
  const { error: summonError } = useOnboard();
  const { grant, isPending: isGranting, error: grantError } = useGrantSessionPermissions();

  // Already onboarded → check if permissions exist
  useEffect(() => {
    if (hasCards && cardAddrs?.[0] && cardAddrs[0] !== "0x0000000000000000000000000000000000000000") {
      const permId = getStoredPermissionId();
      if (permId) {
        // Has cards + has permission → skip to revealed
        setPhase("revealed");
      } else {
        // Has cards but no permission → need to grant
        setPhase("granting");
      }
    }
  }, [hasCards, cardAddrs]);

  // Poll for onboard completion when summoning
  useEffect(() => {
    if (phase !== "summoning") return;
    const interval = setInterval(async () => {
      const { data: has } = await refetchHasCards();
      if (has) {
        await refetchCards();
        setPhase("granting");
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [phase, refetchHasCards, refetchCards]);

  // Batch onboard + approve in one popup via sendCalls
  const { sendCallsAsync } = useSendCalls();

  const handleSummon = async () => {
    setPhase("summoning");
    try {
      // One popup: onboard + approve USDC to BattleRoom
      const id = await sendCallsAsync({
        calls: [
          {
            to: CARD_FACTORY,
            data: encodeFunctionData({ abi: cardFactoryAbi, functionName: "onboard" }),
          },
          {
            to: MOCK_USDC,
            data: encodeFunctionData({
              abi: mockUsdcAbi,
              functionName: "approve",
              args: [BATTLE_ROOM, parseUnits("100000", 6)],
            }),
          },
        ],
      });
      console.log("Onboard+Approve batch sent:", id);
    } catch (e: any) {
      console.error("Summon failed:", e);
    }
  };

  // Grant session key permissions (separate popup — needs card addresses)
  const handleGrant = async () => {
    if (!cardAddrs?.[0] || cardAddrs[0] === "0x0000000000000000000000000000000000000000") return;
    const permId = await grant(cardAddrs[0], cardAddrs[1]);
    if (permId) setPhase("revealed");
  };

  const cards = [card0.data, card1.data].filter(Boolean) as NonNullable<typeof card0.data>[];
  const error = summonError || grantError;

  // Steps for the progress UI
  const steps = [
    { text: "Deploying card agents + approving USDC", done: phase === "granting" || phase === "revealed" },
    { text: "Waiting for confirmation", done: phase === "granting" || phase === "revealed" },
    { text: "Granting session key permissions", done: phase === "revealed" },
    { text: "Session key can now play autonomously", done: phase === "revealed" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ═══ INTRO ═══ */}
      {phase === "intro" && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-12 text-center">
            <div className="flex items-end justify-center gap-10 mb-4">
              <div className="animate-slide-up opacity-40" style={{ animationDelay: "0ms", filter: "drop-shadow(0 4px 16px rgba(0,136,255,0.2))" }}>
                <Creature element={1} size={80} />
              </div>
              <div className="animate-slide-up -mt-4" style={{ animationDelay: "200ms" }}>
                <div className="flex gap-3">
                  {[0, 1].map(i => (
                    <div key={i} className="w-16 h-22 border-2 border-white/20 bg-[#0a0a0a] flex flex-col items-center justify-center gap-1 p-2"
                      style={{ boxShadow: "0 4px 20px rgba(255,170,0,0.1)" }}>
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
                Two card agents deploy to your wallet. Then your session key gets permission to play the game autonomously.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { label: "2 CARDS", desc: "Unique agents", color: "#ff4400" },
                { label: "RANDOM", desc: "Element assigned", color: "#ffaa00" },
                { label: "SESSION KEY", desc: "Auto-plays for you", color: "#0088ff" },
              ].map((item) => (
                <div key={item.label} className="pixel-border p-3 text-center">
                  <div className="font-[family-name:var(--font-press-start)] text-[9px] mb-1" style={{ color: item.color }}>{item.label}</div>
                  <div className="text-sm text-white/40">{item.desc}</div>
                </div>
              ))}
            </div>

            {mounted && !isConnected ? (
              <p className="text-white/30 font-[family-name:var(--font-press-start)] text-[9px]">Connect your wallet first</p>
            ) : (
              <button onClick={handleSummon} disabled={!mounted}
                className="pixel-btn text-sm px-10 py-4 disabled:opacity-50">
                SUMMON CARDS
              </button>
            )}
          </div>
        </main>
      )}

      {/* ═══ SUMMONING + GRANTING ═══ */}
      {(phase === "summoning" || phase === "granting") && (
        <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-96 h-96 rounded-full opacity-[0.07]"
              style={{ background: "radial-gradient(circle, #ffaa00 0%, transparent 70%)", animation: "creature-pulse 2s ease-in-out infinite" }} />
          </div>

          <div className="relative z-10 max-w-lg w-full space-y-8 text-center">
            <div className="flex justify-center gap-8">
              {[0, 1].map((i) => (
                <div key={i} className="w-32 h-44 pixel-border flex items-center justify-center"
                  style={{ background: "#0a0a0a", animation: `card-flip ${2 + i * 0.3}s ease-in-out infinite` }}>
                  <span className="text-4xl" style={{ animation: "creature-pulse 1.5s ease-in-out infinite" }}>?</span>
                </div>
              ))}
            </div>

            <h2 className="font-[family-name:var(--font-press-start)] text-sm text-white/80">
              {phase === "granting" ? "GRANT PERMISSIONS" : "DEPLOYING AGENTS..."}
            </h2>

            {phase === "granting" && (
              <div className="space-y-4">
                <p className="text-white/50 text-sm">
                  Your session key needs permission to play the game — create rooms, approve USDC, and submit attack/defend moves.
                </p>
                <button onClick={handleGrant} disabled={isGranting} className="pixel-btn text-xs px-8 py-3 disabled:opacity-50">
                  {isGranting ? "APPROVING..." : "GRANT PERMISSIONS"}
                </button>
              </div>
            )}

            {phase === "summoning" && (
              <div className="pixel-border p-5 text-left space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 font-mono text-sm">
                    <div className={`w-3 h-3 border ${
                      step.done ? "border-white/40 bg-white" : i <= steps.findIndex(s => !s.done) ? "border-white/40 animate-pulse" : "border-white/10"
                    }`} />
                    <span className={step.done ? "text-white/50" : "text-white/80"}>{step.text}</span>
                    {step.done && <span className="text-white/40">OK</span>}
                  </div>
                ))}
              </div>
            )}


            {error && <div className="text-sm" style={{ color: "#ff2244" }}>{error}</div>}
          </div>

          <style jsx>{`
            @keyframes card-flip {
              0%, 100% { transform: rotateY(0deg); }
              50% { transform: rotateY(180deg); }
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

            <div className="flex justify-center gap-10 flex-wrap">
              {cards.length > 0 ? cards.map((card, i) => (
                <div key={i} className="flex flex-col items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 400}ms` }}>
                  <div style={{ filter: `drop-shadow(0 0 16px ${["#ff440060", "#0088ff60", "#ffaa0060"][card.element]})` }}>
                    <Creature element={card.element as 0 | 1 | 2} size={100} />
                  </div>
                  <GameCard
                    element={card.element as 0 | 1 | 2}
                    atk={card.atk} def={card.def} hp={card.hp} maxHp={card.maxHp}
                    address={card.address} ownerAddress={address} size="lg"
                  />
                </div>
              )) : (
                <div className="text-white/30 animate-blink">Loading cards from chain...</div>
              )}
            </div>

            {usdcBal !== undefined && (
              <div className="font-mono text-sm text-white/40">
                USDC Balance: <span className="text-white">{formatUnits(usdcBal, 6)}</span>
              </div>
            )}

            <div className="pixel-border p-5 max-w-md mx-auto space-y-2 animate-slide-up" style={{ animationDelay: "800ms" }}>
              <p className="text-lg text-white/70">
                Session key authorized. Your agent plays <span className="text-white">autonomously</span>.
              </p>
              <p className="text-white/40">No approval needed for each turn.</p>
            </div>

            <div className="animate-slide-up" style={{ animationDelay: "1000ms" }}>
              <Link href="/lobby" className="pixel-btn text-sm px-10 py-4">
                ENTER THE LOBBY
              </Link>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
