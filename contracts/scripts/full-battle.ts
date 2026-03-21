/**
 * Full CardBattle E2E Script — Base Sepolia
 *
 * Roles:
 *   KEY1 (deployer)  → deploys all contracts, mints MockUSDC
 *   KEY2 (player1)   → onboards, creates room, battles
 *   KEY3 (player2)   → onboards, joins room, battles
 *
 * Run:
 *   npx hardhat run scripts/full-battle.ts --network baseSepolia
 */

import { network } from "hardhat";
import { encodeFunctionData, parseAbi, formatUnits, type Address } from "viem";

const EXPLORER = "https://sepolia.basescan.org";
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const STAKE = 100_000_000n; // 100 USDC (6 decimals)

const battleAbi = parseAbi([
  "function attack()",
  "function defend()",
]);

function txLink(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}
function addrLink(addr: string) {
  return `${EXPLORER}/address/${addr}`;
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, player1, player2] = await viem.getWalletClients();

  console.log("=".repeat(70));
  console.log("  CARDBATTLE — FULL E2E ON BASE SEPOLIA");
  console.log("=".repeat(70));
  console.log();
  console.log("Deployer :", deployer.account.address, addrLink(deployer.account.address));
  console.log("Player 1 :", player1.account.address, addrLink(player1.account.address));
  console.log("Player 2 :", player2.account.address, addrLink(player2.account.address));
  console.log();

  // ─── 1. Deploy contracts ─────────────────────────────────────────────
  console.log("─── Step 1: Deploying contracts ───");

  console.log("Deploying MockUSDC...");
  const usdc = await viem.deployContract("MockUSDC");
  console.log("  MockUSDC:", usdc.address, addrLink(usdc.address));

  console.log("Deploying CardFactory (with ERC-8004 registry)...");
  const factory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
  console.log("  CardFactory:", factory.address, addrLink(factory.address));

  console.log("Deploying BattleRoom...");
  const battleRoom = await viem.deployContract("BattleRoom", [usdc.address, factory.address]);
  console.log("  BattleRoom:", battleRoom.address, addrLink(battleRoom.address));

  console.log("Allowing BattleRoom in factory...");
  let hash = await factory.write.allowRoom([battleRoom.address]);
  console.log("  tx:", txLink(hash));
  await publicClient.waitForTransactionReceipt({ hash });
  console.log();

  // Helper to write as a specific wallet
  async function writeAs(wallet: any, contract: { address: Address; abi: any }, fn: string, args: any[] = []) {
    const h = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: fn,
      args,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    return h;
  }

  // ─── 2. Mint USDC to players ─────────────────────────────────────────
  console.log("─── Step 2: Minting MockUSDC to players ───");

  hash = await usdc.write.mint([player1.account.address, STAKE * 10n]);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Minted ${formatUnits(STAKE * 10n, 6)} USDC to Player 1 — tx: ${txLink(hash)}`);

  hash = await usdc.write.mint([player2.account.address, STAKE * 10n]);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Minted ${formatUnits(STAKE * 10n, 6)} USDC to Player 2 — tx: ${txLink(hash)}`);
  console.log();

  // ─── 3. Players approve BattleRoom ───────────────────────────────────
  console.log("─── Step 3: Players approve BattleRoom to spend USDC ───");

  hash = await writeAs(player1, usdc, "approve", [battleRoom.address, STAKE * 10n]);
  console.log(`  Player 1 approved — tx: ${txLink(hash)}`);

  hash = await writeAs(player2, usdc, "approve", [battleRoom.address, STAKE * 10n]);
  console.log(`  Player 2 approved — tx: ${txLink(hash)}`);
  console.log();

  // ─── 4. Onboard players (mint 2 cards each) ─────────────────────────
  console.log("─── Step 4: Onboarding players (2 cards each) ───");

  const ELEMENTS = ["Fire 🔥", "Water 💧", "Lightning ⚡"];

  hash = await writeAs(player1, factory, "onboard");
  console.log(`  Player 1 onboarded — tx: ${txLink(hash)}`);
  const [p1Card1, p1Card2] = await factory.read.getCards([player1.account.address]);

  hash = await writeAs(player2, factory, "onboard");
  console.log(`  Player 2 onboarded — tx: ${txLink(hash)}`);
  const [p2Card1, p2Card2] = await factory.read.getCards([player2.account.address]);

  // Read card stats
  async function printCard(label: string, addr: Address) {
    const card = await viem.getContractAt("CardAgent", addr);
    const el = Number(await card.read.element());
    const atk = await card.read.atk();
    const def = await card.read.def();
    const hp = await card.read.hp();
    console.log(`  ${label}: ${ELEMENTS[el]}  ATK=${atk} DEF=${def} HP=${hp}  ${addrLink(addr)}`);
    return { element: el, atk: Number(atk), def: Number(def), hp: Number(hp) };
  }

  console.log();
  console.log("  Player 1 cards:");
  const p1c0Stats = await printCard("  Card 0", p1Card1);
  const p1c1Stats = await printCard("  Card 1", p1Card2);
  console.log("  Player 2 cards:");
  const p2c0Stats = await printCard("  Card 0", p2Card1);
  const p2c1Stats = await printCard("  Card 1", p2Card2);
  console.log();

  // ─── 5. Player 1 creates room ───────────────────────────────────────
  console.log("─── Step 5: Player 1 creates room (stake: 100 USDC) ───");

  hash = await writeAs(player1, battleRoom, "createRoom", [[p1Card1, p1Card2], STAKE]);
  console.log(`  Room created — tx: ${txLink(hash)}`);
  console.log();

  // ─── 6. Player 2 joins room ─────────────────────────────────────────
  console.log("─── Step 6: Player 2 joins room (matching 100 USDC stake) ───");

  hash = await writeAs(player2, battleRoom, "joinRoom", [[p2Card1, p2Card2]]);
  console.log(`  Room joined — Battle begins! tx: ${txLink(hash)}`);
  console.log();

  // ─── 7. Battle! ──────────────────────────────────────────────────────
  console.log("─── Step 7: BATTLE ───");
  console.log();

  const MULT: Record<number, Record<number, number>> = {
    0: { 0: 100, 1: 50, 2: 175 },
    1: { 0: 175, 1: 100, 2: 50 },
    2: { 0: 50, 1: 175, 2: 100 },
  };

  // Simple agent decision logic (from spec)
  function decide(
    my: { element: number; atk: number; def: number; hp: number; maxHp: number },
    opp: { element: number; atk: number; def: number; hp: number }
  ): "attack" | "defend" {
    const myMult = MULT[my.element][opp.element];
    const rawAtk = Math.floor((my.atk * myMult) / 100);
    const myDamage = Math.max(1, rawAtk - opp.def);

    const oppMult = MULT[opp.element][my.element];
    const oppRawAtk = Math.floor((opp.atk * oppMult) / 100);
    const incomingDmg = Math.max(1, oppRawAtk - my.def);

    if (incomingDmg >= my.hp) return "defend";
    if (my.hp / my.maxHp < 0.3 && myDamage < opp.hp) return "defend";
    if (myMult === 175) return "attack";
    if (myDamage >= 3) return "attack";
    return "defend";
  }

  // Track HP locally for decision making
  const hp = {
    p1: [p1c0Stats.hp, p1c1Stats.hp],
    p2: [p2c0Stats.hp, p2c1Stats.hp],
  };
  const maxHp = {
    p1: [p1c0Stats.hp, p1c1Stats.hp],
    p2: [p2c0Stats.hp, p2c1Stats.hp],
  };

  const p1Cards = [p1Card1, p1Card2] as [Address, Address];
  const p2Cards = [p2Card1, p2Card2] as [Address, Address];
  const p1Stats = [p1c0Stats, p1c1Stats];
  const p2Stats = [p2c0Stats, p2c1Stats];

  for (let t = 1; t <= 20; t++) {
    const currentState = await battleRoom.read.state();
    if (currentState !== 1) break; // not ACTIVE

    console.log(`  ── Turn ${t} ──`);
    console.log(`    HP: P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);

    // Decide and submit actions for each alive card
    for (let i = 0; i < 2; i++) {
      if (hp.p1[i] <= 0) continue;
      const action = decide(
        { ...p1Stats[i], hp: hp.p1[i], maxHp: maxHp.p1[i] },
        { ...p2Stats[i], hp: hp.p2[i] }
      );
      console.log(`    P1 Card ${i} (${ELEMENTS[p1Stats[i].element]}): ${action.toUpperCase()}`);

      const card = await viem.getContractAt("CardAgent", p1Cards[i]);
      const calldata = encodeFunctionData({
        abi: battleAbi,
        functionName: action,
      });
      hash = await writeAs(player1, card, "execute", [battleRoom.address, calldata]);
      console.log(`      tx: ${txLink(hash)}`);
    }

    // Check if still active (might have resolved mid-turn if P1 submitted last)
    if ((await battleRoom.read.state()) !== 1) break;

    for (let i = 0; i < 2; i++) {
      if (hp.p2[i] <= 0) continue;
      const action = decide(
        { ...p2Stats[i], hp: hp.p2[i], maxHp: maxHp.p2[i] },
        { ...p1Stats[i], hp: hp.p1[i] }
      );
      console.log(`    P2 Card ${i} (${ELEMENTS[p2Stats[i].element]}): ${action.toUpperCase()}`);

      const card = await viem.getContractAt("CardAgent", p2Cards[i]);
      const calldata = encodeFunctionData({
        abi: battleAbi,
        functionName: action,
      });
      hash = await writeAs(player2, card, "execute", [battleRoom.address, calldata]);
      console.log(`      tx: ${txLink(hash)}`);
    }

    // Read updated HP from TurnComplete event
    const events = await publicClient.getContractEvents({
      address: battleRoom.address,
      abi: battleRoom.abi,
      eventName: "TurnComplete",
      fromBlock: BigInt(0),
    });

    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      hp.p1[0] = Number(lastEvent.args.p1hp0);
      hp.p1[1] = Number(lastEvent.args.p1hp1);
      hp.p2[0] = Number(lastEvent.args.p2hp0);
      hp.p2[1] = Number(lastEvent.args.p2hp1);
    }

    console.log(`    → After turn: P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);
    console.log();
  }

  // ─── 8. Results ──────────────────────────────────────────────────────
  console.log("─── Step 8: RESULTS ───");
  console.log();

  const finalState = await battleRoom.read.state();
  console.log("  State:", finalState === 2 ? "SETTLED" : `Unexpected (${finalState})`);

  const resultEvents = await publicClient.getContractEvents({
    address: battleRoom.address,
    abi: battleRoom.abi,
    eventName: "BattleResult",
    fromBlock: BigInt(0),
  });

  if (resultEvents.length > 0) {
    const result = resultEvents[0];
    const winner = result.args.winner!;
    const payout = result.args.usdcPaid!;
    const finalTurn = result.args.finalTurn!;

    if (winner === "0x0000000000000000000000000000000000000000") {
      console.log("  Result: DRAW — both players refunded");
    } else if (winner.toLowerCase() === player1.account.address.toLowerCase()) {
      console.log("  Winner: PLAYER 1", player1.account.address);
    } else {
      console.log("  Winner: PLAYER 2", player2.account.address);
    }

    console.log(`  Payout: ${formatUnits(payout, 6)} USDC`);
    console.log(`  Final turn: ${finalTurn}`);
  }

  // Final balances
  const p1Bal = await usdc.read.balanceOf([player1.account.address]);
  const p2Bal = await usdc.read.balanceOf([player2.account.address]);
  const brBal = await usdc.read.balanceOf([battleRoom.address]);

  console.log();
  console.log("  Final USDC balances:");
  console.log(`    Player 1: ${formatUnits(p1Bal, 6)} USDC`);
  console.log(`    Player 2: ${formatUnits(p2Bal, 6)} USDC`);
  console.log(`    BattleRoom: ${formatUnits(brBal, 6)} USDC`);

  console.log();
  console.log("=".repeat(70));
  console.log("  ALL CONTRACT ADDRESSES FOR EXPLORER");
  console.log("=".repeat(70));
  console.log(`  MockUSDC:          ${addrLink(usdc.address)}`);
  console.log(`  CardFactory:       ${addrLink(factory.address)}`);
  console.log(`  BattleRoom:        ${addrLink(battleRoom.address)}`);
  console.log(`  ERC-8004 Registry: ${addrLink(IDENTITY_REGISTRY)}`);
  console.log(`  P1 Card 0:         ${addrLink(p1Card1)}`);
  console.log(`  P1 Card 1:         ${addrLink(p1Card2)}`);
  console.log(`  P2 Card 0:         ${addrLink(p2Card1)}`);
  console.log(`  P2 Card 1:         ${addrLink(p2Card2)}`);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
