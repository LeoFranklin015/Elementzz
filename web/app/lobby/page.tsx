"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits, formatUnits, encodeFunctionData } from "viem";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import { usePlayerCardAddresses, useCardStats, useUsdcBalance } from "@/lib/useOnboard";
import { getOrCreateSessionAccount, getStoredPermissionId, getStoredSessionAddress } from "@/lib/sessionKey";
import { BATTLE_ROOM, battleRoomAbi } from "@/lib/contracts";

const ALCHEMY_RPC = "https://base-sepolia.g.alchemy.com/v2/6unFRgRqxklQkmPxSBhd2WE9aMV5ffMY";
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
  const [openRooms, setOpenRooms] = useState<Array<{ id: number; p1: string; stake: string; state: number }>>([]);

  useEffect(() => setMounted(true), []);

  // Read player's cards
  const { data: cardAddrs } = usePlayerCardAddresses(address);
  const card0 = useCardStats(cardAddrs?.[0]);
  const card1 = useCardStats(cardAddrs?.[1]);
  const cards = [card0.data, card1.data].filter(Boolean) as NonNullable<typeof card0.data>[];

  // USDC
  const { data: usdcBal, refetch: refetchBal } = useUsdcBalance(address);

  // Room count
  const { data: roomCount } = useReadContract({
    address: BATTLE_ROOM, abi: battleRoomAbi, functionName: "roomCount",
  });

  const stakeAmount = parseUnits(stake.toString(), 6);
  const hasEnough = usdcBal !== undefined && usdcBal >= stakeAmount;
  const permissionId = mounted ? getStoredPermissionId() : null;
  const sessionAddr = mounted ? getStoredSessionAddress() : null;

  // ── Fetch open rooms ───────────────────────────────────────────────
  useEffect(() => {
    if (roomCount === undefined) return;
    const count = Number(roomCount);
    if (count === 0) return;

    const fetchRooms = async () => {
      const rooms: typeof openRooms = [];
      // Check last 10 rooms max
      const start = Math.max(0, count - 10);
      for (let i = count - 1; i >= start; i--) {
        try {
          const resp = await fetch(ALCHEMY_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1, method: "eth_call",
              params: [{ to: BATTLE_ROOM, data: encodeFunctionData({ abi: battleRoomAbi, functionName: "getRoomState", args: [BigInt(i)] }) }, "latest"],
            }),
          });
          const json = await resp.json();
          if (json.result) {
            const d = json.result.slice(2);
            const w = [];
            for (let j = 0; j < d.length; j += 64) w.push(d.slice(j, j + 64));
            const state = Number(BigInt("0x" + w[0]));
            const p1 = "0x" + w[1].slice(24);
            const stk = BigInt("0x" + w[3]);
            rooms.push({ id: i, p1, stake: formatUnits(stk, 6), state });
          }
        } catch { /* skip */ }
      }
      setOpenRooms(rooms);
    };
    fetchRooms();
  }, [roomCount]);

  // ── Create Room — session key handles approve + createRoom via permissions ──
  const handleCreateRoom = async () => {
    if (!cardAddrs?.[0] || !address || !permissionId) return;
    setError(null);

    try {
      setStep("creating");
      setStatusMsg("Creating room via session key...");
      const { account } = await getOrCreateSessionAccount();

      // createRoom — USDC already approved during onboard
      const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      const createData = encodeFunctionData({
        abi: battleRoomAbi,
        functionName: "createRoom",
        args: [[cardAddrs[0], cardAddrs[1]], stakeAmount, BigInt(0), 0, ZERO_BYTES32, ZERO_BYTES32],
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

      // Read the new room count to get roomId
      const resp = await fetch(ALCHEMY_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to: BATTLE_ROOM, data: encodeFunctionData({ abi: battleRoomAbi, functionName: "roomCount" }) }, "latest"],
        }),
      });
      const json = await resp.json();
      const newRoomId = Number(BigInt(json.result)) - 1;

      setStep("done");
      setStatusMsg(`Room #${newRoomId} created!`);
      refetchBal();
      setTimeout(() => router.push(`/room/${newRoomId}`), 1500);
    } catch (e: any) {
      console.error("Create room failed:", e);
      setError(e.shortMessage || e.message || "Failed");
      setStep("error");
    }
  };

  // ── Join Room ──────────────────────────────────────────────────────
  const handleJoinRoom = async (roomId: number) => {
    if (!cardAddrs?.[0] || !address || !permissionId) return;
    setError(null);

    try {
      setStep("joining");
      setStatusMsg(`Joining room #${roomId}...`);
      const { account } = await getOrCreateSessionAccount();

      // joinRoom — USDC already approved during onboard
      const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      const joinData = encodeFunctionData({
        abi: battleRoomAbi,
        functionName: "joinRoom",
        args: [BigInt(roomId), [cardAddrs[0], cardAddrs[1]], BigInt(0), 0, ZERO_BYTES32, ZERO_BYTES32],
      });

      const joinResult = await account.sendCalls(
        [{ to: BATTLE_ROOM, data: joinData }],
        { permissionId },
        PAYMASTER_URL || undefined,
        POLICY_ID ? { sponsorshipPolicyId: POLICY_ID } : undefined,
      );
      console.log("JoinRoom sent:", joinResult);

      setStatusMsg("Waiting for confirmation...");
      await pollCallStatus(account, joinResult.id);

      setStep("done");
      setStatusMsg("Joined! Battle starting...");
      refetchBal();
      setTimeout(() => router.push(`/room/${roomId}`), 1500);
    } catch (e: any) {
      console.error("Join room failed:", e);
      setError(e.shortMessage || e.message || "Failed");
      setStep("error");
    }
  };

  const waitingRooms = openRooms.filter(r => r.state === 0 && r.p1 !== "0x0000000000000000000000000000000000000000");
  const myWaitingRoom = waitingRooms.find(r => r.p1.toLowerCase() === address?.toLowerCase());
  const joinableRooms = waitingRooms.filter(r => r.p1.toLowerCase() !== address?.toLowerCase());

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h1 className="font-[family-name:var(--font-press-start)] text-sm text-white/90 mb-8 text-center">
          BATTLE LOBBY
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Cards + Create */}
          <div className="pixel-border p-6 space-y-6">
            <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">YOUR CARDS</h2>
            <div className="flex gap-4 justify-center">
              {cards.length > 0 ? cards.map((card, i) => (
                <GameCard key={i} element={card.element as 0 | 1 | 2}
                  atk={card.atk} def={card.def} hp={card.hp} maxHp={card.maxHp}
                  address={card.address} ownerAddress={address} size="sm" selected />
              )) : (
                <div className="text-white/30 py-8 text-center">
                  No cards. <a href="/onboard" className="underline text-white/50">Summon first</a>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/40">STAKE (USDC):</label>
              <div className="flex items-center gap-2">
                <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-[#050505] border-2 border-white/20 px-3 py-2 font-mono text-lg text-white focus:border-white/40 focus:outline-none" min={1} />
                <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/40">USDC</span>
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>Balance: <span className={hasEnough ? "text-white" : "text-red-400"}>
                  {usdcBal !== undefined ? formatUnits(usdcBal, 6) : "..."}</span></span>
              </div>
            </div>

            <button onClick={handleCreateRoom}
              disabled={step !== "idle" && step !== "error" || !cards.length || !hasEnough || !permissionId}
              className="pixel-btn w-full text-xs disabled:opacity-30">
              {step === "approving" ? "APPROVE IN POPUP..." : step === "creating" ? "CREATING..." : "CREATE NEW ROOM"}
            </button>

            {myWaitingRoom && (
              <div className="pixel-border p-3 text-center space-y-1">
                <span className="text-white/50 text-sm">Your room #{myWaitingRoom.id} is waiting...</span>
                <a href={`/room/${myWaitingRoom.id}`} className="text-white/70 underline text-xs block">Go to room</a>
              </div>
            )}

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
                <button onClick={() => { setStep("idle"); setError(null); }} className="block mx-auto mt-2 text-white/50 underline text-xs">Try again</button>
              </div>
            )}

            {mounted && !permissionId && cards.length > 0 && (
              <div className="text-xs text-center" style={{ color: "#ff2244" }}>
                Session key not authorized. <a href="/onboard" className="underline">Grant permissions</a>
              </div>
            )}
          </div>

          {/* Right — Open Rooms */}
          <div className="pixel-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">OPEN ROOMS</h2>
              <span className="font-mono text-xs text-white/30">{roomCount !== undefined ? `${roomCount} total` : "..."}</span>
            </div>

            {joinableRooms.length > 0 ? (
              <div className="space-y-3">
                {joinableRooms.map((room) => (
                  <div key={room.id} className="pixel-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-[family-name:var(--font-press-start)] text-[9px] text-white/60">
                        ROOM #{room.id}
                      </span>
                      <span className="font-[family-name:var(--font-press-start)] text-[9px]" style={{ color: "#ffaa00" }}>
                        {room.stake} USDC
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white/40">{room.p1.slice(0, 8)}...{room.p1.slice(-4)}</span>
                      <button onClick={() => handleJoinRoom(room.id)}
                        disabled={step !== "idle" && step !== "error" || !cards.length || !permissionId}
                        className="pixel-btn text-[8px] py-1.5 px-4 disabled:opacity-30">
                        {step === "joining" ? "JOINING..." : "JOIN"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/30 text-sm text-center py-8">
                No open rooms. Create one!
              </div>
            )}

            {/* Active rooms */}
            {openRooms.filter(r => r.state === 1).map((room) => (
              <div key={room.id} className="pixel-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-press-start)] text-[8px]" style={{ color: "#ff4400" }}>
                    ROOM #{room.id} — ACTIVE
                  </span>
                  <a href={`/room/${room.id}`} className="text-white/50 underline text-xs">Watch</a>
                </div>
              </div>
            ))}

            {/* Session info */}
            <div className="pixel-border p-3 space-y-1 mt-4">
              <div className="font-[family-name:var(--font-press-start)] text-[7px] text-white/40">SESSION KEY</div>
              <div className="font-mono text-[10px] text-white/50">
                {sessionAddr ? `${sessionAddr.slice(0, 10)}...${sessionAddr.slice(-6)}` : "..."}
              </div>
              <div className="font-mono text-[10px]">
                Permissions: <span className={permissionId ? "text-green-400" : "text-white/30"}>
                  {permissionId ? "GRANTED" : "PENDING"}</span>
              </div>
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
      if (status?.status === 400 || status?.status === 500) throw new Error(`Tx failed (${status.status})`);
    } catch (e: any) {
      if (e.message?.includes("failed")) throw e;
    }
  }
  throw new Error("Transaction timeout");
}
