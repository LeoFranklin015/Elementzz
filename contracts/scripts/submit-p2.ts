import { network } from "hardhat";
import { encodeFunctionData, parseAbi } from "viem";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, player1, player2] = await viem.getWalletClients();

  const BR = "0xd46bec8cbf23acd9a474060097a9886bc1e6b91a";
  const br = await viem.getContractAt("BattleRoom", BR);

  // Get P2's alive card
  const p2s0 = await br.read.getP2Slot([0n]);
  const p2s1 = await br.read.getP2Slot([1n]);

  console.log("P2 slot0: hp=", p2s0[4], "submitted=", p2s0[7], "card=", p2s0[0]);
  console.log("P2 slot1: hp=", p2s1[4], "submitted=", p2s1[7], "card=", p2s1[0]);

  // P2 slot 0 is alive and not submitted — need to submit attack
  if (Number(p2s0[4]) > 0 && !p2s0[7]) {
    const cardAddr = p2s0[0];
    const card = await viem.getContractAt("CardAgent", cardAddr);
    const owner = await card.read.owner();
    console.log("Card owner:", owner);
    console.log("P2 wallet:", await br.read.p2Wallet());

    // Check who owns this card — need that wallet to call execute
    const battleAbi = parseAbi(["function attack()"]);
    const innerCalldata = encodeFunctionData({ abi: battleAbi, functionName: "attack" });

    // Try with player2 key (PRIVATE_KEY2)
    console.log("Player2 address:", player2.account.address);
    console.log("Submitting attack for P2 card 0...");
    
    try {
      const hash = await player2.writeContract({
        address: cardAddr,
        abi: (await import("../artifacts/contracts/CardAgent.sol/CardAgent.json", { with: { type: "json" } })).default.abi,
        functionName: "execute",
        args: [BR, innerCalldata],
        gas: 3_000_000n,
      });
      console.log("tx:", hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log("Status:", receipt.status);
    } catch (e: any) {
      console.log("Player2 key failed:", e.message?.slice(0, 200));
      
      // Try with player3
      console.log("\nTrying player3...");
      console.log("Player3 address:", (await viem.getWalletClients())[2].account.address);
      try {
        const [,, p3] = await viem.getWalletClients();
        const hash = await p3.writeContract({
          address: cardAddr,
          abi: (await import("../artifacts/contracts/CardAgent.sol/CardAgent.json", { with: { type: "json" } })).default.abi,
          functionName: "execute",
          args: [BR, innerCalldata],
          gas: 3_000_000n,
        });
        console.log("tx:", hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        console.log("Status:", receipt.status);
      } catch (e2: any) {
        console.log("Player3 failed too:", e2.message?.slice(0, 200));
        console.log("\nCard owner is a JAW smart account — can't call from EOA keys.");
        console.log("The card owner needs to submit via their JAW session key.");
      }
    }
  }

  // Check final state
  const state = await br.read.state();
  const turn = await br.read.turn();
  console.log("\nFinal — State:", state, "Turn:", turn);
}

main().catch(console.error);
