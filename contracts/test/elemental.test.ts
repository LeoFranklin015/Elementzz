import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Elemental System", async function () {
  const { viem } = await network.connect();

  const FIRE = 0;
  const WATER = 1;
  const LIGHTNING = 2;

  const harness = await viem.deployContract("BattleRoomHarness");

  describe("Multiplier table", function () {
    it("Fire vs Fire = 100 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, FIRE]), 100n);
    });

    it("Fire vs Water = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, WATER]), 50n);
    });

    it("Fire vs Lightning = 175 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, LIGHTNING]), 175n);
    });

    it("Water vs Fire = 175 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([WATER, FIRE]), 175n);
    });

    it("Water vs Water = 100 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([WATER, WATER]), 100n);
    });

    it("Water vs Lightning = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([WATER, LIGHTNING]), 50n);
    });

    it("Lightning vs Fire = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, FIRE]), 50n);
    });

    it("Lightning vs Water = 175 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, WATER]), 175n);
    });

    it("Lightning vs Lightning = 100 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, LIGHTNING]), 100n);
    });
  });

  describe("Damage formula", function () {
    it("Fire (atk=8) vs Water (def=8), no defend → damage = 1", async function () {
      // rawAtk = floor(8 * 50 / 100) = 4, net = max(1, 4-8) = 1
      const dmg = await harness.read.calcDamage([FIRE, 8, WATER, 8, false]);
      assert.equal(dmg, 1);
    });

    it("Water (atk=5) vs Fire (def=4), Fire defending → damage = 2", async function () {
      // rawAtk = floor(5 * 175 / 100) = 8, net = max(1, 8-4) = 4, halved = max(1, 4/2) = 2
      const dmg = await harness.read.calcDamage([WATER, 5, FIRE, 4, true]);
      assert.equal(dmg, 2);
    });

    it("Lightning (atk=9) vs Water (def=8), no defend → damage = 7", async function () {
      // rawAtk = floor(9 * 175 / 100) = 15, net = max(1, 15-8) = 7
      const dmg = await harness.read.calcDamage([LIGHTNING, 9, WATER, 8, false]);
      assert.equal(dmg, 7);
    });

    it("Fire (atk=8) vs Lightning (def=3), no defend → damage = 11", async function () {
      // rawAtk = floor(8 * 175 / 100) = 14, net = max(1, 14-3) = 11
      const dmg = await harness.read.calcDamage([FIRE, 8, LIGHTNING, 3, false]);
      assert.equal(dmg, 11);
    });

    it("Same element, no defend → uses 1x multiplier", async function () {
      // Fire (atk=8) vs Fire (def=4): rawAtk = floor(8*100/100) = 8, net = 8-4 = 4
      const dmg = await harness.read.calcDamage([FIRE, 8, FIRE, 4, false]);
      assert.equal(dmg, 4);
    });

    it("Any attacker, defender defending → damage = max(1, floor(normal/2))", async function () {
      // Fire (atk=8) vs Fire (def=4), defending: rawAtk=8, net=4, halved=2
      const dmg = await harness.read.calcDamage([FIRE, 8, FIRE, 4, true]);
      assert.equal(dmg, 2);
    });

    it("rawAtk < def → net = 1 (never 0)", async function () {
      // Fire (atk=8) vs Water (def=8): rawAtk = floor(8*50/100)=4, 4<8 → net=1
      const dmg = await harness.read.calcDamage([FIRE, 8, WATER, 8, false]);
      assert.equal(dmg, 1);
    });

    it("rawAtk < def + defending → still net = 1", async function () {
      const dmg = await harness.read.calcDamage([FIRE, 8, WATER, 8, true]);
      assert.equal(dmg, 1);
    });
  });

  describe("DEFEND regen", function () {
    it("+2 HP from regen", async function () {
      const result = await harness.read.applyRegen([10, 2, 22]);
      assert.equal(result, 12);
    });

    it("regen capped at maxHp", async function () {
      const result = await harness.read.applyRegen([21, 2, 22]);
      assert.equal(result, 22);
    });

    it("regen at maxHp stays at maxHp", async function () {
      const result = await harness.read.applyRegen([22, 2, 22]);
      assert.equal(result, 22);
    });
  });
});
