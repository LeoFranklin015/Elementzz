// Elementzz AI Agent — runs entirely client-side
// Decides ATTACK or DEFEND based on strategy + game state

export type Action = "ATTACK" | "DEFEND";
export type Strategy = "aggressive" | "balanced" | "defensive";

export interface CardState {
  element: 0 | 1 | 2; // Fire, Water, Lightning
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
}

export interface Decision {
  action: Action;
  reasoning: string[];
  confidence: number; // 0-100
}

export const STRATEGIES: Record<Strategy, { name: string; desc: string; color: string }> = {
  aggressive: {
    name: "BERSERKER",
    desc: "All-out attack. Only defends when about to die. High risk, high reward.",
    color: "#ff4400",
  },
  balanced: {
    name: "TACTICIAN",
    desc: "Reads the matchup. Presses advantages, defends when outmatched.",
    color: "#ffaa00",
  },
  defensive: {
    name: "GUARDIAN",
    desc: "Plays safe. Defends often, regens HP, waits for openings to strike.",
    color: "#0088ff",
  },
};

// Elemental multiplier table (scaled x100)
const MULT: Record<number, Record<number, number>> = {
  0: { 0: 120, 1: 50, 2: 200 },  // Fire
  1: { 0: 200, 1: 120, 2: 50 },   // Water
  2: { 0: 50, 1: 200, 2: 120 },   // Lightning
};

const ELEMENT_NAMES = ["Fire", "Water", "Lightning"];

export function calcDamage(attacker: CardState, defender: CardState, defenderDefending: boolean): number {
  const mult = MULT[attacker.element][defender.element];
  const rawAtk = Math.floor((attacker.atk * mult) / 100);
  let net = rawAtk > defender.def ? rawAtk - defender.def : 1;
  if (defenderDefending) {
    net = net > 1 ? Math.floor(net / 2) : 1;
  }
  return net;
}

