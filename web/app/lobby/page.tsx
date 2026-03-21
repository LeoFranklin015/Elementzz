"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import GameCard from "@/components/GameCard";

const MY_CARDS = [
  { element: 0 as const, atk: 8, def: 4, hp: 20, maxHp: 20, address: "0x4e9Ae000FD0ebb7583CAb53c77F6C891B9aBC213" },
  { element: 2 as const, atk: 9, def: 3, hp: 18, maxHp: 18, address: "0x1B8924cb7585DE72455b94ad36aa2AEfA492B045" },
];

const OPEN_ROOMS = [
  { id: 1, stake: 100, p1: "0xDEAD...B33F", p1Cards: [1, 0] as const },
  { id: 2, stake: 50, p1: "0xCAFE...BABE", p1Cards: [2, 2] as const },
  { id: 3, stake: 200, p1: "0x1337...7331", p1Cards: [0, 1] as const },
];

const ELEMENT_ICONS = ["🔥", "🌊", "⚡"];
const ELEMENT_NAMES = ["Fire", "Water", "Lightning"];

export default function Lobby() {
  const [selected, setSelected] = useState<Set<number>>(new Set([0, 1]));
  const [stake, setStake] = useState(100);
  const [showJoinModal, setShowJoinModal] = useState<number | null>(null);

  const toggleCard = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <h1 className="font-[family-name:var(--font-press-start)] text-sm text-white/90 mb-8 text-center">
          BATTLE LOBBY
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Create Room */}
          <div className="pixel-border p-6 space-y-6">
            <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">
              CREATE ROOM
            </h2>

            {/* Card selector */}
            <div>
              <div className="text-sm text-white/40 mb-3">SELECT YOUR CARDS:</div>
              <div className="flex gap-4 justify-center">
                {MY_CARDS.map((card, i) => (
                  <GameCard
                    key={i}
                    {...card}
                    size="sm"
                    selected={selected.has(i)}
                    onClick={() => toggleCard(i)}
                  />
                ))}
              </div>
            </div>

            {/* Stake input */}
            <div className="space-y-2">
              <label className="text-sm text-white/40">STAKE AMOUNT (USDC):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-[var(--bg)] border-2 border-white/20 px-3 py-2 font-mono text-lg text-white focus:border-white/40 focus:outline-none"
                  min={1}
                />
                <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/40">USDC</span>
              </div>
              <div className="text-xs text-white/40">
                Your balance: <span className="text-white">1,000.00</span> USDC
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button className="pixel-btn w-full text-xs opacity-50" disabled>
                APPROVE USDC
              </button>
              <Link href="/room/1" className="pixel-btn w-full text-xs block text-center">
                CREATE ROOM
              </Link>
            </div>
          </div>

          {/* Right — Open Rooms */}
          <div className="pixel-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-press-start)] text-[10px] text-white/80">
                OPEN ROOMS
              </h2>
              <button className="text-white/40 text-sm hover:text-white transition-colors">
                ↻ Refresh
              </button>
            </div>

            <div className="space-y-3">
              {OPEN_ROOMS.map((room) => (
                <div
                  key={room.id}
                  className="pixel-border p-4 hover:border-white/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-[family-name:var(--font-press-start)] text-[9px] text-white/50">
                      ROOM #{room.id}
                    </span>
                    <span className="font-[family-name:var(--font-press-start)] text-[9px] text-[var(--amber)]">
                      {room.stake} USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/40">{room.p1}</span>
                      <div className="flex gap-1">
                        {room.p1Cards.map((el, i) => (
                          <span key={i} className="text-lg">{ELEMENT_ICONS[el]}</span>
                        ))}
                      </div>
                      <span className="text-white/40 text-sm">vs</span>
                      <span className="font-[family-name:var(--font-press-start)] text-[8px] text-white/20">???</span>
                    </div>
                    <button
                      onClick={() => setShowJoinModal(room.id)}
                      className="pixel-btn text-[8px] py-1.5 px-3"
                    >
                      JOIN →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Join Modal */}
        {showJoinModal !== null && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowJoinModal(null)}>
            <div className="pixel-border p-6 bg-[#0a0a0a] max-w-md w-full space-y-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-[family-name:var(--font-press-start)] text-xs text-white/90 text-center">
                JOIN ROOM #{showJoinModal}
              </h3>
              <div className="text-center space-y-2">
                <div className="text-white/40">Opponent&apos;s cards:</div>
                <div className="flex justify-center gap-2 text-2xl">
                  {OPEN_ROOMS.find((r) => r.id === showJoinModal)?.p1Cards.map((el, i) => (
                    <span key={i}>{ELEMENT_ICONS[el]} {ELEMENT_NAMES[el]}</span>
                  ))}
                </div>
                <div className="text-white/40 mt-4">
                  Stake required: <span className="text-[var(--amber)] font-[family-name:var(--font-press-start)] text-xs">
                    {OPEN_ROOMS.find((r) => r.id === showJoinModal)?.stake} USDC
                  </span>
                </div>
              </div>
              <div className="text-center text-white/40">Your cards:</div>
              <div className="flex gap-4 justify-center">
                {MY_CARDS.map((card, i) => (
                  <GameCard key={i} {...card} size="sm" selected />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowJoinModal(null)} className="pixel-btn flex-1 text-[8px] opacity-50 hover:opacity-100">
                  CANCEL
                </button>
                <Link href="/room/1" className="pixel-btn flex-1 text-[8px] text-center">
                  CONFIRM & JOIN
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
