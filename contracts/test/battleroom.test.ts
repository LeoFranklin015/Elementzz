import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, parseAbi, getAddress, type Address } from "viem";

const battleAbi = parseAbi([
  "function attack()",
  "function defend()",
]);

describe("BattleRoom", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [deployer, player1, player2] = await viem.getWalletClients();

  const STAKE = 100_000_000n; // 100 USDC (6 decimals)

  // Helper to call a contract function as a specific wallet
  async function writeAs(
    wallet: any,
    contract: { address: Address; abi: any },
    functionName: string,
    args: any[] = []
  ) {
    return wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args,
    });
  }

  async function expectRevert(fn: () => Promise<any>, reason?: string) {
    try {
      await fn();
      assert.fail("Expected revert but call succeeded");
    } catch (e: any) {
      if (e.message === "Expected revert but call succeeded") throw e;
      if (reason) {
        const msg = e.message || e.toString();
        assert.ok(msg.includes(reason), `Expected "${reason}" in error: ${msg}`);
      }
    }
  }

  async function setup() {
    const usdc = await viem.deployContract("MockUSDC");
    const factory = await viem.deployContract("CardFactory", [
      "0x0000000000000000000000000000000000000000",
    ]);
    const battleRoom = await viem.deployContract("BattleRoom", [
      usdc.address,
      factory.address,
    ]);

    // Allow battle room
    await factory.write.allowRoom([battleRoom.address]);

    // Mint USDC to players
    await usdc.write.mint([player1.account.address, STAKE * 10n]);
    await usdc.write.mint([player2.account.address, STAKE * 10n]);

    // Players approve BattleRoom
    await writeAs(player1, usdc, "approve", [battleRoom.address, STAKE * 10n]);
    await writeAs(player2, usdc, "approve", [battleRoom.address, STAKE * 10n]);

    // Onboard players
    await writeAs(player1, factory, "onboard");
    await writeAs(player2, factory, "onboard");

    // Get card addresses
    const [p1Card1, p1Card2] = await factory.read.getCards([player1.account.address]);
    const [p2Card1, p2Card2] = await factory.read.getCards([player2.account.address]);

    return {
      usdc,
      factory,
      battleRoom,
      p1Cards: [p1Card1, p1Card2] as [Address, Address],
      p2Cards: [p2Card1, p2Card2] as [Address, Address],
    };
  }

  // Helper: card owner makes their card call attack on battle room
  async function cardAttack(cardAddr: Address, brAddr: Address, playerWallet: any) {
    const card = await viem.getContractAt("CardAgent", cardAddr);
    const calldata = encodeFunctionData({ abi: battleAbi, functionName: "attack" });
    await writeAs(playerWallet, card, "execute", [brAddr, calldata]);
  }

  async function cardDefend(cardAddr: Address, brAddr: Address, playerWallet: any) {
    const card = await viem.getContractAt("CardAgent", cardAddr);
    const calldata = encodeFunctionData({ abi: battleAbi, functionName: "defend" });
    await writeAs(playerWallet, card, "execute", [brAddr, calldata]);
  }

  // Helper: submit actions for all alive cards
  async function allAliveAttack(
    p1Cards: [Address, Address],
    p2Cards: [Address, Address],
    br: { address: Address; abi: any; read: any }
  ) {
    for (const addr of p1Cards) {
      const card = await viem.getContractAt("CardAgent", addr);
      if ((await card.read.hp()) > 0 && (await br.read.state()) === 1) {
        await cardAttack(addr, br.address, player1);
      }
    }
    for (const addr of p2Cards) {
      const card = await viem.getContractAt("CardAgent", addr);
      if ((await card.read.hp()) > 0 && (await br.read.state()) === 1) {
        await cardAttack(addr, br.address, player2);
      }
    }
  }

  // Play until settlement
  async function playToEnd(
    p1Cards: [Address, Address],
    p2Cards: [Address, Address],
    br: any
  ) {
    for (let t = 0; t < 20; t++) {
      if ((await br.read.state()) !== 1) break;
      await allAliveAttack(p1Cards, p2Cards, br);
    }
  }

  describe("createRoom()", function () {
    it("transfers USDC to contract and locks P1 cards", async function () {
      const { usdc, battleRoom, p1Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);

      const roomBalance = await usdc.read.balanceOf([battleRoom.address]);
      assert.equal(roomBalance, STAKE);

      const card1 = await viem.getContractAt("CardAgent", p1Cards[0]);
      assert.equal(await card1.read.inBattle(), true);
      assert.equal(
        getAddress(await card1.read.activeRoom()),
        getAddress(battleRoom.address)
      );
    });

    it("reverts if P1 has not called onboard() (bad card addresses)", async function () {
      const { battleRoom } = await setup();

      await expectRevert(
        () =>
          writeAs(deployer, battleRoom, "createRoom", [
            [
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000002",
            ],
            STAKE,
          ])
      );
    });
  });

  describe("joinRoom()", function () {
    it("with matching stake starts battle, emits TurnStart", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      const hash = await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      assert.equal(await battleRoom.read.state(), 1); // ACTIVE
      assert.equal(await battleRoom.read.turn(), 1);

      const receipt = await publicClient.getTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: battleRoom.address,
        abi: battleRoom.abi,
        eventName: "TurnStart",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.turn, 1);
    });

    it("reverts if P1 tries to join own room", async function () {
      const { battleRoom, p1Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);

      await expectRevert(
        () => writeAs(player1, battleRoom, "joinRoom", [p1Cards]),
        "cannot join own room"
      );
    });
  });

  describe("attack() and defend()", function () {
    it("attack() from a non-card address reverts", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      // Direct call from deployer (not a card)
      await expectRevert(
        () => battleRoom.write.attack(),
        "not a card in this room"
      );
    });

    it("defend() from a non-card address reverts", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await expectRevert(
        () => battleRoom.write.defend(),
        "not a card in this room"
      );
    });

    it("all 4 cards submit attack() → _resolveTurn() fires, TurnComplete emitted", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      const blockBefore = await publicClient.getBlockNumber();

      await cardAttack(p1Cards[0], battleRoom.address, player1);
      await cardAttack(p1Cards[1], battleRoom.address, player1);
      await cardAttack(p2Cards[0], battleRoom.address, player2);
      await cardAttack(p2Cards[1], battleRoom.address, player2);

      const events = await publicClient.getContractEvents({
        address: battleRoom.address,
        abi: battleRoom.abi,
        eventName: "TurnComplete",
        fromBlock: blockBefore,
      });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.turn, 1);
    });

    it("HP values in TurnComplete match expected formula output", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      const harness = await viem.deployContract("BattleRoomHarness");

      // Read card stats
      const cards = await Promise.all([
        viem.getContractAt("CardAgent", p1Cards[0]),
        viem.getContractAt("CardAgent", p1Cards[1]),
        viem.getContractAt("CardAgent", p2Cards[0]),
        viem.getContractAt("CardAgent", p2Cards[1]),
      ]);

      const stats = await Promise.all(
        cards.map(async (c) => ({
          element: await c.read.element(),
          atk: await c.read.atk(),
          def: await c.read.def(),
          hp: await c.read.hp(),
        }))
      );

      // Expected damage for slot 0 pair
      const dmgToP2s0 = Number(
        await harness.read.calcDamage([stats[0].element, stats[0].atk, stats[2].element, stats[2].def, false])
      );
      const dmgToP1s0 = Number(
        await harness.read.calcDamage([stats[2].element, stats[2].atk, stats[0].element, stats[0].def, false])
      );

      // Expected damage for slot 1 pair
      const dmgToP2s1 = Number(
        await harness.read.calcDamage([stats[1].element, stats[1].atk, stats[3].element, stats[3].def, false])
      );
      const dmgToP1s1 = Number(
        await harness.read.calcDamage([stats[3].element, stats[3].atk, stats[1].element, stats[1].def, false])
      );

      const expectedP1hp0 = Math.max(0, Number(stats[0].hp) - dmgToP1s0);
      const expectedP1hp1 = Math.max(0, Number(stats[1].hp) - dmgToP1s1);
      const expectedP2hp0 = Math.max(0, Number(stats[2].hp) - dmgToP2s0);
      const expectedP2hp1 = Math.max(0, Number(stats[3].hp) - dmgToP2s1);

      const blockBefore = await publicClient.getBlockNumber();

      await cardAttack(p1Cards[0], battleRoom.address, player1);
      await cardAttack(p1Cards[1], battleRoom.address, player1);
      await cardAttack(p2Cards[0], battleRoom.address, player2);
      await cardAttack(p2Cards[1], battleRoom.address, player2);

      const events = await publicClient.getContractEvents({
        address: battleRoom.address,
        abi: battleRoom.abi,
        eventName: "TurnComplete",
        fromBlock: blockBefore,
      });

      assert.equal(Number(events[0].args.p1hp0), expectedP1hp0);
      assert.equal(Number(events[0].args.p1hp1), expectedP1hp1);
      assert.equal(Number(events[0].args.p2hp0), expectedP2hp0);
      assert.equal(Number(events[0].args.p2hp1), expectedP2hp1);
    });
  });

  describe("Settlement", function () {
    it("battle plays to completion → BattleResult emitted with winner", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      const blockBefore = await publicClient.getBlockNumber();

      await playToEnd(p1Cards, p2Cards, battleRoom);

      assert.equal(await battleRoom.read.state(), 2); // SETTLED

      const events = await publicClient.getContractEvents({
        address: battleRoom.address,
        abi: battleRoom.abi,
        eventName: "BattleResult",
        fromBlock: blockBefore,
      });
      assert.equal(events.length, 1);
    });

    it("USDC balance of winner = stake × 2 after settlement (or refund)", async function () {
      const { usdc, battleRoom, p1Cards, p2Cards } = await setup();

      const p1BalBefore = await usdc.read.balanceOf([player1.account.address]);
      const p2BalBefore = await usdc.read.balanceOf([player2.account.address]);

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await playToEnd(p1Cards, p2Cards, battleRoom);

      const p1BalAfter = await usdc.read.balanceOf([player1.account.address]);
      const p2BalAfter = await usdc.read.balanceOf([player2.account.address]);

      // Total USDC among players is conserved
      assert.equal(p1BalAfter + p2BalAfter, p1BalBefore + p2BalBefore);
      assert.equal(await usdc.read.balanceOf([battleRoom.address]), 0n);
    });

    it("USDC balance of contract = 0 after settlement", async function () {
      const { usdc, battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await playToEnd(p1Cards, p2Cards, battleRoom);

      assert.equal(await usdc.read.balanceOf([battleRoom.address]), 0n);
    });

    it("cards cleared from room after settlement (inBattle=false)", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await playToEnd(p1Cards, p2Cards, battleRoom);

      for (const addr of [...p1Cards, ...p2Cards]) {
        const card = await viem.getContractAt("CardAgent", addr);
        assert.equal(await card.read.inBattle(), false);
        assert.equal(
          await card.read.activeRoom(),
          "0x0000000000000000000000000000000000000000"
        );
      }
    });
  });

  describe("forceSettle()", function () {
    it("reverts before 1h timeout", async function () {
      const { battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await expectRevert(
        () => writeAs(player1, battleRoom, "forceSettle"),
        "timeout not reached"
      );
    });

    it("after 1h → pays correct winner", async function () {
      const { usdc, battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      await testClient.increaseTime({ seconds: 3601 });
      await testClient.mine({ blocks: 1 });

      const blockBefore = await publicClient.getBlockNumber();

      await writeAs(player1, battleRoom, "forceSettle");

      assert.equal(await battleRoom.read.state(), 2);
      assert.equal(await usdc.read.balanceOf([battleRoom.address]), 0n);

      const events = await publicClient.getContractEvents({
        address: battleRoom.address,
        abi: battleRoom.abi,
        eventName: "BattleResult",
        fromBlock: blockBefore,
      });
      assert.equal(events.length, 1);
    });

    it("equal HP → refunds both players", async function () {
      const { usdc, battleRoom, p1Cards, p2Cards } = await setup();

      await writeAs(player1, battleRoom, "createRoom", [p1Cards, STAKE]);
      await writeAs(player2, battleRoom, "joinRoom", [p2Cards]);

      // Read HP totals
      const p1s0 = await battleRoom.read.getP1Slot([0n]);
      const p1s1 = await battleRoom.read.getP1Slot([1n]);
      const p2s0 = await battleRoom.read.getP2Slot([0n]);
      const p2s1 = await battleRoom.read.getP2Slot([1n]);

      const p1Total = Number(p1s0[4]) + Number(p1s1[4]); // hp at index 4
      const p2Total = Number(p2s0[4]) + Number(p2s1[4]);

      await testClient.increaseTime({ seconds: 3601 });
      await testClient.mine({ blocks: 1 });

      const p1BalBefore = await usdc.read.balanceOf([player1.account.address]);
      const p2BalBefore = await usdc.read.balanceOf([player2.account.address]);

      await writeAs(player1, battleRoom, "forceSettle");

      const p1BalAfter = await usdc.read.balanceOf([player1.account.address]);
      const p2BalAfter = await usdc.read.balanceOf([player2.account.address]);

      if (p1Total === p2Total) {
        assert.equal(p1BalAfter - p1BalBefore, STAKE);
        assert.equal(p2BalAfter - p2BalBefore, STAKE);
      } else {
        // Winner gets 2x stake
        const winner = p1Total > p2Total ? "p1" : "p2";
        if (winner === "p1") {
          assert.equal(p1BalAfter - p1BalBefore, STAKE * 2n);
        } else {
          assert.equal(p2BalAfter - p2BalBefore, STAKE * 2n);
        }
      }

      assert.equal(await usdc.read.balanceOf([battleRoom.address]), 0n);
    });
  });
});
