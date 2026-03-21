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

// Sleep helper for network propagation
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // Helper: send tx as a specific wallet, wait for confirmation, throw on revert
  async function writeAs(wallet: any, contract: { address: Address; abi: any }, fn: string, args: any[] = []) {
    const h = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: fn,
      args,
    });
    console.log(`    waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: h, confirmations: 2 });
    if (receipt.status === "reverted") {
      throw new Error(`TX REVERTED: ${fn}() — ${txLink(h)}`);
    }
    console.log(`    confirmed in block ${receipt.blockNumber}`);
    return h;
  }

  // Helper: deploy contract, wait for confirmation
  async function deploy(name: string, args: any[] = []) {
    console.log(`  Deploying ${name}...`);
    const hash = await deployer.deployContract({
      abi: (await import(`../artifacts/contracts/${getPath(name)}.sol/${name}.json`, { with: { type: "json" } })).default.abi,
      bytecode: (await import(`../artifacts/contracts/${getPath(name)}.sol/${name}.json`, { with: { type: "json" } })).default.bytecode as `0x${string}`,
      args,
    });
    console.log(`    tx: ${txLink(hash)}`);
    console.log(`    waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status === "reverted" || !receipt.contractAddress) {
      throw new Error(`DEPLOY REVERTED: ${name} — ${txLink(hash)}`);
    }
    console.log(`    confirmed at ${receipt.contractAddress} (block ${receipt.blockNumber})`);
    const contract = await viem.getContractAt(name, receipt.contractAddress);
    return contract;
  }

  function getPath(name: string): string {
    if (name === "MockUSDC") return "mocks/MockUSDC";
    if (name === "BattleRoomHarness") return "test/BattleRoomHarness";
    return name;
  }

  // ─── 1. Deploy contracts ─────────────────────────────────────────────
  console.log("─── Step 1: Deploying contracts ───");
  console.log();

  const usdc = await deploy("MockUSDC");
  console.log();

  const factory = await deploy("CardFactory", [IDENTITY_REGISTRY]);
  console.log();

  const battleRoom = await deploy("BattleRoom", [usdc.address, factory.address]);
  console.log();

  console.log("  Allowing BattleRoom in factory...");
  let hash = await factory.write.allowRoom([battleRoom.address]);
  console.log(`    tx: ${txLink(hash)}`);
  console.log(`    waiting for confirmation...`);
  let receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`    confirmed (block ${receipt.blockNumber})`);
  console.log();

  // ─── 2. Mint USDC to players ─────────────────────────────────────────
  console.log("─── Step 2: Minting MockUSDC to players ───");

  hash = await usdc.write.mint([player1.account.address, STAKE * 10n]);
  console.log(`  Minting to Player 1... tx: ${txLink(hash)}`);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`    confirmed`);

  hash = await usdc.write.mint([player2.account.address, STAKE * 10n]);
  console.log(`  Minting to Player 2... tx: ${txLink(hash)}`);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`    confirmed`);
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

  const ELEMENTS = ["Fire", "Water", "Lightning"];

  console.log("  Player 1 onboarding...");
  hash = await writeAs(player1, factory, "onboard");
  console.log(`  Player 1 onboarded — tx: ${txLink(hash)}`);

  // Wait a beat for state to propagate then read cards
  await sleep(2000);
  const [p1Card1, p1Card2] = await factory.read.getCards([player1.account.address]);
  console.log(`  P1 Card 0: ${p1Card1}`);
  console.log(`  P1 Card 1: ${p1Card2}`);

  console.log("  Player 2 onboarding...");
  hash = await writeAs(player2, factory, "onboard");
  console.log(`  Player 2 onboarded — tx: ${txLink(hash)}`);

  await sleep(2000);
  const [p2Card1, p2Card2] = await factory.read.getCards([player2.account.address]);
  console.log(`  P2 Card 0: ${p2Card1}`);
  console.log(`  P2 Card 1: ${p2Card2}`);

  // Validate cards deployed
  if (p1Card1 === "0x0000000000000000000000000000000000000000") {
    throw new Error("Player 1 cards not found — onboard may have reverted on-chain");
  }
  if (p2Card1 === "0x0000000000000000000000000000000000000000") {
    throw new Error("Player 2 cards not found — onboard may have reverted on-chain");
  }

  // Read card stats
  async function printCard(label: string, addr: Address) {
    const card = await viem.getContractAt("CardAgent", addr);
    const el = Number(await card.read.element());
    const atk = await card.read.atk();
    const def_ = await card.read.def();
    const hp = await card.read.hp();
    console.log(`  ${label}: ${ELEMENTS[el]}  ATK=${atk} DEF=${def_} HP=${hp}  ${addrLink(addr)}`);
    return { element: el, atk: Number(atk), def: Number(def_), hp: Number(hp) };
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

  // Player 1 is aggressive, Player 2 is defensive — breaks mirror symmetry
  function decideP1(
    my: { element: number; atk: number; def: number; hp: number; maxHp: number },
    opp: { element: number; atk: number; def: number; hp: number }
  ): "attack" | "defend" {
    const myMult = MULT[my.element][opp.element];
    const rawAtk = Math.floor((my.atk * myMult) / 100);
    const myDamage = Math.max(1, rawAtk - opp.def);
    const oppMult = MULT[opp.element][my.element];
    const oppRawAtk = Math.floor((opp.atk * oppMult) / 100);
    const incomingDmg = Math.max(1, oppRawAtk - my.def);

    // Aggressive: only defend if literally about to die
    if (incomingDmg >= my.hp && my.hp <= 3) return "defend";
    return "attack";
  }

  function decideP2(
    my: { element: number; atk: number; def: number; hp: number; maxHp: number },
    opp: { element: number; atk: number; def: number; hp: number }
  ): "attack" | "defend" {
    const myMult = MULT[my.element][opp.element];
    const rawAtk = Math.floor((my.atk * myMult) / 100);
    const myDamage = Math.max(1, rawAtk - opp.def);
    const oppMult = MULT[opp.element][my.element];
    const oppRawAtk = Math.floor((opp.atk * oppMult) / 100);
    const incomingDmg = Math.max(1, oppRawAtk - my.def);

    // Defensive: defend when low, press advantage when strong
    if (incomingDmg >= my.hp) return "defend";
    if (my.hp / my.maxHp < 0.3 && myDamage < opp.hp) return "defend";
    if (myMult === 175) return "attack";
    if (myDamage >= 3) return "attack";
    // Mix it up — alternate attack/defend based on HP parity
    return my.hp % 2 === 0 ? "attack" : "defend";
  }

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
    if (currentState !== 1) break;

    console.log(`  == Turn ${t} ==`);
    console.log(`    HP: P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);

    // P1 cards submit actions (aggressive strategy)
    for (let i = 0; i < 2; i++) {
      if (hp.p1[i] <= 0) continue;
      const action = decideP1(
        { ...p1Stats[i], hp: hp.p1[i], maxHp: maxHp.p1[i] },
        { ...p2Stats[i], hp: hp.p2[i] }
      );
      console.log(`    P1 Card ${i} (${ELEMENTS[p1Stats[i].element]}): ${action.toUpperCase()}`);

      const card = await viem.getContractAt("CardAgent", p1Cards[i]);
      const calldata = encodeFunctionData({ abi: battleAbi, functionName: action });
      hash = await writeAs(player1, card, "execute", [battleRoom.address, calldata]);
    }

    // Check if resolved after P1
    if ((await battleRoom.read.state()) !== 1) {
      console.log(`    >> Battle resolved after P1 actions`);
      break;
    }

    // P2 cards submit actions (defensive strategy)
    for (let i = 0; i < 2; i++) {
      if (hp.p2[i] <= 0) continue;
      const action = decideP2(
        { ...p2Stats[i], hp: hp.p2[i], maxHp: maxHp.p2[i] },
        { ...p1Stats[i], hp: hp.p1[i] }
      );
      console.log(`    P2 Card ${i} (${ELEMENTS[p2Stats[i].element]}): ${action.toUpperCase()}`);

      const card = await viem.getContractAt("CardAgent", p2Cards[i]);
      const calldata = encodeFunctionData({ abi: battleAbi, functionName: action });
      hash = await writeAs(player2, card, "execute", [battleRoom.address, calldata]);
    }

    // Read updated HP from on-chain slot data
    await sleep(2000);
    const p1s0 = await battleRoom.read.getP1Slot([0n]);
    const p1s1 = await battleRoom.read.getP1Slot([1n]);
    const p2s0 = await battleRoom.read.getP2Slot([0n]);
    const p2s1 = await battleRoom.read.getP2Slot([1n]);

    hp.p1[0] = Number(p1s0[4]); // hp is at index 4
    hp.p1[1] = Number(p1s1[4]);
    hp.p2[0] = Number(p2s0[4]);
    hp.p2[1] = Number(p2s1[4]);

    console.log(`    >> After turn ${t}: P1[${hp.p1[0]}, ${hp.p1[1]}] vs P2[${hp.p2[0]}, ${hp.p2[1]}]`);
    console.log();
  }

  // ─── 8. Results ──────────────────────────────────────────────────────
  console.log();
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
      console.log("  WINNER: PLAYER 1", player1.account.address);
    } else {
      console.log("  WINNER: PLAYER 2", player2.account.address);
    }

    console.log(`  Payout: ${formatUnits(payout, 6)} USDC`);
    console.log(`  Final turn: ${finalTurn}`);
  }

  const p1Bal = await usdc.read.balanceOf([player1.account.address]);
  const p2Bal = await usdc.read.balanceOf([player2.account.address]);
  const brBal = await usdc.read.balanceOf([battleRoom.address]);

  console.log();
  console.log("  Final USDC balances:");
  console.log(`    Player 1: ${formatUnits(p1Bal, 6)} USDC`);
  console.log(`    Player 2: ${formatUnits(p2Bal, 6)} USDC`);
  console.log(`    BattleRoom: ${formatUnits(brBal, 6)} USDC (should be 0)`);

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
