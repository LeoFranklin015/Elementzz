"use client";

import { useState, useCallback } from "react";
import { type CardState, type Decision, type Action, simulateTurn } from "./agent";

export interface BattleCard extends CardState {
  address?: string;
}

export interface FightEvent {
  slot: number;
  p1Dmg: number;
  p2Dmg: number;
  p1Action: Action;
  p2Action: Action;
}

export interface TurnEvent {
  turn: number;
  fights: FightEvent[];
  p1Decisions: Decision[];
  p2Decisions: Decision[];
  hpAfter: { p1: number[]; p2: number[] };
  logs: Array<{ text: string; color: string }>;
}

const NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];
const COLORS = ["#ff4400", "#0088ff", "#ffaa00"];

function buildLogs(
  turn: number,
  fights: FightEvent[],
  p1Cards: BattleCard[],
  p2Cards: BattleCard[],
  p1Hp: number[],
  p2Hp: number[],
): Array<{ text: string; color: string }> {
  const logs: Array<{ text: string; color: string }> = [];

  for (const f of fights) {
    const p1Name = NAMES[p1Cards[f.slot].element];
    const p2Name = NAMES[p2Cards[f.slot].element];

    if (f.p1Dmg > 0) {
      const ko = p2Hp[f.slot] <= 0;
      logs.push({
        text: `${p1Name} deals ${f.p1Dmg} to ${p2Name}${ko ? " — KNOCKOUT!" : ""}`,
        color: ko ? "#ff2244" : COLORS[p1Cards[f.slot].element],
      });
    }
    if (f.p2Dmg > 0) {
      const ko = p1Hp[f.slot] <= 0;
      logs.push({
        text: `${p2Name} deals ${f.p2Dmg} to ${p1Name}${ko ? " — KNOCKOUT!" : ""}`,
        color: ko ? "#ff2244" : COLORS[p2Cards[f.slot].element],
      });
    }
    if (f.p1Action === "DEFEND" && p1Hp[f.slot] > 0) {
      logs.push({ text: `${p1Name} defended + regen`, color: COLORS[p1Cards[f.slot].element] });
    }
    if (f.p2Action === "DEFEND" && p2Hp[f.slot] > 0) {
      logs.push({ text: `${p2Name} defended + regen`, color: COLORS[p2Cards[f.slot].element] });
    }
  }

  return logs;
}

export function useBattle(initialP1: BattleCard[], initialP2: BattleCard[]) {
  const [p1Cards, setP1Cards] = useState<BattleCard[]>(initialP1);
  const [p2Cards, setP2Cards] = useState<BattleCard[]>(initialP2);
  const [turn, setTurn] = useState(0);
  const [turns, setTurns] = useState<TurnEvent[]>([]);
  const [settled, setSettled] = useState(false);
  const [winner, setWinner] = useState<"p1" | "p2" | "draw" | null>(null);
  const [currentDecisions, setCurrentDecisions] = useState<{ p1: Decision[]; p2: Decision[] } | null>(null);

  const playTurn = useCallback(() => {
    if (settled) return null;

    const result = simulateTurn(p1Cards, p2Cards);
    const newTurn = turn + 1;

    // Update card HP
    const newP1 = p1Cards.map((c, i) => ({ ...c, hp: result.p1Hp[i] }));
    const newP2 = p2Cards.map((c, i) => ({ ...c, hp: result.p2Hp[i] }));

    const logs = buildLogs(newTurn, result.fights, p1Cards, p2Cards, result.p1Hp, result.p2Hp);

    if (result.settled && result.winner) {
      const winLabel = result.winner === "p1" ? "P1 WINS" : result.winner === "p2" ? "P2 WINS" : "DRAW";
      logs.push({ text: `>>> ${winLabel} <<<`, color: "#ffffff" });
    }

    const turnEvent: TurnEvent = {
      turn: newTurn,
      fights: result.fights,
      p1Decisions: result.p1Decisions,
      p2Decisions: result.p2Decisions,
      hpAfter: { p1: result.p1Hp, p2: result.p2Hp },
      logs,
    };

    setP1Cards(newP1);
    setP2Cards(newP2);
    setTurn(newTurn);
    setTurns(prev => [...prev, turnEvent]);
    setCurrentDecisions({ p1: result.p1Decisions, p2: result.p2Decisions });

    if (result.settled) {
      setSettled(true);
      setWinner(result.winner);
    }

    // Check max turns
    if (newTurn >= 20 && !result.settled) {
      setSettled(true);
      const p1Total = result.p1Hp.reduce((a, b) => a + b, 0);
      const p2Total = result.p2Hp.reduce((a, b) => a + b, 0);
      setWinner(p1Total > p2Total ? "p1" : p2Total > p1Total ? "p2" : "draw");
    }

    return turnEvent;
  }, [p1Cards, p2Cards, turn, settled]);

  return {
    p1Cards,
    p2Cards,
    turn,
    turns,
    settled,
    winner,
    currentDecisions,
    playTurn,
  };
}
