// CardBattle AI Agent — runs entirely client-side
// Decides ATTACK or DEFEND based on game state

export type Action = "ATTACK" | "DEFEND";

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

// Elemental multiplier table (scaled x100)
// [attacker][defender]
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

export function decide(my: CardState, opp: CardState): Decision {
  const reasoning: string[] = [];

  const myMult = MULT[my.element][opp.element];
  const oppMult = MULT[opp.element][my.element];

  const myDmg = calcDamage(my, opp, false);
  const myDmgIfDefend = calcDamage(my, opp, true); // if opp defends, we still deal this
  const incomingDmg = calcDamage(opp, my, false);
  const incomingIfDefend = calcDamage(opp, my, true); // if we defend

  const hpRatio = my.hp / my.maxHp;
  const canKill = myDmg >= opp.hp;
  const wouldDie = incomingDmg >= my.hp;
  const surviveIfDefend = incomingIfDefend < my.hp;
  const hasAdvantage = myMult === 200;
  const hasDisadvantage = myMult === 50;

  // Rule 1: Can kill → always attack
  if (canKill) {
    reasoning.push(`Can kill opponent (${myDmg} dmg vs ${opp.hp} HP)`);
    reasoning.push("GO FOR THE KILL");
    return { action: "ATTACK", reasoning, confidence: 95 };
  }

  // Rule 2: Would die from attack AND defending saves us → defend
  if (wouldDie && surviveIfDefend) {
    reasoning.push(`Incoming ${incomingDmg} dmg would kill (${my.hp} HP)`);
    reasoning.push(`Defending reduces to ${incomingIfDefend} dmg — survive`);
    reasoning.push("DEFEND TO SURVIVE");
    return { action: "DEFEND", reasoning, confidence: 90 };
  }

  // Rule 3: Would die either way → attack (go down swinging)
  if (wouldDie && !surviveIfDefend) {
    reasoning.push(`Will die regardless (${incomingDmg} vs ${my.hp} HP)`);
    reasoning.push("GO DOWN SWINGING");
    return { action: "ATTACK", reasoning, confidence: 85 };
  }

  // Rule 4: Elemental advantage → attack aggressively
  if (hasAdvantage) {
    reasoning.push(`${ELEMENT_NAMES[my.element]} has 2x advantage vs ${ELEMENT_NAMES[opp.element]}`);
    reasoning.push(`Dealing ${myDmg} dmg per hit`);
    reasoning.push("PRESS THE ADVANTAGE");
    return { action: "ATTACK", reasoning, confidence: 80 };
  }

  // Rule 5: Low HP + disadvantage → defend and regen
  if (hpRatio < 0.35 && hasDisadvantage) {
    reasoning.push(`Low HP (${Math.round(hpRatio * 100)}%) with elemental disadvantage`);
    reasoning.push(`Defending: take ${incomingIfDefend} instead of ${incomingDmg}, regen +2`);
    reasoning.push("TURTLE AND REGEN");
    return { action: "DEFEND", reasoning, confidence: 70 };
  }

  // Rule 6: Good damage output → attack
  if (myDmg >= 4) {
    reasoning.push(`Solid damage output: ${myDmg} per hit`);
    reasoning.push(`Opponent at ${opp.hp}/${opp.maxHp} HP — ${Math.ceil(opp.hp / myDmg)} hits to kill`);
    reasoning.push("KEEP HITTING");
    return { action: "ATTACK", reasoning, confidence: 65 };
  }

  // Rule 7: Low damage + healthy → defend to outlast
  if (myDmg <= 2 && hpRatio > 0.6) {
    reasoning.push(`Low damage (${myDmg}) — not worth trading`);
    reasoning.push(`Healthy at ${Math.round(hpRatio * 100)}% — can afford to wait`);
    reasoning.push("PLAY DEFENSIVE");
    return { action: "DEFEND", reasoning, confidence: 55 };
  }

  // Default: attack
  reasoning.push(`Standard play — dealing ${myDmg}, taking ${incomingDmg}`);
  reasoning.push("ATTACK BY DEFAULT");
  return { action: "ATTACK", reasoning, confidence: 50 };
}

// Simulate a full turn and return results
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
): TurnResult {
  const p1Decisions = p1Cards.map((c, i) =>
    c.hp > 0 ? decide(c, p2Cards[i]) : { action: "ATTACK" as Action, reasoning: ["DEAD"], confidence: 0 }
  );
  const p2Decisions = p2Cards.map((c, i) =>
    c.hp > 0 ? decide(c, p1Cards[i]) : { action: "ATTACK" as Action, reasoning: ["DEAD"], confidence: 0 }
  );

  const p1Hp = [...p1Cards.map(c => c.hp)];
  const p2Hp = [...p2Cards.map(c => c.hp)];
  const fights: TurnResult["fights"] = [];

  for (let i = 0; i < 2; i++) {
    if (p1Hp[i] <= 0 && p2Hp[i] <= 0) continue;

    const p1Dmg = p1Hp[i] > 0
      ? calcDamage(p1Cards[i], p2Cards[i], p2Decisions[i].action === "DEFEND")
      : 0;
    const p2Dmg = p2Hp[i] > 0
      ? calcDamage(p2Cards[i], p1Cards[i], p1Decisions[i].action === "DEFEND")
      : 0;

    // Apply damage simultaneously
    p1Hp[i] = Math.max(0, p1Hp[i] - p2Dmg);
    p2Hp[i] = Math.max(0, p2Hp[i] - p1Dmg);

    // Defend regen (+2, capped at max)
    if (p1Decisions[i].action === "DEFEND" && p1Hp[i] > 0) {
      p1Hp[i] = Math.min(p1Cards[i].maxHp, p1Hp[i] + 2);
    }
    if (p2Decisions[i].action === "DEFEND" && p2Hp[i] > 0) {
      p2Hp[i] = Math.min(p2Cards[i].maxHp, p2Hp[i] + 2);
    }

    fights.push({
      slot: i,
      p1Dmg,
      p2Dmg,
      p1Action: p1Decisions[i].action,
      p2Action: p2Decisions[i].action,
      p1Dead: p1Hp[i] <= 0,
      p2Dead: p2Hp[i] <= 0,
    });
  }

  // Check win conditions
  const p1AllDead = p1Hp.every(h => h <= 0);
  const p2AllDead = p2Hp.every(h => h <= 0);

  // Stalemate check
  const stalemate = p1Hp.every((h, i) => !(h > 0 && p2Hp[i] > 0));

  let settled = false;
  let winner: TurnResult["winner"] = null;

  if (p1AllDead && p2AllDead) {
    settled = true;
    winner = "draw";
  } else if (p1AllDead) {
    settled = true;
    winner = "p2";
  } else if (p2AllDead) {
    settled = true;
    winner = "p1";
  } else if (stalemate) {
    settled = true;
    const p1Total = p1Hp.reduce((a, b) => a + b, 0);
    const p2Total = p2Hp.reduce((a, b) => a + b, 0);
    winner = p1Total > p2Total ? "p1" : p2Total > p1Total ? "p2" : "draw";
  }

  return { p1Hp, p2Hp, p1Decisions, p2Decisions, fights, settled, winner };
}
