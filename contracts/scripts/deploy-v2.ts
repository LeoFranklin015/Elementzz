import { network } from "hardhat";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const EXISTING_USDC = "0xf59e83c2f8fb54d0707b0188ce0f749ad72f55c6";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deployer:", deployer.account.address);

  // Reuse existing MockUSDC
  const usdc = await viem.getContractAt("MockUSDC", EXISTING_USDC);
  console.log("MockUSDC (existing):", usdc.address);

  // Deploy new CardFactory with updated stats
  console.log("\nDeploying CardFactory v2 (new stats: Fire 10/3/15, Water 8/5/17, Lightning 12/2/13)...");
  const factory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
  console.log("CardFactory:", factory.address);

  // Deploy new BattleRoom with multi-room support
  console.log("Deploying BattleRoom v2 (multi-room)...");
  const battleRoom = await viem.deployContract("BattleRoom", [usdc.address, factory.address]);
  console.log("BattleRoom:", battleRoom.address);

  // Allow BattleRoom
  let hash = await factory.write.allowRoom([battleRoom.address]);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  console.log("BattleRoom allowed in CardFactory");

  console.log("\n=== Update .env.local ===");
  console.log(`NEXT_PUBLIC_CARD_FACTORY=${factory.address}`);
  console.log(`NEXT_PUBLIC_BATTLE_ROOM=${battleRoom.address}`);
  console.log(`NEXT_PUBLIC_MOCK_USDC=${usdc.address}`);
}

main().catch(console.error);
