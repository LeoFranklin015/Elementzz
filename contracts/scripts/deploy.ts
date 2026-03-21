import { network } from "hardhat";

// ERC-8004 Identity Registry — same address on Base Sepolia & Avalanche Fuji
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

async function main() {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying with account:", deployer.account.address);

  // 1. Deploy MockUSDC (testnet only)
  const mockUSDC = await viem.deployContract("MockUSDC");
  console.log("MockUSDC deployed to:", mockUSDC.address);

  // 2. Deploy CardFactory with ERC-8004 Identity Registry
  const cardFactory = await viem.deployContract("CardFactory", [IDENTITY_REGISTRY]);
  console.log("CardFactory deployed to:", cardFactory.address);

  // 3. Deploy BattleRoom
  const battleRoom = await viem.deployContract("BattleRoom", [
    mockUSDC.address,
    cardFactory.address,
  ]);
  console.log("BattleRoom deployed to:", battleRoom.address);

  // 4. Allow BattleRoom in CardFactory
  await cardFactory.write.allowRoom([battleRoom.address]);
  console.log("BattleRoom allowed in CardFactory");

  console.log("\n--- Deployment Summary ---");
  console.log("MockUSDC:      ", mockUSDC.address);
  console.log("CardFactory:   ", cardFactory.address);
  console.log("BattleRoom:    ", battleRoom.address);
  console.log("IdentityRegistry:", IDENTITY_REGISTRY);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
