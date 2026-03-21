"use client";

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

  const handleConnect = () => {
    const connector = config.connectors[0];
    if (!connector) return;

    // Use wallet_connect with subname issuance
    connect({ connector });
  };

  const handleDisconnect = () => {
    disconnect({});
  };

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <button
        onClick={handleDisconnect}
        className="px-3 py-1.5 text-xs font-mono text-white/50 border-2 border-white/20 hover:border-white/40 hover:text-white/80 transition-colors cursor-pointer"
      >
        {short}
      </button>
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
