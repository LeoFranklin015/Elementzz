"use client";

import Image from "next/image";

// JS Monster Set — Elementals by JosephSeraph (CC-BY 3.0)
// https://opengameart.org/content/js-monster-set-elementals
const SPRITES = {
  0: "/sprites/elem-fire.png",       // Fire elemental
  1: "/sprites/elem-water.png",      // Water elemental
  2: "/sprites/elem-lightning.png",  // Lightning elemental
} as const;

interface CreatureProps {
  element: 0 | 1 | 2;
  size?: number;
  className?: string;
}

export default function Creature({ element, size = 96, className = "" }: CreatureProps) {
  const anim = element === 0
    ? "creature-float 3s ease-in-out infinite"
    : element === 1
    ? "creature-swim 4s ease-in-out infinite"
    : "creature-pulse 2.5s ease-in-out infinite";

  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size, height: size, animation: anim }}
    >
      <Image
        src={SPRITES[element]}
        alt={["Fire Elemental", "Water Elemental", "Lightning Elemental"][element]}
        width={72}
        height={88}
        className="w-full h-full object-contain drop-shadow-lg"
        style={{ imageRendering: "pixelated" }}
        priority
      />
    </div>
  );
}

export function FireDragon({ size = 96, className = "" }: { size?: number; className?: string }) {
  return <Creature element={0} size={size} className={className} />;
}

export function SeaSerpent({ size = 96, className = "" }: { size?: number; className?: string }) {
  return <Creature element={1} size={size} className={className} />;
}

export function ThunderHawk({ size = 96, className = "" }: { size?: number; className?: string }) {
  return <Creature element={2} size={size} className={className} />;
}
