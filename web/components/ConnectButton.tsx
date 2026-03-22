"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConfig } from "wagmi";
import { useConnect, useDisconnect } from "@jaw.id/wagmi";

interface ConnectButtonProps {
  size?: "sm" | "lg";
}

export default function ConnectButton({ size = "sm" }: ConnectButtonProps) {
  const { address, isConnected } = useAccount();
  const { mutate: connect, isPending: isConnecting } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const config = useConfig();
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleConnect = () => {
    const connector = config.connectors[0];
    if (connector) connect({ connector });
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect({});
    setShowMenu(false);
  };

  // SSR placeholder
  if (!mounted) {
    if (size === "lg") {
      return (
        <button className="inline-block px-10 py-4 border-2 border-white/80 text-white font-[family-name:var(--font-press-start)] text-xs tracking-widest cursor-pointer">
          PLAY NOW
        </button>
      );
    }
    return (
      <button className="px-3 py-1.5 font-[family-name:var(--font-press-start)] text-[8px] text-white border-2 border-white/60 cursor-pointer">
        CONNECT
      </button>
    );
  }

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="px-3 py-1.5 text-xs font-mono text-white border-2 border-white/30 hover:border-white/50 transition-colors cursor-pointer"
        >
          {short}
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#0a0a0a] border-2 border-white/10 z-50 shadow-xl">
            {/* Full address */}
            <div className="px-3 py-2 border-b border-white/5">
              <div className="font-mono text-[10px] text-white/40 break-all">{address}</div>
            </div>

            {/* Copy address */}
            <button
              onClick={handleCopy}
              className="w-full px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
            >
              <span className="text-white/40">{copied ? "✓" : "⎘"}</span>
              {copied ? "Copied!" : "Copy address"}
            </button>

            {/* Disconnect */}
            <button
              onClick={handleDisconnect}
              className="w-full px-3 py-2.5 text-left text-sm text-[#ff2244]/70 hover:bg-[#ff2244]/10 hover:text-[#ff2244] transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>⏻</span>
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  if (size === "lg") {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="inline-block px-10 py-4 border-2 border-white/80 text-white font-[family-name:var(--font-press-start)] text-xs tracking-widest hover:bg-white hover:text-[#050505] transition-colors cursor-pointer disabled:opacity-50"
      >
        {isConnecting ? "CONNECTING..." : "PLAY NOW"}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="px-3 py-1.5 font-[family-name:var(--font-press-start)] text-[8px] text-white border-2 border-white/60 hover:bg-white hover:text-[#050505] transition-colors cursor-pointer disabled:opacity-50"
    >
      {isConnecting ? "..." : "CONNECT"}
    </button>
  );
}
