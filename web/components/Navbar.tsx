"use client";

import Link from "next/link";
import ConnectButton from "./ConnectButton";

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
        <ConnectButton />
      </div>
    </nav>
  );
}