// ── AGGRESSIVE strategy ──────────────────────────────────────────────
function decideAggressive(my: CardState, opp: CardState): Decision {
  const reasoning: string[] = [];
  const myDmg = calcDamage(my, opp, false);
  const incomingDmg = calcDamage(opp, my, false);
  const incomingIfDefend = calcDamage(opp, my, true);
  const canKill = myDmg >= opp.hp;
  const wouldDie = incomingDmg >= my.hp;
  const surviveIfDefend = incomingIfDefend < my.hp;

  // Stalemate breaker: if both sides deal very low damage, defending just
  // extends the game forever (regen +2 outpaces halved damage). Always attack.
  if (myDmg <= 2 && incomingDmg <= 2) {
    reasoning.push(`Low dmg matchup (${myDmg} vs ${incomingDmg}) — defending stalls`);
    reasoning.push("ATTACK TO BREAK STALEMATE");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  if (canKill) {
    reasoning.push(`Lethal! ${myDmg} dmg kills (${opp.hp} HP)`);
    reasoning.push("FINISH THEM");
    return { action: "ATTACK", reasoning, confidence: 99 };
  }

  // Only defend if literally about to die AND defending saves
  if (wouldDie && surviveIfDefend && my.hp <= 3) {
    reasoning.push(`Critical HP (${my.hp}) — one hit kill`);
    reasoning.push(`Defending to survive: ${incomingIfDefend} dmg`);
    reasoning.push("LAST RESORT DEFEND");
    return { action: "DEFEND", reasoning, confidence: 80 };
  }

  // Everything else: ATTACK
  if (wouldDie) {
    reasoning.push(`Taking ${incomingDmg} dmg but won't back down`);
    reasoning.push("NO RETREAT");
  } else {
    reasoning.push(`Dealing ${myDmg} dmg, taking ${incomingDmg}`);
    reasoning.push("ALWAYS ATTACK");
  }
  return { action: "ATTACK", reasoning, confidence: 90 };
}

// ── BALANCED strategy ────────────────────────────────────────────────
function decideBalanced(my: CardState, opp: CardState): Decision {
  const reasoning: string[] = [];
  const myMult = MULT[my.element][opp.element];
  const myDmg = calcDamage(my, opp, false);
  const incomingDmg = calcDamage(opp, my, false);
  const incomingIfDefend = calcDamage(opp, my, true);
  const hpRatio = my.hp / my.maxHp;
  const canKill = myDmg >= opp.hp;
  const wouldDie = incomingDmg >= my.hp;
  const surviveIfDefend = incomingIfDefend < my.hp;
  const hasAdvantage = myMult === 200;
  const hasDisadvantage = myMult === 50;

  // Stalemate breaker: if both sides deal very low damage, defending just
  // extends the game forever (regen +2 outpaces halved damage). Always attack.
  if (myDmg <= 2 && incomingDmg <= 2) {
    reasoning.push(`Low dmg matchup (${myDmg} vs ${incomingDmg}) — defending stalls`);
    reasoning.push("ATTACK TO BREAK STALEMATE");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  if (canKill) {
    reasoning.push(`Can kill (${myDmg} dmg vs ${opp.hp} HP)`);
    reasoning.push("GO FOR THE KILL");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  if (wouldDie && surviveIfDefend) {
    reasoning.push(`Incoming ${incomingDmg} would kill (${my.hp} HP)`);
    reasoning.push(`Defend reduces to ${incomingIfDefend} — survive`);
    reasoning.push("DEFEND TO SURVIVE");
    return { action: "DEFEND", reasoning, confidence: 90 };
  }

  if (wouldDie && !surviveIfDefend) {
    reasoning.push(`Will die regardless — ${incomingDmg} vs ${my.hp} HP`);
    reasoning.push("GO DOWN SWINGING");
    return { action: "ATTACK", reasoning, confidence: 85 };
  }

  if (hasAdvantage) {
    reasoning.push(`${ELEMENT_NAMES[my.element]} 2x vs ${ELEMENT_NAMES[opp.element]}`);
    reasoning.push(`Dealing ${myDmg} per hit`);
    reasoning.push("PRESS ADVANTAGE");
    return { action: "ATTACK", reasoning, confidence: 80 };
  }

  if (hpRatio < 0.35 && hasDisadvantage) {
    reasoning.push(`Low HP (${Math.round(hpRatio * 100)}%) + disadvantage`);
    reasoning.push("TURTLE AND REGEN");
    return { action: "DEFEND", reasoning, confidence: 70 };
  }

  if (myDmg >= 4) {
    reasoning.push(`Good output: ${myDmg}/hit, ${Math.ceil(opp.hp / myDmg)} hits to kill`);
    reasoning.push("KEEP HITTING");
    return { action: "ATTACK", reasoning, confidence: 65 };
  }

  if (myDmg <= 2 && incomingDmg > 2 && hpRatio > 0.6) {
    reasoning.push(`Low damage (${myDmg}) but taking ${incomingDmg} — not worth trading`);
    reasoning.push("PLAY DEFENSIVE");
    return { action: "DEFEND", reasoning, confidence: 55 };
  }

  reasoning.push(`Dealing ${myDmg}, taking ${incomingDmg}`);
  reasoning.push("ATTACK BY DEFAULT");
  return { action: "ATTACK", reasoning, confidence: 50 };
}

// ── DEFENSIVE strategy ───────────────────────────────────────────────
function decideDefensive(my: CardState, opp: CardState): Decision {
  const reasoning: string[] = [];
  const myMult = MULT[my.element][opp.element];
  const myDmg = calcDamage(my, opp, false);
  const incomingDmg = calcDamage(opp, my, false);
  const incomingIfDefend = calcDamage(opp, my, true);
  const hpRatio = my.hp / my.maxHp;
  const canKill = myDmg >= opp.hp;
  const hasAdvantage = myMult === 200;

  // Stalemate breaker: if both sides deal very low damage, defending just
  // extends the game forever (regen +2 outpaces halved damage). Always attack.
  if (myDmg <= 2 && incomingDmg <= 2) {
    reasoning.push(`Low dmg matchup (${myDmg} vs ${incomingDmg}) — defending stalls`);
    reasoning.push("ATTACK TO BREAK STALEMATE");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  // Always take the kill
  if (canKill) {
    reasoning.push(`Lethal available: ${myDmg} vs ${opp.hp} HP`);
    reasoning.push("STRIKE NOW");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  // Strong advantage + opp is low → attack to close it out
  if (hasAdvantage && opp.hp <= opp.maxHp * 0.4) {
    reasoning.push(`Advantage + opp low (${opp.hp}/${opp.maxHp})`);
    reasoning.push("PRESS FOR THE FINISH");
    return { action: "ATTACK", reasoning, confidence: 75 };
  }

  // If healthy and damage is decent, occasionally attack
  if (hpRatio > 0.7 && myDmg >= 5 && hasAdvantage) {
    reasoning.push(`Healthy (${Math.round(hpRatio * 100)}%) with advantage`);
    reasoning.push(`Dealing ${myDmg} — worth the trade`);
    reasoning.push("CALCULATED STRIKE");
    return { action: "ATTACK", reasoning, confidence: 65 };
  }

  // If my damage is too low, defending just slows the game with no real benefit.
  // Attack to make progress instead.
  if (myDmg <= 2) {
    reasoning.push(`Low damage (${myDmg}) — defending just prolongs the fight`);
    reasoning.push("ATTACK TO MAKE PROGRESS");
    return { action: "ATTACK", reasoning, confidence: 60 };
  }

  // Default: DEFEND
  const saved = incomingDmg - incomingIfDefend;
  reasoning.push(`Defending: take ${incomingIfDefend} instead of ${incomingDmg} (save ${saved})`);
  reasoning.push(`Regen +2 HP, net loss: ${Math.max(0, incomingIfDefend - 2)}`);
  if (hpRatio < 0.5) {
    reasoning.push("HOLD THE LINE");
  } else {
    reasoning.push("PATIENCE WINS");
  }
  return { action: "DEFEND", reasoning, confidence: 80 };
}

// ── Main decide function with strategy ───────────────────────────────
export function decide(my: CardState, opp: CardState, strategy: Strategy = "balanced"): Decision {
  switch (strategy) {
    case "aggressive": return decideAggressive(my, opp);
    case "balanced": return decideBalanced(my, opp);
    case "defensive": return decideDefensive(my, opp);
  }
}

// ── Simulate a full turn ─────────────────────────────────────────────
export interface TurnResult {
  p1Hp: number[];
  p2Hp: number[];
  p1Decisions: Decision[];
  p2Decisions: Decision[];
  fights: Array<{
    slot: number;
    p1Dmg: number;
    p2Dmg: number;
    p1Action: Action;
    p2Action: Action;
    p1Dead: boolean;
    p2Dead: boolean;
  }>;
  settled: boolean;
  winner: "p1" | "p2" | "draw" | null;
}

export function simulateTurn(
  p1Cards: CardState[],
  p2Cards: CardState[],
  p1Strategy: Strategy = "balanced",
  p2Strategy: Strategy = "balanced",
): TurnResult {
  const p1Decisions = p1Cards.map((c, i) =>
    c.hp > 0 ? decide(c, p2Cards[i], p1Strategy) : { action: "ATTACK" as Action, reasoning: ["DEAD"], confidence: 0 }
  );
  const p2Decisions = p2Cards.map((c, i) =>
    c.hp > 0 ? decide(c, p1Cards[i], p2Strategy) : { action: "ATTACK" as Action, reasoning: ["DEAD"], confidence: 0 }
  );

  const p1Hp = [...p1Cards.map(c => c.hp)];
  const p2Hp = [...p2Cards.map(c => c.hp)];
  const fights: TurnResult["fights"] = [];

  for (let i = 0; i < 2; i++) {
    if (p1Hp[i] <= 0 && p2Hp[i] <= 0) continue;

    const p1Dmg = p1Hp[i] > 0 ? calcDamage(p1Cards[i], p2Cards[i], p2Decisions[i].action === "DEFEND") : 0;
    const p2Dmg = p2Hp[i] > 0 ? calcDamage(p2Cards[i], p1Cards[i], p1Decisions[i].action === "DEFEND") : 0;

    p1Hp[i] = Math.max(0, p1Hp[i] - p2Dmg);
    p2Hp[i] = Math.max(0, p2Hp[i] - p1Dmg);

    if (p1Decisions[i].action === "DEFEND" && p1Hp[i] > 0) {
      p1Hp[i] = Math.min(p1Cards[i].maxHp, p1Hp[i] + 2);
    }
    if (p2Decisions[i].action === "DEFEND" && p2Hp[i] > 0) {
      p2Hp[i] = Math.min(p2Cards[i].maxHp, p2Hp[i] + 2);
    }

    fights.push({ slot: i, p1Dmg, p2Dmg, p1Action: p1Decisions[i].action, p2Action: p2Decisions[i].action, p1Dead: p1Hp[i] <= 0, p2Dead: p2Hp[i] <= 0 });
  }

  const p1AllDead = p1Hp.every(h => h <= 0);
  const p2AllDead = p2Hp.every(h => h <= 0);
  const stalemate = p1Hp.every((h, i) => !(h > 0 && p2Hp[i] > 0));

  let settled = false;
  let winner: TurnResult["winner"] = null;

  if (p1AllDead && p2AllDead) { settled = true; winner = "draw"; }
  else if (p1AllDead) { settled = true; winner = "p2"; }
  else if (p2AllDead) { settled = true; winner = "p1"; }
  else if (stalemate) {
    settled = true;
    const p1Total = p1Hp.reduce((a, b) => a + b, 0);
    const p2Total = p2Hp.reduce((a, b) => a + b, 0);
    winner = p1Total > p2Total ? "p1" : p2Total > p1Total ? "p2" : "draw";
  }

  return { p1Hp, p2Hp, p1Decisions, p2Decisions, fights, settled, winner };
}
