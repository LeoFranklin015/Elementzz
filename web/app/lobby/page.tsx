"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData } from "viem";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import { usePlayerCardAddresses, useCardStats, useUsdcBalance } from "@/lib/useOnboard";
import { getOrCreateSessionAccount, getStoredPermissionId, getStoredSessionAddress } from "@/lib/sessionKey";
import { BATTLE_ROOM, MOCK_USDC, battleRoomAbi, mockUsdcAbi } from "@/lib/contracts";

const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
const POLICY_ID = process.env.NEXT_PUBLIC_POLICY_ID || "";

type Step = "idle" | "approving" | "creating" | "joining" | "done" | "error";

export default function Lobby() {
  const router = useRouter();
  const { address } = useAccount();
  const [stake, setStake] = useState(10);
  const [step, setStep] = useState<Step>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Read player's cards
  const { data: cardAddrs } = usePlayerCardAddresses(address);
  const card0 = useCardStats(cardAddrs?.[0]);
  const card1 = useCardStats(cardAddrs?.[1]);
  const cards = [card0.data, card1.data].filter(Boolean) as NonNullable<typeof card0.data>[];

  // USDC
  const { data: usdcBal, refetch: refetchBal } = useUsdcBalance(address);
  const { data: currentAllowance } = useReadContract({
    address: MOCK_USDC,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, BATTLE_ROOM] : undefined,
    query: { enabled: !!address },
  });

  // Player approve (via JAW popup — one time)
  const { writeContractAsync } = useWriteContract();
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const { data: approveReceipt } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const stakeAmount = parseUnits(stake.toString(), 6);
  const hasEnough = usdcBal !== undefined && usdcBal >= stakeAmount;
  const permissionId = mounted ? getStoredPermissionId() : null;
  const sessionAddr = mounted ? getStoredSessionAddress() : null;
  const isApproved = currentAllowance !== undefined && currentAllowance >= stakeAmount;

  // After approve confirms, proceed to create room
  useEffect(() => {
    if (approveReceipt && step === "approving") {
      handleCreateRoomAfterApprove();
    }
  }, [approveReceipt, step]);

  // ── Approve USDC (player popup) then Create Room (session key) ─────
  const handleCreateRoom = async () => {
    if (!cardAddrs?.[0] || !address || !permissionId) return;
    setError(null);

    try {
      if (!isApproved) {
        // Player approves via JAW popup (one-time)
        setStep("approving");
        setStatusMsg("Approve USDC in wallet popup...");
        const hash = await writeContractAsync({
          address: MOCK_USDC,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [BATTLE_ROOM, parseUnits("1000", 6)], // approve a large amount once
        });
        setApproveTxHash(hash);
        // Will continue in useEffect when receipt arrives
      } else {
        await handleCreateRoomAfterApprove();
      }
    } catch (e: any) {
      console.error("Failed:", e);
      setError(e.shortMessage || e.message || "Failed");
      setStep("error");
    }
  };

  const handleCreateRoomAfterApprove = async () => {
    if (!cardAddrs?.[0] || !permissionId) return;

    try {
      setStep("creating");
      setStatusMsg("Loading session key...");
      const { account } = await getOrCreateSessionAccount();

      setStatusMsg("Creating battle room...");
      const createData = encodeFunctionData({
        abi: battleRoomAbi,
        functionName: "createRoom",
        args: [[cardAddrs[0], cardAddrs[1]], stakeAmount],
      });

      const result = await account.sendCalls(
        [{ to: BATTLE_ROOM, data: createData }],
        { permissionId },
        PAYMASTER_URL || undefined,
        POLICY_ID ? { sponsorshipPolicyId: POLICY_ID } : undefined,
      );
      console.log("CreateRoom sent:", result);

      setStatusMsg("Waiting for confirmation...");
      await pollCallStatus(account, result.id);

      setStep("done");
      setStatusMsg("Room created!");
      refetchBal();
      setTimeout(() => router.push("/room/1"), 1500);
    } catch (e: any) {
      console.error("Create room failed:", e);
      setError(e.shortMessage || e.message || "Failed to create room");
      setStep("error");
    }
  };

  // ── Join Room ──────────────────────────────────────────────────────
  const handleJoinRoom = async () => {
    if (!cardAddrs?.[0] || !address || !permissionId) return;
    setError(null);

    try {
      // Approve first if needed (player popup)
      if (!isApproved) {
        setStep("approving");
        setStatusMsg("Approve USDC in wallet popup...");
        const hash = await writeContractAsync({
          address: MOCK_USDC,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [BATTLE_ROOM, parseUnits("1000", 6)],
        });
        // Wait for approve
        setStatusMsg("Waiting for approval...");
        await new Promise(r => setTimeout(r, 8000));
      }

      setStep("joining");
      setStatusMsg("Loading session key...");
      const { account } = await getOrCreateSessionAccount();

      setStatusMsg("Joining battle room...");
      const joinData = encodeFunctionData({
        abi: battleRoomAbi,
        functionName: "joinRoom",
        args: [[cardAddrs[0], cardAddrs[1]]],
      });

      const joinResult = await account.sendCalls(
        [{ to: BATTLE_ROOM, data: joinData }],
        { permissionId },
        PAYMASTER_URL || undefined,
        POLICY_ID ? { sponsorshipPolicyId: POLICY_ID } : undefined,
      );
      await pollCallStatus(account, joinResult.id);

      setStep("done");
      setStatusMsg("Joined! Battle starting...");
      refetchBal();
      setTimeout(() => router.push("/room/1"), 1500);
    } catch (e: any) {
      console.error("Join room failed:", e);
      setError(e.shortMessage || e.message || "Failed to join room");
      setStep("error");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h1 className="font-[family-name:var(--font-press-start)] text-sm text-white/90 mb-8 text-center">
          BATTLE LOBBY
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Cards + Actions */}
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
                <div className="text-white/30 py-8 text-center">
                  No cards found. <a href="/onboard" className="underline text-white/50">Summon first</a>
                </div>
              )}
            </div>

            {/* Stake */}
            <div className="space-y-2">
              <label className="text-sm text-white/40">STAKE (USDC):</label>
              <div className="flex items-center gap-2">
                <input type="number" value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-[#050505] border-2 border-white/20 px-3 py-2 font-mono text-lg text-white focus:border-white/40 focus:outline-none"
                  min={1} />
                <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/40">USDC</span>
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>Balance: <span className={hasEnough ? "text-white" : "text-red-400"}>
                  {usdcBal !== undefined ? formatUnits(usdcBal, 6) : "..."}
                </span></span>
                <span>Approved: <span className={isApproved ? "text-green-400" : "text-white/30"}>
                  {isApproved ? "YES" : "NO"}
                </span></span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button onClick={handleCreateRoom}
                disabled={step !== "idle" && step !== "error" || !cards.length || !hasEnough || !permissionId}
                className="pixel-btn w-full text-xs disabled:opacity-30">
                {step === "approving" ? "APPROVE IN POPUP..." : step === "creating" ? "CREATING..." : "CREATE ROOM"}
              </button>
              <button onClick={handleJoinRoom}
                disabled={step !== "idle" && step !== "error" || !cards.length || !hasEnough || !permissionId}
                className="pixel-btn w-full text-xs disabled:opacity-30">
                {step === "joining" ? "JOINING..." : "JOIN ROOM"}
              </button>
            </div>

            {/* No permission warning */}
            {mounted && !permissionId && cards.length > 0 && (
              <div className="text-xs text-center" style={{ color: "#ff2244" }}>
                Session key not authorized. <a href="/onboard" className="underline">Grant permissions</a>
              </div>
            )}

            {/* Status */}
            {step !== "idle" && step !== "error" && (
              <div className="pixel-border p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-white/60 animate-pulse" />
                  <span className="font-mono text-sm text-white/70">{statusMsg}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-center" style={{ color: "#ff2244" }}>
                {error}
                <button onClick={() => { setStep("idle"); setError(null); }} className="block mx-auto mt-2 text-white/50 underline text-xs">
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Right — Session info */}
          <div className="pixel-border p-6 space-y-6">
            <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">SESSION STATUS</h2>

            <div className="pixel-border p-4 space-y-2">
              <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">SESSION KEY</div>
              <div className="font-mono text-xs text-white/70">
                {sessionAddr ? `${sessionAddr.slice(0, 10)}...${sessionAddr.slice(-8)}` : "Initializing..."}
              </div>
            </div>

            <div className="pixel-border p-4 space-y-2">
              <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">PERMISSIONS</div>
              <div className="font-mono text-xs">
                <span className={permissionId ? "text-green-400" : "text-white/30"}>
                  {permissionId ? "GRANTED" : "NOT GRANTED"}
                </span>
              </div>
            </div>

            <div className="pixel-border p-4 space-y-2">
              <div className="font-[family-name:var(--font-press-start)] text-[8px] text-white/50">FLOW</div>
              <div className="space-y-2 text-white/50 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className={isApproved ? "text-green-400" : "text-white/30"}>
                    {isApproved ? "[x]" : "[ ]"}
                  </span>
                  USDC approved (player signs once)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/30">[ ]</span>
                  Create room (session key, no popup)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/30">[ ]</span>
                  Battle auto-play (session key)
                </div>
              </div>
            </div>

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

async function pollCallStatus(account: any, callId: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const status = account.getCallStatus(callId);
      console.log(`Call ${callId.slice(0, 10)}... status:`, status?.status);
      if (status?.status === 200) return;
      if (status?.status === 400 || status?.status === 500) {
        throw new Error(`Transaction failed (status ${status.status})`);
      }
    } catch (e: any) {
      if (e.message?.includes("failed")) throw e;
    }
  }
  throw new Error("Transaction timeout");
}
