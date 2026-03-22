"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Creature from "@/components/creatures";
import { useBattleOnChain, type SlotData } from "@/lib/useBattleOnChain";
import { type Strategy, STRATEGIES } from "@/lib/agent";
import { BATTLE_ROOM } from "@/lib/contracts";
import { type Address } from "viem";

const ELEMENT_COLORS = ["#ff4400", "#0088ff", "#ffaa00"];
const CARD_NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];

export default function BattleRoomPage() {
  const params = useParams();
  const roomId = Number(params.id as string);
  const roomAddress = BATTLE_ROOM;

  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [started, setStarted] = useState(false);
  const [prevP1Hp, setPrevP1Hp] = useState<number[]>([]);
  const [prevP2Hp, setPrevP2Hp] = useState<number[]>([]);
  const [dmgP1, setDmgP1] = useState<number[]>([0, 0]);
  const [dmgP2, setDmgP2] = useState<number[]>([0, 0]);
  const [showDmg, setShowDmg] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);
  const [showKO, setShowKO] = useState(false);
  const [showSettledOverlay, setShowSettledOverlay] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const battle = useBattleOnChain(roomAddress, roomId, strategy);
  const {
    roomState, turn, p1Slots, p2Slots,
    p1Wallet, p2Wallet, amP1,
    logs, decisions, settled, phase: battlePhase,
    error, submitting, attackingSlot,
  } = battle;

  // Detect HP changes → show damage animation
  useEffect(() => {
    if (p1Slots.length < 2) return;
    const p1hp = [p1Slots[0].hp, p1Slots[1].hp];
    const p2hp = [p2Slots[0].hp, p2Slots[1].hp];

    if (prevP1Hp.length > 0) {
      const d1 = [Math.max(0, prevP1Hp[0] - p1hp[0]), Math.max(0, prevP1Hp[1] - p1hp[1])];
      const d2 = [Math.max(0, prevP2Hp[0] - p2hp[0]), Math.max(0, prevP2Hp[1] - p2hp[1])];

      if (d1[0] + d1[1] + d2[0] + d2[1] > 0) {
        setDmgP1(d1);
        setDmgP2(d2);
        setShowDmg(true);
        setTimeout(() => setShowDmg(false), 2000);
      }
    }
    setPrevP1Hp(p1hp);
    setPrevP2Hp(p2hp);
  }, [p1Slots, p2Slots]);

  // Scroll log
  useEffect(() => { logRef.current?.scrollTo(0, 0); }, [logs]);

  // KO animation when battle settles
  useEffect(() => {
    if (settled && !showKO && !showSettledOverlay) {
      setShowKO(true);
      // Show clash animation for 2s
      setTimeout(() => {
        setShowKO(false);
        // Then show settled overlay
        setTimeout(() => setShowSettledOverlay(true), 500);
      }, 2500);
    }
  }, [settled]);

  const mySlots = amP1 ? p1Slots : p2Slots;
  const oppSlots = amP1 ? p2Slots : p1Slots;
  const myLabel = amP1 ? "P1 — YOU" : "P2 — YOU";
  const oppLabel = amP1 ? "P2 — OPPONENT" : "P1 — OPPONENT";
  const myColor = amP1 ? "#0088ff" : "#ff4400";
  const oppColor = amP1 ? "#ff4400" : "#0088ff";

  // Not started yet — show strategy picker
  if (!started) {
    return (
      <div className="flex flex-col flex-1 min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-10 text-center">
            <div className="space-y-3">
              <h1 className="font-[family-name:var(--font-press-start)] text-base text-white/90">
                CHOOSE YOUR STRATEGY
              </h1>
              <p className="text-lg text-white/40">
                Your AI agent follows this strategy for the entire battle.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(Object.entries(STRATEGIES) as [Strategy, typeof STRATEGIES[Strategy]][]).map(([key, strat]) => (
                <button key={key} onClick={() => setStrategy(key)}
                  className={`pixel-border p-5 text-left space-y-3 cursor-pointer transition-all duration-200 ${
                    strategy === key ? "border-2 scale-[1.02]" : "opacity-60 hover:opacity-80"
                  }`}
                  style={{
                    borderColor: strategy === key ? strat.color : "rgba(255,255,255,0.1)",
                    boxShadow: strategy === key ? `0 0 20px ${strat.color}30` : "none",
                  }}>
                  <div className="font-[family-name:var(--font-press-start)] text-[11px]" style={{ color: strat.color }}>{strat.name}</div>
                  <p className="text-sm text-white/50 leading-6">{strat.desc}</p>
                  {strategy === key && (
                    <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/80 pt-1">SELECTED</div>
                  )}
                </button>
              ))}
            </div>

            {/* Room info */}
            <div className="pixel-border p-4 space-y-2">
              <div className="text-sm text-white/50">
                Room: <span className="font-mono text-white/70">#{roomId}</span>
              </div>
              <div className="text-sm text-white/50">
                State: <span className={roomState === 1 ? "text-white" : "text-white/30"}>
                  {roomState === 0 ? "WAITING" : roomState === 1 ? "ACTIVE" : "SETTLED"}
                </span>
              </div>
              {p1Wallet && (
                <div className="text-sm text-white/50">
                  You are: <span className="text-white">{amP1 ? "Player 1" : "Player 2"}</span>
                </div>
              )}
            </div>

            <button onClick={() => setStarted(true)}
              disabled={roomState !== 1}
              className="pixel-btn text-sm px-10 py-4 disabled:opacity-30">
              {roomState === 1 ? "START BATTLE" : roomState === 0 ? "WAITING FOR OPPONENT..." : "BATTLE SETTLED"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ═══ BATTLE UI ═══
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 flex gap-3 p-4 max-w-7xl mx-auto w-full">

        {/* LEFT — Battle */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Header */}
          <div className="pixel-border p-3 flex items-center justify-between">
            <span className="font-[family-name:var(--font-press-start)] text-[10px] text-white/50">
              {roomAddress.slice(0, 8)}...{roomAddress.slice(-4)}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">
                TURN <span className="text-white">{turn}</span>/20
              </span>
              <div className="w-20 h-2 bg-[#0a0a0a] border border-white/10 overflow-hidden">
                <div className="h-full hp-bar-fill" style={{ width: `${(turn / 20) * 100}%`, background: "linear-gradient(90deg, #ff4400, #ffaa00, #0088ff)" }} />
              </div>
              <span className={`font-[family-name:var(--font-press-start)] text-[9px] px-2 py-1 border ${
                settled ? "border-purple-500 text-purple-400" :
                battlePhase === "submitting" ? "border-[#ffaa00] text-[#ffaa00]" :
                "border-white/40 text-white/80"
              }`}>
                {settled ? "SETTLED" :
                 battlePhase === "submitting" ? "SUBMITTING" :
                 battlePhase === "opponent" ? "WAITING" :
                 battlePhase === "resolved" ? "RESOLVED" : "ACTIVE"}
              </span>
            </div>
          </div>

          {/* HP bars — both players */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: myLabel, color: myColor, slots: mySlots, dmg: amP1 ? dmgP1 : dmgP2 },
              { label: oppLabel, color: oppColor, slots: oppSlots, dmg: amP1 ? dmgP2 : dmgP1 },
            ].map(({ label, color, slots, dmg }, pi) => (
              <div key={pi} className="pixel-border p-3">
                <div className="font-[family-name:var(--font-press-start)] text-[9px] mb-2" style={{ color }}>{label}</div>
                {slots.map((s, ci) => {
                  const dead = s.hp <= 0;
                  const pct = s.maxHp > 0 ? Math.max(0, (s.hp / s.maxHp) * 100) : 0;
                  const col = pct > 60 ? ELEMENT_COLORS[s.element] : pct > 30 ? "#ffaa00" : "#ff2244";
                  return (
                    <div key={ci} className={`flex items-center gap-2 py-1 ${dead ? "opacity-25" : ""}`}>
                      <Creature element={s.element as 0 | 1 | 2} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-[family-name:var(--font-press-start)] text-[10px]" style={{ color: ELEMENT_COLORS[s.element] }}>
                            {CARD_NAMES[s.element] || "???"}
                          </span>
                          {s.submitted && !dead && (
                            <span className="font-[family-name:var(--font-press-start)] text-[7px] px-1 py-0.5 border border-white/20 text-white/40">
                              READY
                            </span>
                          )}
                          <span className="font-[family-name:var(--font-press-start)] text-[10px] relative" style={{ color: col }}>
                            {s.hp}/{s.maxHp}
                            {showDmg && dmg[ci] > 0 && (
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[14px] animate-damage" style={{ color: "#ff2244" }}>
                                -{dmg[ci]}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#0a0a0a] border border-white/10 overflow-hidden mt-0.5">
                          <div className="h-full hp-bar-fill" style={{ width: `${pct}%`, background: col, boxShadow: `0 0 6px ${col}40` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ARENA */}
          <div className="pixel-border flex-1 min-h-[300px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              background: showDmg
                ? "radial-gradient(circle, #ff224430 0%, transparent 50%)"
                : "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
            }} />

            <div className="relative z-10 flex items-center w-full justify-between px-8">
              {/* My lead card */}
              {mySlots.length > 0 && (
                <div className={`transition-all duration-500 ${showDmg ? "translate-x-12 scale-105" : ""}`}>
                  <div className="relative">
                    <div style={{ filter: `drop-shadow(0 0 20px ${ELEMENT_COLORS[mySlots[0]?.element || 0]}60)` }}>
                      <Creature element={(mySlots[0]?.element || 0) as 0 | 1 | 2} size={140} />
                    </div>
                    <div className="text-center mt-2">
                      <span className="font-[family-name:var(--font-press-start)] text-[8px]" style={{ color: ELEMENT_COLORS[mySlots[0]?.element || 0] }}>
                        {CARD_NAMES[mySlots[0]?.element || 0]}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Center */}
              <div className="flex flex-col items-center gap-2">
                {showDmg ? (
                  <span className="text-4xl animate-impact">💥</span>
                ) : battlePhase === "submitting" ? (
                  <div className="space-y-2 text-center">
                    <div className="w-3 h-3 bg-white/40 animate-pulse mx-auto" />
                    <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">SUBMITTING</span>
                  </div>
                ) : battlePhase === "opponent" ? (
                  <div className="space-y-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-white/30" style={{ animation: `blink 1s ${i * 0.3}s step-end infinite` }} />
                      ))}
                    </div>
                    <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/30">WAITING FOR OPPONENT</span>
                  </div>
                ) : (
                  <span className="font-[family-name:var(--font-press-start)] text-lg text-white/40">VS</span>
                )}
              </div>

              {/* Opponent lead card (mirrored) */}
              {oppSlots.length > 0 && (
                <div className={`transition-all duration-500 ${showDmg ? "-translate-x-12 scale-105" : ""}`}>
                  <div className="relative">
                    <div style={{
                      filter: `drop-shadow(0 0 20px ${ELEMENT_COLORS[oppSlots[0]?.element || 0]}60)`,
                      transform: "scaleX(-1)",
                    }}>
                      <Creature element={(oppSlots[0]?.element || 0) as 0 | 1 | 2} size={140} />
                    </div>
                    <div className="text-center mt-2">
                      <span className="font-[family-name:var(--font-press-start)] text-[8px]" style={{ color: ELEMENT_COLORS[oppSlots[0]?.element || 0] }}>
                        {CARD_NAMES[oppSlots[0]?.element || 0]}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — AI Reasoning + Logs */}
        <div className="w-[360px] shrink-0 flex flex-col gap-3">

          {/* Strategy badge */}
          <div className="pixel-border p-3">
            <div className="flex items-center justify-between">
              <span className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50">AI AGENT</span>
              <span className="font-[family-name:var(--font-press-start)] text-[8px] px-2 py-0.5 border"
                style={{ borderColor: STRATEGIES[strategy].color, color: STRATEGIES[strategy].color }}>
                {STRATEGIES[strategy].name}
              </span>
            </div>

            {/* AI decisions for my cards */}
            {decisions.length > 0 && (
              <div className="mt-3 space-y-3">
                {decisions.map((d, ci) => {
                  if (d.reasoning[0] === "DEAD" || d.reasoning[0] === "Already submitted") return null;
                  const slot = mySlots[ci];
                  if (!slot) return null;
                  return (
                    <div key={ci}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Creature element={slot.element as 0 | 1 | 2} size={16} />
                        <span className="font-[family-name:var(--font-press-start)] text-[8px]" style={{ color: ELEMENT_COLORS[slot.element] }}>
                          {CARD_NAMES[slot.element]}
                        </span>
                        <span className="font-[family-name:var(--font-press-start)] text-[8px] px-1 py-0.5 border ml-auto"
                          style={{
                            borderColor: d.action === "ATTACK" ? "#ff4400" : "#0088ff",
                            color: d.action === "ATTACK" ? "#ff4400" : "#0088ff",
                          }}>
                          {d.action}
                        </span>
                      </div>
                      <div className="space-y-0.5 ml-5">
                        {d.reasoning.map((line, li) => (
                          <div key={li} className="font-mono text-[12px] text-white/50 flex items-start gap-1">
                            <span className="text-white/30 shrink-0">{'>'}</span>
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {decisions.length === 0 && (
              <div className="mt-3 text-white/30 text-sm font-mono animate-blink text-center py-3">
                Agent initializing...
              </div>
            )}
          </div>

          {/* Battle status */}
          <div className="pixel-border p-3 space-y-2">
            <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">STATUS</div>
            <div className="font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-white/40">Phase:</span>
                <span className="text-white">{battlePhase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">You are:</span>
                <span className="text-white">{amP1 ? "Player 1" : "Player 2"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Turn:</span>
                <span className="text-white">{turn}/20</span>
              </div>
              {error && <div className="text-[#ff2244] text-xs mt-1">{error}</div>}
            </div>
          </div>

          {/* Battle log */}
          <div className="pixel-border p-3 flex-1">
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 mb-2">BATTLE LOG</div>
            <div ref={logRef} className="h-full max-h-[300px] overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-white/30 text-xs text-center py-6 font-mono animate-blink">
                  Waiting for actions...
                </div>
              ) : logs.map((l, i) => (
                <div key={i} className="font-mono text-[12px] flex items-start gap-1.5">
                  <span className="text-white/30 text-[11px] shrink-0">T{l.turn}</span>
                  <span style={{ color: l.color }}>{l.text}</span>
                  {l.txHash && (
                    <a href={`https://testnet.snowtrace.io/tx/${l.txHash}`} target="_blank"
                      className="text-white/50 text-[10px] hover:text-white/80 shrink-0 border border-white/20 px-1 rounded-sm">tx↗</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* KO Animation overlay */}
      {showKO && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="relative flex items-center gap-12">
            {/* Winner creature — rushes in */}
            <div className="animate-slide-up" style={{
              filter: `drop-shadow(0 0 30px ${ELEMENT_COLORS[mySlots[0]?.element || 0]}80)`,
              animation: "creature-float 1s ease-in-out infinite",
            }}>
              <Creature element={(mySlots[0]?.element || 0) as 0 | 1 | 2} size={160} />
            </div>

            {/* KO explosion */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-6xl animate-impact">💥</span>
              <span className="font-[family-name:var(--font-press-start)] text-2xl animate-pulse"
                style={{ color: "#ff2244", textShadow: "0 0 20px #ff224480" }}>
                K.O.
              </span>
            </div>

            {/* Loser creature — knocked back */}
            <div style={{
              filter: "grayscale(1) opacity(0.4)",
              transform: "scaleX(-1) rotate(15deg) translateY(20px)",
            }}>
              <Creature element={(oppSlots[0]?.element || 0) as 0 | 1 | 2} size={140} />
            </div>
          </div>
        </div>
      )}

      {/* Victory overlay */}
      {showSettledOverlay && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="text-center space-y-8 animate-slide-up">
            <div style={{ filter: "drop-shadow(0 0 40px rgba(255,170,0,0.3))" }}>
              <Creature element={(mySlots[0]?.element || 0) as 0 | 1 | 2} size={180} />
            </div>
            <h1 className="font-[family-name:var(--font-press-start)] text-3xl"
              style={{
                background: "linear-gradient(90deg, #ff4400, #ffaa00, #0088ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              BATTLE SETTLED
            </h1>
            <div className="font-mono text-white/50">
              Final: P1[{p1Slots[0]?.hp},{p1Slots[1]?.hp}] vs P2[{p2Slots[0]?.hp},{p2Slots[1]?.hp}]
            </div>
            <div className="flex gap-4 justify-center">
              <Link href={`/result/${roomId}`} className="pixel-btn text-xs">VIEW RESULTS</Link>
              <Link href="/lobby" className="pixel-btn text-xs">BACK TO LOBBY</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
