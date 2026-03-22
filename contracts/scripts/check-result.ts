import { network } from "hardhat";
import { formatUnits } from "viem";

async function main() {
  const { viem } = await network.connect();
  const br = await viem.getContractAt("BattleRoom", "0xd46bec8cbf23acd9a474060097a9886bc1e6b91a");
  const usdc = await viem.getContractAt("MockUSDC", "0xf59e83c2f8fb54d0707b0188ce0f749ad72f55c6");

  console.log("State:", await br.read.state());
  console.log("Turn:", await br.read.turn());
  
  const p1w = await br.read.p1Wallet();
  const p2w = await br.read.p2Wallet();
  console.log("P1:", p1w);
  console.log("P2:", p2w);
  
  const p1Bal = await usdc.read.balanceOf([p1w]);
  const p2Bal = await usdc.read.balanceOf([p2w]);
  console.log("P1 USDC:", formatUnits(p1Bal, 6));
  console.log("P2 USDC:", formatUnits(p2Bal, 6));
  
  const brBal = await usdc.read.balanceOf([br.address]);
  console.log("BattleRoom USDC:", formatUnits(brBal, 6));
  
  const p1s0 = await br.read.getP1Slot([0n]);
  const p1s1 = await br.read.getP1Slot([1n]);
  const p2s0 = await br.read.getP2Slot([0n]);
  const p2s1 = await br.read.getP2Slot([1n]);
  console.log("\nFinal HP:");
  console.log("P1:", p1s0[4], p1s1[4], "total:", Number(p1s0[4]) + Number(p1s1[4]));
  console.log("P2:", p2s0[4], p2s1[4], "total:", Number(p2s0[4]) + Number(p2s1[4]));
}

main().catch(console.error);
