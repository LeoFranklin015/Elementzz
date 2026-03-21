import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const usdc = await viem.getContractAt("MockUSDC", "0xf59e83c2f8fb54d0707b0188ce0f749ad72f55c6");

  const TO = "0xCc131cCacdA62352E8697fFB65aA0FC1AA82934A";
  console.log("Minting 1000 USDC to", TO);
  const hash = await usdc.write.mint([TO, 1000_000_000n]);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  const bal = await usdc.read.balanceOf([TO]);
  console.log("Done. Balance:", Number(bal) / 1e6, "USDC");
}

main().catch(console.error);
