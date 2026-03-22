"use client";

import Creature from "./creatures";
import { CARD_FACTORY } from "@/lib/contracts";

const ELEMENTS = {
  0: { name: "Fire", cardName: "Inferno", color: "#ff4400", bg: "#1a0800", border: "#ff4400" },
  1: { name: "Water", cardName: "Frost Tide", color: "#0088ff", bg: "#001220", border: "#0088ff" },
  2: { name: "Lightning", cardName: "Volt Phantom", color: "#ffaa00", bg: "#120d00", border: "#ffaa00" },
} as const;

interface GameCardProps {
  element: 0 | 1 | 2;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  address?: string;
  agentId?: number;
  ownerAddress?: string;
  selected?: boolean;
  isDead?: boolean;
  isActing?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export default function GameCard({
  element,
  atk,
  def,
  hp,
  maxHp,
  address,
  agentId,
  ownerAddress,
  selected = false,
  isDead = false,
  isActing = false,
  size = "md",
  onClick,
}: GameCardProps) {
  const el = ELEMENTS[element];
  const hpPercent = Math.max(0, (hp / maxHp) * 100);
  const hpColor = hpPercent > 60 ? el.color : hpPercent > 30 ? "#ffaa00" : "#ff2244";

  const sizeClasses = {
    sm: "w-[150px] h-[210px] p-3",
    md: "w-[190px] h-[260px] p-4",
    lg: "w-[230px] h-[310px] p-5",
  };

  const creatureSize = { sm: 64, md: 80, lg: 100 };
  const titleSize = { sm: "text-[7px]", md: "text-[9px]", lg: "text-[11px]" };

  return (
    <div
      onClick={onClick}
      className={`
        relative ${sizeClasses[size]} flex flex-col justify-between
        border-2 rounded-none
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:scale-[1.02]" : ""}
        ${isDead ? "grayscale opacity-40" : ""}
        ${isActing ? "animate-pulse-border" : ""}
        ${selected ? "ring-2 ring-offset-2 ring-offset-[#050505]" : ""}
      `}
      style={{
        background: el.bg,
        borderColor: selected ? el.color : `${el.color}60`,
        boxShadow: selected
          ? `0 0 20px ${el.color}40, inset 0 0 10px ${el.color}10`
          : isActing
          ? `0 0 16px ${el.color}60`
          : `0 0 4px ${el.color}20`,
      }}
    >
      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
          <span className="text-4xl">💀</span>
        </div>
      )}

      {/* Creature sprite */}
      <div className="flex flex-col items-center gap-2 flex-1 justify-center">
        <Creature element={element} size={creatureSize[size]} />
        <span
          className={`font-[family-name:var(--font-press-start)] ${titleSize[size]} tracking-wide text-center leading-4`}
          style={{ color: el.color }}
        >
          {el.cardName}
        </span>
        <span className="font-[family-name:var(--font-press-start)] opacity-50" style={{ fontSize: "7px", color: el.color }}>
          {el.name}
        </span>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <div className="flex justify-between font-[family-name:var(--font-press-start)]" style={{ fontSize: "8px" }}>
          <span>
            ATK <span style={{ color: el.color }}>{atk}</span>
          </span>
          <span>
            DEF <span style={{ color: el.color }}>{def}</span>
          </span>
        </div>

        {/* HP bar */}
        <div>
          <div className="w-full h-2.5 bg-[#0a0a0a] rounded-none overflow-hidden border border-white/10">
            <div
              className="h-full hp-bar-fill rounded-none"
              style={{
                width: `${hpPercent}%`,
                background: `linear-gradient(180deg, ${hpColor}, ${hpColor}88)`,
                boxShadow: `0 0 6px ${hpColor}60`,
              }}
            />
          </div>
          <div className="text-center font-[family-name:var(--font-press-start)] mt-1" style={{ fontSize: "7px", color: hpColor }}>
            {hp}/{maxHp} HP
          </div>
        </div>

        {address && (
          <a
            href={`https://testnet.8004scan.io/users/${CARD_FACTORY}`}
            target="_blank"
            className="text-center font-mono text-[10px] text-white/40 hover:text-white/70 truncate block cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {address.slice(0, 6)}...{address.slice(-4)}
            <span className="ml-1 text-white/30">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
