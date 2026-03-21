"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full border-b-2 border-white/10 bg-[#0a0a0a] px-6 py-3 flex items-center justify-between">
      <Link
        href="/"
        className="font-[family-name:var(--font-press-start)] text-sm tracking-wider"
        style={{
          background: "linear-gradient(90deg, #ff4400 0%, #ffaa00 40%, #0088ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        ELEMENTZZ
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/40">USDC:</span>
          <span className="text-white font-[family-name:var(--font-press-start)] text-xs">1,000.00</span>
        </div>
        <div className="px-3 py-1.5 text-xs font-mono text-white/50 border-2 border-white/20">
          0xE082...06c0
        </div>
      </div>
    </nav>
  );
}
