"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import ConnectButton from "./ConnectButton";
import { useUsdcBalance } from "@/lib/useOnboard";
import { getOrCreateSessionAccount } from "@/lib/sessionKey";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const { data: usdcBal } = useUsdcBalance(address);

  // Generate session key smart account once connected
  useEffect(() => {
    if (isConnected) {
      getOrCreateSessionAccount().then(({ smartAddress }) => {
        console.log("Session key smart account ready:", smartAddress);
      }).catch(console.error);
    }
  }, [isConnected]);

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
        {isConnected && address && usdcBal !== undefined && (
          <>
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-press-start)] text-[10px] text-white">
                {formatUnits(usdcBal, 6)}
              </span>
              <span className="text-white/50 text-xs">USDC</span>
            </div>
            <div className="w-px h-4 bg-white/15" />
          </>
        )}
        <ConnectButton />
      </div>
    </nav>
  );
}
