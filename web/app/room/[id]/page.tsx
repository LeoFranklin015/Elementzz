"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Creature from "@/components/creatures";
import { useBattle, type BattleCard, type TurnEvent } from "@/lib/useBattle";
import type { Decision } from "@/lib/agent";

const ELEMENT_COLORS = ["#ff4400", "#0088ff", "#ffaa00"];
const CARD_NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];

const INITIAL_P1: BattleCard[] = [
  { element: 0, atk: 8, def: 4, hp: 20, maxHp: 20 },
  { element: 2, atk: 9, def: 3, hp: 18, maxHp: 18 },
];
const INITIAL_P2: BattleCard[] = [
  { element: 2, atk: 9, def: 3, hp: 18, maxHp: 18 },
  { element: 1, atk: 5, def: 8, hp: 22, maxHp: 22 },
];

type Phase = "waiting" | "thinking" | "fighting" | "damage" | "turnEnd" | "victory";

export default function BattleRoom() {
  const params = useParams();
  const { p1Cards, p2Cards, turn, settled, winner, currentDecisions, playTurn } = useBattle(INITIAL_P1, INITIAL_P2);

  const [phase, setPhase] = useState<Phase>("waiting");
  const [activeFight, setActiveFight] = useState<number>(0);
  const [dmg, setDmg] = useState<{ p1: number | null; p2: number | null }>({ p1: null, p2: null });
  const [shake, setShake] = useState(false);
  const [logs, setLogs] = useState<Array<{ text: string; color: string; turn: number }>>([]);
  const [displayHp, setDisplayHp] = useState({ p1: [20, 18], p2: [18, 22] });
  const [displayDecisions, setDisplayDecisions] = useState<{ p1: Decision[]; p2: Decision[] } | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnEvent | null>(null);
  const [thinkingLine, setThinkingLine] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-play loop
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setTimeout(() => {
      const result = playTurn();
      if (!result) return;
      setLastTurn(result);
      setDisplayDecisions({ p1: result.p1Decisions, p2: result.p2Decisions });
      setPhase("thinking");
      setThinkingLine(0);
    }, turn === 0 ? 2000 : 1500);
    return () => clearTimeout(timer);
  }, [phase, turn, playTurn]);

  // Thinking phase — typewriter reveal of reasoning
  useEffect(() => {
    if (phase !== "thinking" || !displayDecisions) return;
    if (thinkingLine < 4) {
      const timer = setTimeout(() => setThinkingLine(l => l + 1), 400);
      return () => clearTimeout(timer);
    }

    // Move to fighting
    const timer = setTimeout(() => {
      setActiveFight(0);
      setPhase("fighting");
    }, 600);
    return () => clearTimeout(timer);
  }, [phase, thinkingLine, displayDecisions, p1Cards, p2Cards, lastTurn]);

  // Fighting → damage → next fight or turn end
  useEffect(() => {
    if (phase !== "fighting" || !lastTurn) return;
    const fights = lastTurn.fights;

    if (activeFight >= fights.length) {
      // All fights done
      setDisplayHp({ p1: lastTurn.hpAfter.p1, p2: lastTurn.hpAfter.p2 });
      setLogs(prev => [...lastTurn.logs.map(l => ({ ...l, turn: lastTurn.turn })), ...prev]);
      setPhase(lastTurn.fights.length > 0 && (settled || winner) ? "victory" : "turnEnd");
      return;
    }

    const fight = fights[activeFight];

    // Show clash
    const t1 = setTimeout(() => {
      setShake(true);
      setDmg({ p1: fight.p2Dmg || null, p2: fight.p1Dmg || null });
      setPhase("damage");
      setTimeout(() => setShake(false), 300);
    }, 800);

    return () => clearTimeout(t1);
  }, [phase, activeFight, lastTurn, settled, winner]);

  // Damage → next fight
  useEffect(() => {
    if (phase !== "damage") return;
    const timer = setTimeout(() => {
      setDmg({ p1: null, p2: null });
      setActiveFight(f => f + 1);
      setPhase("fighting");
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  // Turn end → back to waiting
  useEffect(() => {
    if (phase !== "turnEnd") return;
    const timer = setTimeout(() => {
      if (settled) {
        setPhase("victory");
      } else {
        setPhase("waiting");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [phase, settled]);

  // Scroll log
  useEffect(() => {
    logRef.current?.scrollTo(0, 0);
  }, [logs]);

  const fightSlot = lastTurn?.fights[activeFight]?.slot ?? 0;
  const inArena = phase === "fighting" || phase === "damage";
  const isVictory = phase === "victory";

  return (
    <div className={`flex flex-col flex-1 min-h-screen ${shake ? "animate-shake" : ""}`}>
      <Navbar />
      <main className="flex-1 flex gap-3 p-4 max-w-7xl mx-auto w-full">

        {/* ═══ LEFT — Battle (arena + HP) ═══ */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Header */}
          <div className="pixel-border p-3 flex items-center justify-between">
            <span className="font-[family-name:var(--font-press-start)] text-[10px] text-white/50">ROOM #{params.id}</span>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">
                TURN <span className="text-white">{turn}</span>/20
              </span>
              <div className="w-20 h-2 bg-[#0a0a0a] border border-white/10 overflow-hidden">
                <div className="h-full hp-bar-fill" style={{ width: `${(turn / 20) * 100}%`, background: "linear-gradient(90deg, #ff4400, #ffaa00, #0088ff)" }} />
              </div>
              <span className={`font-[family-name:var(--font-press-start)] text-[9px] px-2 py-1 border ${isVictory ? "border-purple-500 text-purple-400" : "border-white/40 text-white/80"}`}>
                {isVictory ? "SETTLED" : phase === "thinking" ? "THINKING" : "ACTIVE"}
              </span>
            </div>
          </div>

          {/* HP bars */}
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(pi => {
              const cards = pi === 0 ? p1Cards : p2Cards;
              const hp = pi === 0 ? displayHp.p1 : displayHp.p2;
              const decisions = pi === 0 ? displayDecisions?.p1 : displayDecisions?.p2;
              return (
                <div key={pi} className="pixel-border p-3">
                  <div className="font-[family-name:var(--font-press-start)] text-[9px] mb-2" style={{ color: pi === 0 ? "#0088ff" : "#ff4400" }}>
                    {pi === 0 ? "P1 — YOU" : "P2 — OPPONENT"}
                  </div>
                  {cards.map((c, ci) => {
                    const dead = hp[ci] <= 0;
                    const pct = Math.max(0, (hp[ci] / c.maxHp) * 100);
                    const col = pct > 60 ? ELEMENT_COLORS[c.element] : pct > 30 ? "#ffaa00" : "#ff2244";
                    const decision = decisions?.[ci];
                    const active = inArena && fightSlot === ci;
                    return (
                      <div key={ci} className={`flex items-center gap-2 py-1 ${dead ? "opacity-25" : ""} ${active ? "brightness-125" : ""}`}>
                        <Creature element={c.element} size={24} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-[family-name:var(--font-press-start)] text-[10px]" style={{ color: ELEMENT_COLORS[c.element] }}>
                              {CARD_NAMES[c.element]}
                            </span>
                            {decision && !dead && phase !== "waiting" && (
                              <span className="font-[family-name:var(--font-press-start)] text-[8px] px-1 py-0.5 border"
                                style={{
                                  borderColor: decision.action === "ATTACK" ? "#ff4400" : "#0088ff",
                                  color: decision.action === "ATTACK" ? "#ff4400" : "#0088ff",
                                  background: decision.action === "ATTACK" ? "#ff440015" : "#0088ff15",
                                }}>
                                {decision.action}
                              </span>
                            )}
                            <span className="font-[family-name:var(--font-press-start)] text-[10px]" style={{ color: col }}>{hp[ci]}/{c.maxHp}</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#0a0a0a] border border-white/10 overflow-hidden mt-0.5">
                            <div className="h-full hp-bar-fill" style={{ width: `${pct}%`, background: col, boxShadow: `0 0 6px ${col}40` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ═══ ARENA ═══ */}
          <div className="pixel-border flex-1 min-h-[320px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              background: inArena
                ? `radial-gradient(circle, ${ELEMENT_COLORS[p1Cards[fightSlot]?.element ?? 0]}30 0%, transparent 50%)`
                : "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            }} />

            {inArena && lastTurn ? (
              <div className="relative z-10 flex items-center w-full justify-between px-8">
                {/* P1 */}
                <div className={`transition-all duration-500 ${phase === "damage" ? "translate-x-16 scale-110" : ""}`}>
                  <div className="relative">
                    <div style={{ filter: `drop-shadow(0 0 24px ${ELEMENT_COLORS[p1Cards[fightSlot].element]}80)` }}>
                      <Creature element={p1Cards[fightSlot].element} size={150} />
                    </div>
                    {dmg.p1 !== null && dmg.p1 > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 font-[family-name:var(--font-press-start)] text-2xl animate-damage"
                        style={{ color: "#ff2244", textShadow: "0 0 12px #ff224480" }}>-{dmg.p1}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  {phase === "damage" ? (
                    <span className="text-4xl animate-impact">💥</span>
                  ) : (
                    <span className="font-[family-name:var(--font-press-start)] text-lg text-white/60">VS</span>
                  )}
                </div>

                {/* P2 (mirrored) */}
                <div className={`transition-all duration-500 ${phase === "damage" ? "-translate-x-16 scale-110" : ""}`}>
                  <div className="relative">
                    <div style={{ filter: `drop-shadow(0 0 24px ${ELEMENT_COLORS[p2Cards[fightSlot].element]}80)`, transform: "scaleX(-1)" }}>
                      <Creature element={p2Cards[fightSlot].element} size={150} />
                    </div>
                    {dmg.p2 !== null && dmg.p2 > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 font-[family-name:var(--font-press-start)] text-2xl animate-damage"
                        style={{ color: "#ff2244", textShadow: "0 0 12px #ff224480" }}>-{dmg.p2}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 text-center space-y-4">
                {phase === "waiting" && turn === 0 && (
                  <>
                    <div className="flex justify-center items-center gap-12">
                      <div style={{ filter: "drop-shadow(0 0 20px #ff440050)" }}><Creature element={0} size={110} /></div>
                      <span className="font-[family-name:var(--font-press-start)] text-xl text-white/60">VS</span>
                      <div style={{ filter: "drop-shadow(0 0 20px #ffaa0050)", transform: "scaleX(-1)" }}><Creature element={2} size={110} /></div>
                    </div>
                    <span className="font-[family-name:var(--font-press-start)] text-xs text-white/30 animate-blink block">AI AGENTS BOOTING...</span>
                  </>
                )}
                {phase === "thinking" && (
                  <div className="space-y-2">
                    <span className="font-[family-name:var(--font-press-start)] text-xs text-white/50">AGENTS DECIDING...</span>
                    <div className="flex justify-center gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-white/30" style={{ animation: `blink 1s ${i * 0.3}s step-end infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                {phase === "turnEnd" && (
                  <span className="font-[family-name:var(--font-press-start)] text-sm text-white animate-slide-up">TURN {turn} COMPLETE</span>
                )}
                {phase === "waiting" && turn > 0 && (
                  <span className="font-[family-name:var(--font-press-start)] text-xs text-white/30">NEXT TURN...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT — Logs + AI Reasoning ═══ */}
        <div className="w-[360px] shrink-0 flex flex-col gap-3">

          {/* AI Reasoning panel */}
          <div className="pixel-border p-3">
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 mb-3">AI AGENT REASONING</div>
            {displayDecisions ? (
              <div className="space-y-3">
                {[0, 1].map(pi => {
                  const cards = pi === 0 ? p1Cards : p2Cards;
                  const decisions = pi === 0 ? displayDecisions.p1 : displayDecisions.p2;
                  const hp = pi === 0 ? displayHp.p1 : displayHp.p2;
                  return (
                    <div key={pi}>
                      <div className="font-[family-name:var(--font-press-start)] text-[9px] mb-1.5" style={{ color: pi === 0 ? "#0088ff" : "#ff4400" }}>
                        {pi === 0 ? "P1" : "P2"}
                      </div>
                      {decisions.map((d, ci) => {
                        if (hp[ci] <= 0) return null;
                        return (
                          <div key={ci} className="mb-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Creature element={cards[ci].element} size={16} />
                              <span className="font-[family-name:var(--font-press-start)] text-[8px]" style={{ color: ELEMENT_COLORS[cards[ci].element] }}>
                                {CARD_NAMES[cards[ci].element]}
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
                              {d.reasoning.slice(0, phase === "thinking" ? thinkingLine : 99).map((line, li) => (
                                <div key={li} className="font-mono text-[13px] text-white/60 flex items-start gap-1">
                                  <span className="text-white/40 shrink-0">{'>'}</span>
                                  <span>{line}</span>
                                </div>
                              ))}
                              {phase === "thinking" && thinkingLine < d.reasoning.length && (
                                <span className="font-mono text-[13px] text-white/60 animate-blink ml-2.5">_</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-white/50 text-xs text-center py-6 font-mono animate-blink">
                Waiting for agents...
              </div>
            )}
          </div>

          {/* Battle log */}
          <div className="pixel-border p-3 flex-1">
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 mb-2">BATTLE LOG</div>
            <div ref={logRef} className="h-full max-h-[300px] overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-white/50 text-xs text-center py-6 font-mono animate-blink">AI agents initializing...</div>
              ) : logs.map((l, i) => (
                <div key={i} className="font-mono text-[13px] flex items-start gap-1.5">
                  <span className="text-white/40 text-[12px] shrink-0">T{l.turn}</span>
                  <span style={{ color: l.color }}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Victory */}
      {isVictory && winner && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="text-center space-y-8 animate-slide-up">
            <div style={{ filter: `drop-shadow(0 0 40px ${winner === "p1" ? "#ff440060" : "#0088ff60"})` }}>
              <Creature element={winner === "p1" ? p1Cards[0].element : p2Cards[0].element} size={180} />
            </div>
            <h1 className="font-[family-name:var(--font-press-start)] text-3xl"
              style={{
                background: "linear-gradient(90deg, #ff4400, #ffaa00, #0088ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >{winner === "p1" ? "VICTORY!" : winner === "p2" ? "DEFEATED" : "DRAW"}</h1>
            <p className="font-[family-name:var(--font-press-start)] text-sm text-white/50">
              {winner === "draw" ? "Both players refunded" : `${winner === "p1" ? "You" : "Opponent"} won `}
              {winner !== "draw" && <span className="text-white">200 USDC</span>}
            </p>
            <p className="font-mono text-white/30">Settled in {turn} turns</p>
            <div className="flex gap-4 justify-center">
              <Link href="/result/1" className="pixel-btn text-xs">VIEW RESULTS</Link>
              <Link href="/lobby" className="pixel-btn text-xs">BACK TO LOBBY</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
