import { network } from "hardhat";
import { formatUnits } from "viem";

async function main() {
  const { viem } = await network.connect();
  const br = await viem.getContractAt("BattleRoom", "0xa61c8c0dd720dda82f0f4f5e4a36b80ef1568e0c");
  
  const count = await br.read.roomCount();
  console.log("Total rooms:", count);
  
  for (let i = 0; i < Number(count); i++) {
    const r = await br.read.getRoomState([BigInt(i)]);
    console.log(`\nRoom ${i}: state=${r[0]} p1=${r[1].slice(0,10)}... p2=${r[2].slice(0,10)}... stake=${formatUnits(r[3], 6)} turn=${r[4]}`);
    
    if (Number(r[0]) > 0) {
      const p1s0 = await br.read.getP1Slot([BigInt(i), 0n]);
      const p1s1 = await br.read.getP1Slot([BigInt(i), 1n]);
      const p2s0 = await br.read.getP2Slot([BigInt(i), 0n]);
      const p2s1 = await br.read.getP2Slot([BigInt(i), 1n]);
      console.log(`  P1: [${p1s0[4]}/${p1s0[5]}, ${p1s1[4]}/${p1s1[5]}] submitted=[${p1s0[7]},${p1s1[7]}]`);
      console.log(`  P2: [${p2s0[4]}/${p2s0[5]}, ${p2s1[4]}/${p2s1[5]}] submitted=[${p2s0[7]},${p2s1[7]}]`);
    }
  }
}
main().catch(console.error);
