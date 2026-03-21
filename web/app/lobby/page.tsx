"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import Creature from "@/components/creatures";
import { usePlayerCardAddresses, useCardStats, useUsdcBalance } from "@/lib/useOnboard";
import { useGrantSessionPermissions } from "@/lib/useSessionPermissions";
import { getStoredPermissionId } from "@/lib/sessionKey";
import { BATTLE_ROOM, MOCK_USDC, battleRoomAbi, mockUsdcAbi } from "@/lib/contracts";

const ELEMENT_NAMES = ["Fire", "Water", "Lightning"];
const CARD_NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];

type LobbyStep = "idle" | "granting" | "approving" | "creating" | "done";

export default function Lobby() {
  const router = useRouter();
  const { address } = useAccount();
  const [stake, setStake] = useState(100);
  const [step, setStep] = useState<LobbyStep>("idle");
  const [error, setError] = useState<string | null>(null);

  // Read player's cards from chain
  const { data: cardAddrs } = usePlayerCardAddresses(address);
  const card0 = useCardStats(cardAddrs?.[0]);
  const card1 = useCardStats(cardAddrs?.[1]);
  const cards = [card0.data, card1.data].filter(Boolean) as NonNullable<typeof card0.data>[];

  // USDC balance
  const { data: usdcBal, refetch: refetchBal } = useUsdcBalance(address);

  // Permissions
  const { grant, isPending: isGranting, error: grantError } = useGrantSessionPermissions();
  const hasPermission = !!getStoredPermissionId();

  // Contract writes
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // When room creation confirms, navigate to battle
  useEffect(() => {
    if (receipt && step === "creating") {
      setStep("done");
      router.push("/room/1");
    }
  }, [receipt, step, router]);

  const handleCreateRoom = async () => {
    if (!cardAddrs?.[0] || !address) return;
    setError(null);

    try {
      // Step 1: Grant session key permissions if not already done
      if (!getStoredPermissionId()) {
        setStep("granting");
        const permId = await grant(cardAddrs[0], cardAddrs[1]);
        if (!permId) {
          setStep("idle");
          return;
        }
      }

      // Step 2: Approve USDC
      setStep("approving");
      const stakeAmount = parseUnits(stake.toString(), 6);

      const approveHash = await writeContractAsync({
        address: MOCK_USDC,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [BATTLE_ROOM, stakeAmount],
      });
      // Wait for approve
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          try {
            const r = await fetch(`https://sepolia.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${approveHash}`);
            resolve();
            clearInterval(check);
          } catch { /* keep polling */ }
        }, 3000);
        // Fallback timeout
        setTimeout(() => { resolve(); clearInterval(check); }, 10000);
      });

      // Step 3: Create room
      setStep("creating");
      const hash = await writeContractAsync({
        address: BATTLE_ROOM,
        abi: battleRoomAbi,
        functionName: "createRoom",
        args: [[cardAddrs[0], cardAddrs[1]], stakeAmount],
      });
      setTxHash(hash);
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Failed");
      setStep("idle");
    }
  };

  const stakeAmount = parseUnits(stake.toString(), 6);
  const hasEnough = usdcBal !== undefined && usdcBal >= stakeAmount;

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h1 className="font-[family-name:var(--font-press-start)] text-sm text-white/90 mb-8 text-center">
          BATTLE LOBBY
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Your Cards + Create Room */}
          <div className="pixel-border p-6 space-y-6">
            <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">YOUR CARDS</h2>

            <div className="flex gap-4 justify-center">
              {cards.length > 0 ? cards.map((card, i) => (
                <GameCard key={i}
                  element={card.element as 0 | 1 | 2}
                  atk={card.atk} def={card.def} hp={card.hp} maxHp={card.maxHp}
                  address={card.address} size="sm" selected
                />
              )) : (
                <div className="text-white/30 py-8">
                  <Link href="/onboard" className="underline">Summon cards first</Link>
                </div>
              )}
            </div>

            {/* Stake input */}
            <div className="space-y-2">
              <label className="text-sm text-white/40">STAKE AMOUNT (USDC):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-[#050505] border-2 border-white/20 px-3 py-2 font-mono text-lg text-white focus:border-white/40 focus:outline-none"
                  min={1}
                />
                <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/40">USDC</span>
              </div>
              <div className="text-xs text-white/40">
                Balance: <span className={hasEnough ? "text-white" : "text-red-400"}>
                  {usdcBal !== undefined ? formatUnits(usdcBal, 6) : "..."}
                </span> USDC
              </div>
            </div>

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={step !== "idle" || !cards.length || !hasEnough}
              className="pixel-btn w-full text-xs disabled:opacity-30"
            >
              {step === "idle" && "CREATE ROOM"}
              {step === "granting" && "GRANTING PERMISSIONS..."}
              {step === "approving" && "APPROVING USDC..."}
              {step === "creating" && "CREATING ROOM..."}
              {step === "done" && "ROOM CREATED!"}
            </button>

            {error && <div className="text-sm text-center" style={{ color: "#ff2244" }}>{error}</div>}
            {grantError && <div className="text-sm text-center" style={{ color: "#ff2244" }}>{grantError}</div>}
          </div>

          {/* Right — Info */}
          <div className="pixel-border p-6 space-y-6">
            <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">HOW IT WORKS</h2>

            <div className="space-y-4">
              {[
                { num: "1", text: "You stake USDC and lock your 2 cards into a room", color: "#ff4400" },
                { num: "2", text: "An opponent joins and matches your stake", color: "#ffaa00" },
                { num: "3", text: "Your session key plays autonomously — no approvals per turn", color: "#0088ff" },
                { num: "4", text: "Winner takes the full pot", color: "#ffffff" },
              ].map((item) => (
                <div key={item.num} className="flex items-start gap-3">
                  <span className="font-[family-name:var(--font-press-start)] text-lg" style={{ color: item.color }}>{item.num}</span>
                  <p className="text-white/50 text-sm leading-6 pt-1">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Session key status */}
            <div className="pixel-border p-4 space-y-2">
              <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">SESSION KEY</div>
              <div className="font-mono text-xs text-white/70">
                {typeof window !== "undefined" && localStorage.getItem("elementzz_session_addr")
                  ? localStorage.getItem("elementzz_session_addr")?.slice(0, 10) + "..." + localStorage.getItem("elementzz_session_addr")?.slice(-8)
                  : "Not generated yet"
                }
              </div>
              <div className="font-mono text-xs">
                Permissions: {" "}
                <span className={getStoredPermissionId() ? "text-green-400" : "text-white/30"}>
                  {getStoredPermissionId() ? "GRANTED" : "PENDING"}
                </span>
              </div>
            </div>

            {/* Contract addresses */}
            <div className="space-y-1 text-white/20 font-mono text-[10px]">
              <div>BattleRoom: {BATTLE_ROOM.slice(0, 10)}...{BATTLE_ROOM.slice(-6)}</div>
              <div>USDC: {MOCK_USDC.slice(0, 10)}...{MOCK_USDC.slice(-6)}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
