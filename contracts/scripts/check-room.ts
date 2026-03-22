import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const br = await viem.getContractAt("BattleRoom", "0xd46bec8cbf23acd9a474060097a9886bc1e6b91a");
  
  const state = await br.read.state();
  const turn = await br.read.turn();
  const p1s0 = await br.read.getP1Slot([0n]);
  const p1s1 = await br.read.getP1Slot([1n]);
  const p2s0 = await br.read.getP2Slot([0n]);
  const p2s1 = await br.read.getP2Slot([1n]);
  
  console.log("State:", state, "Turn:", turn);
  console.log("P1 slot0: hp=", p1s0[4], "submitted=", p1s0[7]);
  console.log("P1 slot1: hp=", p1s1[4], "submitted=", p1s1[7]);
  console.log("P2 slot0: hp=", p2s0[4], "submitted=", p2s0[7]);
  console.log("P2 slot1: hp=", p2s1[4], "submitted=", p2s1[7]);
}

main().catch(console.error);
