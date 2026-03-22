import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const USDC = "0xf59e83c2f8fb54d0707b0188ce0f749ad72f55c6";
  const FACTORY = "0xec624fbb98715934827341e3ff5d4d44ddbfb9d6";

  console.log("Deploying new BattleRoom...");
  const br = await viem.deployContract("BattleRoom", [USDC, FACTORY]);
  console.log("BattleRoom:", br.address);

  const factory = await viem.getContractAt("CardFactory", FACTORY);
  const hash = await factory.write.allowRoom([br.address]);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  console.log("Allowed in CardFactory");

  console.log("\nUpdate .env.local:");
  console.log(`NEXT_PUBLIC_BATTLE_ROOM=${br.address}`);
}

main().catch(console.error);
