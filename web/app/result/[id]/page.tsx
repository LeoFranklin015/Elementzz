"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits, encodeFunctionData, type Address } from "viem";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";
import Creature from "@/components/creatures";
import { BATTLE_ROOM, battleRoomAbi } from "@/lib/contracts";

const ALCHEMY_RPC = "https://base-sepolia.g.alchemy.com/v2/6unFRgRqxklQkmPxSBhd2WE9aMV5ffMY";
const CARD_NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];
const ELEMENT_COLORS = ["#ff4400", "#0088ff", "#ffaa00"];

interface SlotResult {
  element: number;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
}

interface MatchResult {
  state: number;
  p1Wallet: Address;
  p2Wallet: Address;
  stake: bigint;
  turn: number;
  p1Slots: SlotResult[];
  p2Slots: SlotResult[];
  winner: Address | null;
  payout: bigint;
}

export default function Result() {
  const params = useParams();
  const roomId = Number(params.id);
  const { address } = useAccount();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [roomId]);

  const fetchResult = async () => {
    try {
      const rpc = async (data: string): Promise<string | null> => {
        const resp = await fetch(ALCHEMY_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: BATTLE_ROOM, data }, "latest"] }),
        });
        const json = await resp.json();
        return json.result || null;
      };

      const rid = BigInt(roomId);
      const [roomHex, s0, s1, s2, s3] = await Promise.all([
        rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getRoomState", args: [rid] })),
        rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP1Slot", args: [rid, BigInt(0)] })),
        rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP1Slot", args: [rid, BigInt(1)] })),
        rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP2Slot", args: [rid, BigInt(0)] })),
        rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP2Slot", args: [rid, BigInt(1)] })),
      ]);

      if (!roomHex) { setLoading(false); return; }

      const decodeWords = (hex: string) => {
        const d = hex.slice(2);
        const w: string[] = [];
        for (let i = 0; i < d.length; i += 64) w.push(d.slice(i, i + 64));
        return w;
      };

      const rw = decodeWords(roomHex);
      const state = Number(BigInt("0x" + rw[0]));
      const p1Wallet = ("0x" + rw[1].slice(24)) as Address;
      const p2Wallet = ("0x" + rw[2].slice(24)) as Address;
      const stake = BigInt("0x" + rw[3]);
      const turn = Number(BigInt("0x" + rw[4]));

      const decodeSlot = (hex: string | null): SlotResult => {
        if (!hex) return { element: 0, atk: 0, def: 0, hp: 0, maxHp: 0 };
        const w = decodeWords(hex);
        return {
          element: Number(BigInt("0x" + w[1])),
          atk: Number(BigInt("0x" + w[2])),
          def: Number(BigInt("0x" + w[3])),
          hp: Number(BigInt("0x" + w[4])),
          maxHp: Number(BigInt("0x" + w[5])),
        };
      };

      const p1Slots = [decodeSlot(s0), decodeSlot(s1)];
      const p2Slots = [decodeSlot(s2), decodeSlot(s3)];

      // Determine winner
      const p1Dead = p1Slots[0].hp === 0 && p1Slots[1].hp === 0;
      const p2Dead = p2Slots[0].hp === 0 && p2Slots[1].hp === 0;
      const p1Total = p1Slots[0].hp + p1Slots[1].hp;
      const p2Total = p2Slots[0].hp + p2Slots[1].hp;

      let winner: Address | null = null;
      let payout = BigInt(0);

      if (state === 2) {
        if (p1Dead && p2Dead) {
          winner = null; // draw
        } else if (p1Dead) {
          winner = p2Wallet;
          payout = stake * BigInt(2);
        } else if (p2Dead) {
          winner = p1Wallet;
          payout = stake * BigInt(2);
        } else if (p1Total > p2Total) {
          winner = p1Wallet;
          payout = stake * BigInt(2);
        } else if (p2Total > p1Total) {
          winner = p2Wallet;
          payout = stake * BigInt(2);
        }
      }

      setResult({ state, p1Wallet, p2Wallet, stake, turn, p1Slots, p2Slots, winner, payout });
    } catch (e) {
      console.error("Failed to fetch result:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-white/40 animate-blink font-mono">Loading match result...</div>
        </main>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col flex-1 min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-white/40 font-mono">Room #{roomId} not found</div>
        </main>
      </div>
    );
  }

  const isWinner = result.winner?.toLowerCase() === address?.toLowerCase();
  const isDraw = result.winner === null && result.state === 2;
  const isSettled = result.state === 2;
  const p1Total = result.p1Slots[0].hp + result.p1Slots[1].hp;
  const p2Total = result.p2Slots[0].hp + result.p2Slots[1].hp;

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-8">

          {/* Winner banner */}
          <div className="text-center space-y-4 animate-slide-up">
            {isSettled && (
              <div style={{ filter: `drop-shadow(0 0 30px ${isWinner ? "#ffaa0060" : "#ff224440"})` }}>
                <Creature element={isWinner ? (result.p1Slots[0].element as 0|1|2) : (result.p2Slots[0].element as 0|1|2)} size={120} />
              </div>
            )}
            <h1
              className="font-[family-name:var(--font-press-start)] text-xl"
              style={isWinner ? {
                background: "linear-gradient(90deg, #ff4400 0%, #ffaa00 40%, #0088ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              } : isDraw ? { color: "rgba(255,255,255,0.7)" } : { color: "rgba(255,255,255,0.5)" }}
            >
              {!isSettled ? "IN PROGRESS" : isWinner ? "VICTORY!" : isDraw ? "DRAW" : "DEFEATED"}
            </h1>
          </div>

          {/* Payout */}
          {isSettled && (
            <div className="pixel-border p-4 text-center space-y-2 animate-slide-up" style={{ animationDelay: "200ms" }}>
              <div className="text-white/40 text-sm">{isDraw ? "REFUNDED" : "PRIZE PAID"}</div>
              <div className="font-[family-name:var(--font-press-start)] text-lg text-white">
                {isDraw ? formatUnits(result.stake, 6) : formatUnits(result.payout, 6)} USDC
              </div>
              <div className="font-mono text-xs text-white/30">
                Room #{roomId} &middot; {result.turn} turns
              </div>
            </div>
          )}

          {/* Final HP */}
          <div className="pixel-border p-4 space-y-4 animate-slide-up" style={{ animationDelay: "400ms" }}>
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 text-center">
              FINAL STANDINGS
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* P1 */}
              <div className="space-y-3">
                <div className="font-[family-name:var(--font-press-start)] text-[8px] text-center"
                  style={{ color: result.winner?.toLowerCase() === result.p1Wallet.toLowerCase() ? "#0088ff" : "rgba(255,255,255,0.4)" }}>
                  PLAYER 1 {result.winner?.toLowerCase() === result.p1Wallet.toLowerCase() ? "(WINNER)" : ""}
                  {result.p1Wallet.toLowerCase() === address?.toLowerCase() ? " — YOU" : ""}
                </div>
                <div className="flex gap-2 justify-center">
                  {result.p1Slots.map((s, i) => (
                    <GameCard key={i}
                      element={s.element as 0|1|2}
                      atk={s.atk} def={s.def} hp={s.hp} maxHp={s.maxHp}
                      isDead={s.hp === 0} size="sm"
                    />
                  ))}
                </div>
                <div className="text-center font-mono text-xs text-white/40">
                  Total HP: <span className="text-white">{p1Total}</span>
                </div>
              </div>

              {/* P2 */}
              <div className="space-y-3">
                <div className="font-[family-name:var(--font-press-start)] text-[8px] text-center"
                  style={{ color: result.winner?.toLowerCase() === result.p2Wallet.toLowerCase() ? "#ff4400" : "rgba(255,255,255,0.4)" }}>
                  PLAYER 2 {result.winner?.toLowerCase() === result.p2Wallet.toLowerCase() ? "(WINNER)" : ""}
                  {result.p2Wallet.toLowerCase() === address?.toLowerCase() ? " — YOU" : ""}
                </div>
                <div className="flex gap-2 justify-center">
                  {result.p2Slots.map((s, i) => (
                    <GameCard key={i}
                      element={s.element as 0|1|2}
                      atk={s.atk} def={s.def} hp={s.hp} maxHp={s.maxHp}
                      isDead={s.hp === 0} size="sm"
                    />
                  ))}
                </div>
                <div className="text-center font-mono text-xs text-white/40">
                  Total HP: <span className="text-white">{p2Total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Match info */}
          <div className="pixel-border p-4 space-y-3 animate-slide-up" style={{ animationDelay: "600ms" }}>
            <div className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50 text-center">
              MATCH INFO
            </div>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Turns:</span>
                  <span className="text-white">{result.turn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Stake:</span>
                  <span className="text-white">{formatUnits(result.stake, 6)} USDC</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40">Room:</span>
                  <span className="text-white">#{roomId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Status:</span>
                  <span className={isSettled ? "text-purple-400" : "text-white"}>
                    {isSettled ? "SETTLED" : "ACTIVE"}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center font-mono text-[10px] text-white/20 pt-2">
              P1: {result.p1Wallet.slice(0, 10)}...{result.p1Wallet.slice(-6)}
              <br />
              P2: {result.p2Wallet.slice(0, 10)}...{result.p2Wallet.slice(-6)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center animate-slide-up" style={{ animationDelay: "800ms" }}>
            <Link href="/lobby" className="pixel-btn text-xs">PLAY AGAIN</Link>
            <a
              href={`https://sepolia.basescan.org/address/${BATTLE_ROOM}`}
              target="_blank"
              className="pixel-btn text-xs"
            >
              VIEW ON CHAIN
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
