import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const br = await viem.getContractAt("BattleRoom", "0xd46bec8cbf23acd9a474060097a9886bc1e6b91a");
  
  // Check lastActionAt
  const lastAction = await br.read.lastActionAt();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const diff = now - lastAction;
  console.log("Last action:", Number(diff), "seconds ago");
  
  if (diff < 3600n) {
    console.log("Need to wait", Number(3600n - diff), "more seconds for forceSettle");
    console.log("Or P2 needs to submit their card action");
    return;
  }
  
  console.log("Force settling...");
  const hash = await br.write.forceSettle();
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Settled! State:", await br.read.state());
}

main().catch(console.error);
