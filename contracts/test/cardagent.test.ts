import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

describe("CardAgent", async function () {
  const { viem } = await network.connect();
  const [deployer, user1, attacker] = await viem.getWalletClients();

  // Helper: deploy and initialize a Fire card owned by user1
  async function deployCard(
    element: number = 0,
    atk: number = 8,
    def: number = 4,
    hp: number = 20
  ) {
    const card = await viem.deployContract("CardAgent");
    await card.write.initialize([user1.account.address, element, atk, def, hp]);
    return card;
  }

  // Helper: assert that a write call reverts
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

  describe("initialize()", function () {
    it("sets element, atk, def, hp, maxHp correctly", async function () {
      const card = await deployCard(0, 8, 4, 20);
      assert.equal(await card.read.element(), 0);
      assert.equal(await card.read.atk(), 8);
      assert.equal(await card.read.def(), 4);
      assert.equal(await card.read.hp(), 20);
      assert.equal(await card.read.maxHp(), 20);
      assert.equal(
        getAddress(await card.read.owner()),
        getAddress(user1.account.address)
      );
    });

    it("reverts on second call", async function () {
      const card = await deployCard();
      await expectRevert(
        () => card.write.initialize([user1.account.address, 0, 8, 4, 20]),
        "already initialized"
      );
    });
  });

  describe("takeDamage()", function () {
    it("reduces hp correctly", async function () {
      const card = await deployCard(0, 8, 4, 20);
      await card.write.setActiveRoom([deployer.account.address]);
      await card.write.takeDamage([5]);
      assert.equal(await card.read.hp(), 15);
    });

    it("cannot reduce hp below 0", async function () {
      const card = await deployCard(0, 8, 4, 20);
      await card.write.setActiveRoom([deployer.account.address]);
      await card.write.takeDamage([25]);
      assert.equal(await card.read.hp(), 0);
    });

    it("reverts if caller != activeRoom", async function () {
      const card = await deployCard(0, 8, 4, 20);
      await card.write.setActiveRoom([deployer.account.address]);

      await expectRevert(
        () =>
          attacker.writeContract({
            address: card.address,
            abi: card.abi,
            functionName: "takeDamage",
            args: [5],
          }),
        "only active room"
      );
    });
  });

  describe("applyRegen()", function () {
    it("adds hp correctly", async function () {
      const card = await deployCard(0, 8, 4, 20);
      await card.write.setActiveRoom([deployer.account.address]);
      await card.write.takeDamage([10]);
      await card.write.applyRegen([3]);
      assert.equal(await card.read.hp(), 13);
    });

    it("cannot exceed maxHp", async function () {
      const card = await deployCard(0, 8, 4, 20);
      await card.write.setActiveRoom([deployer.account.address]);
      await card.write.takeDamage([2]);
      await card.write.applyRegen([5]);
      assert.equal(await card.read.hp(), 20);
    });
  });

  describe("setActiveRoom()", function () {
    it("sets inBattle=true and activeRoom", async function () {
      const card = await deployCard();
      await card.write.setActiveRoom([attacker.account.address]);
      assert.equal(await card.read.inBattle(), true);
      assert.equal(
        getAddress(await card.read.activeRoom()),
        getAddress(attacker.account.address)
      );
    });

    it("reverts if already inBattle", async function () {
      const card = await deployCard();
      await card.write.setActiveRoom([attacker.account.address]);
      await expectRevert(
        () => card.write.setActiveRoom([deployer.account.address]),
        "already in battle"
      );
    });

    it("reverts if caller != factory", async function () {
      const card = await deployCard();

      await expectRevert(
        () =>
          user1.writeContract({
            address: card.address,
            abi: card.abi,
            functionName: "setActiveRoom",
            args: [attacker.account.address],
          }),
        "only factory"
      );
    });
  });

  describe("clearRoom()", function () {
    it("resets inBattle=false and activeRoom=address(0)", async function () {
      const card = await deployCard();
      await card.write.setActiveRoom([deployer.account.address]);
      await card.write.clearRoom();
      assert.equal(await card.read.inBattle(), false);
      assert.equal(
        await card.read.activeRoom(),
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("reverts if caller != activeRoom", async function () {
      const card = await deployCard();
      await card.write.setActiveRoom([deployer.account.address]);

      await expectRevert(
        () =>
          attacker.writeContract({
            address: card.address,
            abi: card.abi,
            functionName: "clearRoom",
            args: [],
          }),
        "only active room"
      );
    });
  });
});
