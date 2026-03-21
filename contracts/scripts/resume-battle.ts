/**
 * Resume/Fresh CardBattle — Base Sepolia
 *
 * Reuses existing MockUSDC & CardFactory. Deploys a FRESH BattleRoom
 * and re-onboards players with new cards (since old cards are locked in old room).
 *
 * Run:
 *   npx hardhat run scripts/resume-battle.ts --network baseSepolia
 */

import { network } from "hardhat";
import { encodeFunctionData, parseAbi, formatUnits, type Address } from "viem";

const EXPLORER = "https://sepolia.basescan.org";
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

// Already deployed — reuse these
const USDC_ADDR       = "0x2d51dbd834288c2976d0c9a0ec7be6af02dbd3e2" as Address;
const FACTORY_ADDR    = "0xc8ba6f5056666eb6b5e2ea5153f00b2edfacad8a" as Address;
const BATTLEROOM_ADDR = "0x2854930771dcd3d66ab9d6bca8d1aff80244f0a4" as Address;
const SKIP_DEPLOY     = false;

const STAKE = 100_000_000n; // 100 USDC
const battleAbi = parseAbi(["function attack()", "function defend()"]);

function txLink(hash: string) { return `${EXPLORER}/tx/${hash}`; }
function addrLink(addr: string) { return `${EXPLORER}/address/${addr}`; }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, player1, player2] = await viem.getWalletClients();

  const usdc = await viem.getContractAt("MockUSDC", USDC_ADDR);

  async function writeAs(wallet: any, contract: { address: Address; abi: any }, fn: string, args: any[] = [], gasOverride?: bigint): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await sleep(1500); // rate limit buffer
        const opts: any = {
          address: contract.address,
          abi: contract.abi,
          functionName: fn,
          args,
        };
        if (gasOverride) opts.gas = gasOverride;
        const h = await wallet.writeContract(opts);
        console.log(`    waiting...`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: h, confirmations: 1 });
        if (receipt.status === "reverted") throw new Error(`TX REVERTED: ${fn}() — ${txLink(h)}`);
        console.log(`    confirmed (block ${receipt.blockNumber})`);
        return h;
      } catch (e: any) {
        if (attempt < 3 && e.message?.includes("unexpected status")) {
          console.log(`    RPC error, retrying (${attempt}/3)...`);
          await sleep(3000);
        } else {
          throw e;
        }
      }
    }
    throw new Error("unreachable");
  }

  console.log("=".repeat(60));
  console.log("  CARDBATTLE — FRESH BATTLE ON BASE SEPOLIA");
  console.log("=".repeat(60));
  console.log();
  console.log("Reusing MockUSDC:", addrLink(USDC_ADDR));
  console.log();

  let factory: any;
  let battleRoom: any;
  let hash: string;

  if (SKIP_DEPLOY) {
    console.log("─── Using existing CardFactory & BattleRoom ───");
    factory = await viem.getContractAt("CardFactory", FACTORY_ADDR);
    battleRoom = await viem.getContractAt("BattleRoom", BATTLEROOM_ADDR);
    console.log("  CardFactory:", factory.address);
    console.log("  BattleRoom:", battleRoom.address);

    // Check if allowRoom was already done
    const allowed = await factory.read.allowedRooms([battleRoom.address]);
    if (!allowed) {
      console.log("  Allowing BattleRoom in factory...");
      hash = await writeAs(deployer, factory, "allowRoom", [battleRoom.address]);
      console.log("  Allowed!");
    } else {
      console.log("  BattleRoom already allowed");
    }
    console.log();
  } else {
    console.log("─── Deploying fresh CardFactory & BattleRoom ───");
    factory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
    console.log("  CardFactory:", factory.address, addrLink(factory.address));
    await sleep(3000);
    battleRoom = await viem.deployContract("BattleRoom", [usdc.address, factory.address]);
    console.log("  BattleRoom:", battleRoom.address, addrLink(battleRoom.address));
    await sleep(3000);
    hash = await writeAs(deployer, factory, "allowRoom", [battleRoom.address]);
    console.log("  BattleRoom allowed");
    console.log();
  }

  // ─── Mint USDC if needed ────────────────────────────────────────────
  const p1Bal = await usdc.read.balanceOf([player1.account.address]) as bigint;
  const p2Bal = await usdc.read.balanceOf([player2.account.address]) as bigint;
  console.log(`  P1 USDC balance: ${formatUnits(p1Bal, 6)}`);
  console.log(`  P2 USDC balance: ${formatUnits(p2Bal, 6)}`);

  if (p1Bal < STAKE) {
    hash = await writeAs(deployer, usdc, "mint", [player1.account.address, STAKE * 5n]);
    console.log("  Minted USDC to P1");
  }
  if (p2Bal < STAKE) {
    hash = await writeAs(deployer, usdc, "mint", [player2.account.address, STAKE * 5n]);
    console.log("  Minted USDC to P2");
  }

  // ─── Approve ────────────────────────────────────────────────────────
  console.log("  Players approving BattleRoom...");
  hash = await writeAs(player1, usdc, "approve", [battleRoom.address, STAKE * 5n]);
  hash = await writeAs(player2, usdc, "approve", [battleRoom.address, STAKE * 5n]);
  console.log();

  // ─── Onboard (skip if already onboarded) ─────────────────────────────
  console.log("─── Onboarding players ───");

  const p1HasCards = await factory.read.hasCards([player1.account.address]);
  if (!p1HasCards) {
    hash = await writeAs(player1, factory, "onboard");
    console.log(`  P1 onboarded — tx: ${txLink(hash)}`);
    await sleep(2000);
  } else {
    console.log("  P1 already onboarded");
  }

  const p2HasCards = await factory.read.hasCards([player2.account.address]);
  if (!p2HasCards) {
    hash = await writeAs(player2, factory, "onboard");
    console.log(`  P2 onboarded — tx: ${txLink(hash)}`);
    await sleep(2000);
  } else {
    console.log("  P2 already onboarded");
  }

  const [p1Card1, p1Card2] = await factory.read.getCards([player1.account.address]);
  const [p2Card1, p2Card2] = await factory.read.getCards([player2.account.address]);

  if (p1Card1 === "0x0000000000000000000000000000000000000000") throw new Error("P1 cards zero");
  if (p2Card1 === "0x0000000000000000000000000000000000000000") throw new Error("P2 cards zero");

  const ELEMENTS = ["Fire", "Water", "Lightning"];
  const allCards = [p1Card1, p1Card2, p2Card1, p2Card2];
  const cardStats = [];

  for (const addr of allCards) {
    const c = await viem.getContractAt("CardAgent", addr);
    const el = Number(await c.read.element());
    const atk = Number(await c.read.atk());
    const def_ = Number(await c.read.def());
    const hp = Number(await c.read.hp());
    const maxHp = Number(await c.read.maxHp());
    cardStats.push({ element: el, atk, def: def_, hp, maxHp });
  }

  console.log();
  console.log(`  P1 Card 0: ${ELEMENTS[cardStats[0].element]}  ATK=${cardStats[0].atk} DEF=${cardStats[0].def} HP=${cardStats[0].hp}  ${addrLink(p1Card1)}`);
  console.log(`  P1 Card 1: ${ELEMENTS[cardStats[1].element]}  ATK=${cardStats[1].atk} DEF=${cardStats[1].def} HP=${cardStats[1].hp}  ${addrLink(p1Card2)}`);
  console.log(`  P2 Card 0: ${ELEMENTS[cardStats[2].element]}  ATK=${cardStats[2].atk} DEF=${cardStats[2].def} HP=${cardStats[2].hp}  ${addrLink(p2Card1)}`);
  console.log(`  P2 Card 1: ${ELEMENTS[cardStats[3].element]}  ATK=${cardStats[3].atk} DEF=${cardStats[3].def} HP=${cardStats[3].hp}  ${addrLink(p2Card2)}`);
  console.log();

  // ─── Create & Join room (skip if already active) ─────────────────────
  const preState = Number(await battleRoom.read.state());
  console.log(`  Current BattleRoom state: ${preState} (0=WAITING, 1=ACTIVE, 2=SETTLED)`);

  if (preState === 0) {
    const p1w = await battleRoom.read.p1Wallet();
    if (p1w === "0x0000000000000000000000000000000000000000") {
      console.log("─── Creating room (P1 stakes 100 USDC) ───");
      hash = await writeAs(player1, battleRoom, "createRoom", [[p1Card1, p1Card2], STAKE]);
      console.log(`  Room created — tx: ${txLink(hash)}`);
    }

    console.log("─── P2 joining room ───");
    hash = await writeAs(player2, battleRoom, "joinRoom", [[p2Card1, p2Card2]]);
    console.log(`  Joined — BATTLE STARTS! tx: ${txLink(hash)}`);
  } else if (preState === 1) {
    console.log("  Battle already ACTIVE — resuming...");
  } else {
    console.log("  Battle already SETTLED");
  }
  console.log();

  // ─── Battle ─────────────────────────────────────────────────────────
  console.log("─── BATTLE ───");
  await sleep(3000);

  const rawState = await battleRoom.read.state();
  console.log(`  Raw state value: ${rawState} (type: ${typeof rawState})`);
  console.log(`  Number(state): ${Number(rawState)}`);
  console.log();

  const MULT: Record<number, Record<number, number>> = {
    0: { 0: 120, 1: 50, 2: 200 },
    1: { 0: 200, 1: 120, 2: 50 },
    2: { 0: 50, 1: 200, 2: 120 },
  };

  // P1 aggressive, P2 defensive
  function decideP1(my: any, opp: any): "attack" | "defend" {
    const oppMult = MULT[opp.element][my.element];
    const incomingDmg = Math.max(1, Math.floor((opp.atk * oppMult) / 100) - my.def);
    if (incomingDmg >= my.hp && my.hp <= 3) return "defend";
    return "attack";
  }

  function decideP2(my: any, opp: any): "attack" | "defend" {
    const myMult = MULT[my.element][opp.element];
    const myDmg = Math.max(1, Math.floor((my.atk * myMult) / 100) - opp.def);
    const oppMult = MULT[opp.element][my.element];
    const incomingDmg = Math.max(1, Math.floor((opp.atk * oppMult) / 100) - my.def);
    if (incomingDmg >= my.hp) return "defend";
    if (myMult === 200) return "attack";
    if (myDmg >= 3) return "attack";
    return my.hp % 2 === 0 ? "attack" : "defend";
  }

  const hp = { p1: [cardStats[0].hp, cardStats[1].hp], p2: [cardStats[2].hp, cardStats[3].hp] };
  const maxHp = { p1: [cardStats[0].maxHp, cardStats[1].maxHp], p2: [cardStats[2].maxHp, cardStats[3].maxHp] };
  const p1Stats = [cardStats[0], cardStats[1]];
  const p2Stats = [cardStats[2], cardStats[3]];
  const P1_CARDS = [p1Card1, p1Card2] as [Address, Address];
  const P2_CARDS = [p2Card1, p2Card2] as [Address, Address];

  for (let t = 1; t <= 20; t++) {
    if (Number(await battleRoom.read.state()) !== 1) break;

    console.log(`  == Turn ${t} ==`);
    console.log(`    HP: P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);

    // Submit actions for all alive cards, reading slot state to check submission status
    async function submitCard(
      playerCards: [Address, Address],
      wallet: any,
      decideFn: (my: any, opp: any) => "attack" | "defend",
      myStats: any[],
      oppStats: any[],
      myHp: number[],
      oppHp: number[],
      myMaxHp: number[],
      pLabel: string,
      getSlot: (i: bigint) => Promise<any>,
    ) {
      for (let i = 0; i < 2; i++) {
        if (myHp[i] <= 0) continue;

        // Check slot submission status first
        const slot = await getSlot(BigInt(i)) as any;
        console.log(`    ${pLabel} Slot ${i}: hp=${slot[4]}, submitted=${slot[7]}`);
        if (slot[7]) { console.log(`    ${pLabel} Card ${i} already submitted, skipping`); continue; }

        const action = decideFn(
          { ...myStats[i], hp: myHp[i], maxHp: myMaxHp[i] },
          { ...oppStats[i], hp: oppHp[i] }
        );
        console.log(`    ${pLabel} Card ${i} (${ELEMENTS[myStats[i].element]}): ${action.toUpperCase()}`);
        const card = await viem.getContractAt("CardAgent", playerCards[i]);
        hash = await writeAs(wallet, card, "execute", [battleRoom.address, encodeFunctionData({ abi: battleAbi, functionName: action })], 3_000_000n);

        // Log state after submission
        const stateAfter = Number(await battleRoom.read.state());
        console.log(`      state after: ${stateAfter}`);
        if (stateAfter !== 1) { console.log(`    >> Battle resolved!`); return; }
      }
    }

    await submitCard(P1_CARDS, player1, decideP1, p1Stats, p2Stats, hp.p1, hp.p2, maxHp.p1, "P1",
      (i: bigint) => battleRoom.read.getP1Slot([i]));

    if (Number(await battleRoom.read.state()) !== 1) { console.log(`    >> Resolved after P1!`); break; }

    await submitCard(P2_CARDS, player2, decideP2, p2Stats, p1Stats, hp.p2, hp.p1, maxHp.p2, "P2",
      (i: bigint) => battleRoom.read.getP2Slot([i]));

    await sleep(1000);
    const s = [
      await battleRoom.read.getP1Slot([0n]),
      await battleRoom.read.getP1Slot([1n]),
      await battleRoom.read.getP2Slot([0n]),
      await battleRoom.read.getP2Slot([1n]),
    ] as any[];
    hp.p1 = [Number(s[0][4]), Number(s[1][4])];
    hp.p2 = [Number(s[2][4]), Number(s[3][4])];

    console.log(`    >> P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);
    console.log();
  }

  // ─── Results ────────────────────────────────────────────────────────
  console.log();
  console.log("─── RESULTS ───");

  await sleep(3000);
  const currentBlock = await publicClient.getBlockNumber();
  const events = await publicClient.getContractEvents({
    address: battleRoom.address,
    abi: battleRoom.abi,
    eventName: "BattleResult",
    fromBlock: currentBlock - 500n, // last ~500 blocks
  });

  if (events.length > 0) {
    const r = events[0] as any;
    if (r.args.winner === "0x0000000000000000000000000000000000000000") {
      console.log("  DRAW — both players refunded");
    } else if (r.args.winner.toLowerCase() === player1.account.address.toLowerCase()) {
      console.log("  WINNER: PLAYER 1", player1.account.address);
    } else {
      console.log("  WINNER: PLAYER 2", player2.account.address);
    }
    console.log(`  Payout: ${formatUnits(r.args.usdcPaid, 6)} USDC`);
    console.log(`  Final turn: ${r.args.finalTurn}`);
  }

  console.log(`  P1 USDC: ${formatUnits(await usdc.read.balanceOf([player1.account.address]) as bigint, 6)}`);
  console.log(`  P2 USDC: ${formatUnits(await usdc.read.balanceOf([player2.account.address]) as bigint, 6)}`);
  console.log(`  BattleRoom USDC: ${formatUnits(await usdc.read.balanceOf([battleRoom.address]) as bigint, 6)}`);

  console.log();
  console.log("=".repeat(60));
  console.log("  EXPLORER LINKS");
  console.log("=".repeat(60));
  console.log(`  MockUSDC:     ${addrLink(USDC_ADDR)}`);
  console.log(`  CardFactory:  ${addrLink(factory.address)}`);
  console.log(`  BattleRoom:   ${addrLink(battleRoom.address)}`);
  console.log(`  P1 Card 0:    ${addrLink(p1Card1)}`);
  console.log(`  P1 Card 1:    ${addrLink(p1Card2)}`);
  console.log(`  P2 Card 0:    ${addrLink(p2Card1)}`);
  console.log(`  P2 Card 1:    ${addrLink(p2Card2)}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
