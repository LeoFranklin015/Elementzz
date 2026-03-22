import { network } from "hardhat";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const USDC_FUJI = "0x5425890298aed601595a70AB815c96711a31Bc65"; // Real USDC on Avalanche Fuji

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deployer:", deployer.account.address);
  console.log("Using real USDC:", USDC_FUJI);

  // Deploy CardFactory with Elementzz names
  console.log("\nDeploying CardFactory (Elementzz — Inferno/Frost Tide/Volt Phantom)...");
  const factory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
  console.log("CardFactory:", factory.address);

  // Deploy BattleRoom (multi-room + permit) pointing to real USDC
  console.log("Deploying BattleRoom (multi-room)...");
  const battleRoom = await viem.deployContract("BattleRoom", [USDC_FUJI, factory.address]);
  console.log("BattleRoom:", battleRoom.address);

  // Allow BattleRoom in CardFactory
  let hash = await factory.write.allowRoom([battleRoom.address]);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  console.log("BattleRoom allowed in CardFactory");

  console.log("\n=== Update .env.local for Fuji ===");
  console.log(`NEXT_PUBLIC_CARD_FACTORY=${factory.address}`);
  console.log(`NEXT_PUBLIC_BATTLE_ROOM=${battleRoom.address}`);
  console.log(`NEXT_PUBLIC_MOCK_USDC=${USDC_FUJI}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=43113`);
}

main().catch(console.error);
