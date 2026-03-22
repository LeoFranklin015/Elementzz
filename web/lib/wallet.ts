import { jaw } from "@jaw.id/wagmi";
import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";

const JAW_API_KEY = process.env.NEXT_PUBLIC_JAW_API_KEY || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

export const jawConnect = jaw({
  apiKey: JAW_API_KEY,
  appName: "Elementzz",
  appLogoUrl: "https://elementzz.vercel.app/sprites/elem-fire.png",
  defaultChainId: avalancheFuji.id,
  preference: {
    showTestnets: true,
  },
});

export const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  connectors: [jawConnect],
  transports: {
    [avalancheFuji.id]: http(RPC_URL),
  },
});
