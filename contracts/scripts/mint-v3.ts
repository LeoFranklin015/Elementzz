import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const pc = await viem.getPublicClient();
  const usdc = await viem.getContractAt("MockUSDC", "0x4fbba5a0b3e7a8711d69ef5bc822b260994f9d26");

  for (const w of ["0x72283c2E08f09312e3B70Fd8211E13D6E8b15368", "0xCc131cCacdA62352E8697fFB65aA0FC1AA82934A"]) {
    const h = await usdc.write.mint([w, 10000_000_000n]);
    await pc.waitForTransactionReceipt({ hash: h, confirmations: 1 });
    console.log("Minted 10000 USDC to", w);
  }
}
main().catch(console.error);
