import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const USDC = "0xf59e83c2f8fb54d0707b0188ce0f749ad72f55c6";
  const TO = "0x72283c2E08f09312e3B70Fd8211E13D6E8b15368";
  const AMOUNT = 1000_000_000n; // 1000 USDC (6 decimals)

  const usdc = await viem.getContractAt("MockUSDC", USDC);

  console.log(`Minting 1000 USDC to ${TO}...`);
  const hash = await usdc.write.mint([TO, AMOUNT]);
  console.log("tx:", hash);

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  const bal = await usdc.read.balanceOf([TO]);
  console.log(`Done. Balance: ${Number(bal) / 1e6} USDC`);
}

main().catch(console.error);
