import { network } from "hardhat";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deployer:", deployer.account.address);

  // Deploy new MockUSDC with permit
  console.log("Deploying MockUSDC v2 (with permit)...");
  const usdc = await viem.deployContract("MockUSDC");
  console.log("MockUSDC:", usdc.address);

  // Deploy CardFactory
  console.log("Deploying CardFactory...");
  const factory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
  console.log("CardFactory:", factory.address);

  // Deploy BattleRoom with permit support
  console.log("Deploying BattleRoom v3 (multi-room + permit)...");
  const battleRoom = await viem.deployContract("BattleRoom", [usdc.address, factory.address]);
  console.log("BattleRoom:", battleRoom.address);

  let hash = await factory.write.allowRoom([battleRoom.address]);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  console.log("BattleRoom allowed");

  // Mint USDC to test wallets
  const wallets = [
    "0x72283c2E08f09312e3B70Fd8211E13D6E8b15368",
    "0xCc131cCacdA62352E8697fFB65aA0FC1AA82934A",
  ];
  for (const w of wallets) {
    hash = await usdc.write.mint([w, 10000_000_000n]); // 10000 USDC
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log(`Minted 10000 USDC to ${w}`);
  }

  console.log("\n=== .env.local ===");
  console.log(`NEXT_PUBLIC_CARD_FACTORY=${factory.address}`);
  console.log(`NEXT_PUBLIC_BATTLE_ROOM=${battleRoom.address}`);
  console.log(`NEXT_PUBLIC_MOCK_USDC=${usdc.address}`);
}

main().catch(console.error);
