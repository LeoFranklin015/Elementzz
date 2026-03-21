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
    it("Fire vs Fire = 120 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, FIRE]), 120n);
    });

    it("Fire vs Water = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, WATER]), 50n);
    });

    it("Fire vs Lightning = 200 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([FIRE, LIGHTNING]), 200n);
    });

    it("Water vs Fire = 200 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([WATER, FIRE]), 200n);
    });

    it("Water vs Water = 120 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([WATER, WATER]), 120n);
    });

    it("Water vs Lightning = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([WATER, LIGHTNING]), 50n);
    });

    it("Lightning vs Fire = 50 (resisted)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, FIRE]), 50n);
    });

    it("Lightning vs Water = 200 (super effective)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, WATER]), 200n);
    });

    it("Lightning vs Lightning = 120 (neutral)", async function () {
      assert.equal(await harness.read.multiplier([LIGHTNING, LIGHTNING]), 120n);
    });
  });

  describe("Damage formula", function () {
    it("Fire (atk=8) vs Water (def=8), no defend → damage = 1 (resisted)", async function () {
      // rawAtk = floor(8 * 50 / 100) = 4, net = max(1, 4-8) = 1
      const dmg = await harness.read.calcDamage([FIRE, 8, WATER, 8, false]);
      assert.equal(dmg, 1);
    });

    it("Water (atk=5) vs Fire (def=4), Fire defending → damage = 3", async function () {
      // rawAtk = floor(5 * 200 / 100) = 10, net = max(1, 10-4) = 6, halved = 3
      const dmg = await harness.read.calcDamage([WATER, 5, FIRE, 4, true]);
      assert.equal(dmg, 3);
    });

    it("Lightning (atk=9) vs Water (def=8), no defend → damage = 10", async function () {
      // rawAtk = floor(9 * 200 / 100) = 18, net = max(1, 18-8) = 10
      const dmg = await harness.read.calcDamage([LIGHTNING, 9, WATER, 8, false]);
      assert.equal(dmg, 10);
    });

    it("Fire (atk=8) vs Lightning (def=3), no defend → damage = 13", async function () {
      // rawAtk = floor(8 * 200 / 100) = 16, net = max(1, 16-3) = 13
      const dmg = await harness.read.calcDamage([FIRE, 8, LIGHTNING, 3, false]);
      assert.equal(dmg, 13);
    });

    it("Same element, no defend → uses 1.2x multiplier", async function () {
      // Fire (atk=8) vs Fire (def=4): rawAtk = floor(8*120/100) = 9, net = 9-4 = 5
      const dmg = await harness.read.calcDamage([FIRE, 8, FIRE, 4, false]);
      assert.equal(dmg, 5);
    });

    it("Any attacker, defender defending → damage = max(1, floor(normal/2))", async function () {
      // Fire (atk=8) vs Fire (def=4), defending: rawAtk=9, net=5, halved=2
      const dmg = await harness.read.calcDamage([FIRE, 8, FIRE, 4, true]);
      assert.equal(dmg, 2);
    });

    it("rawAtk < def → net = 1 (never 0)", async function () {
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
