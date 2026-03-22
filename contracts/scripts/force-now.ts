import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const br = await viem.getContractAt("BattleRoom", "0xd46bec8cbf23acd9a474060097a9886bc1e6b91a");

  const state = await br.read.state();
  console.log("Current state:", state);
  
  if (state !== 1) {
    console.log("Not active, nothing to do");
    return;
  }

  const lastAction = await br.read.lastActionAt();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const wait = 3600n - (now - lastAction);
  
  if (wait > 0n) {
    console.log("Need to wait", Number(wait), "seconds. Can't force on real testnet.");
    console.log("P2 needs to submit, or wait for timeout.");
    console.log("\nP2 card owner:", (await br.read.getP2Slot([0n]))[0], "-> owner is JAW smart account");
    console.log("Only P2's session key can submit.");
  }
}

main().catch(console.error);
