import { jaw } from "@jaw.id/wagmi";
import { http, createConfig } from "wagmi";
import { baseSepolia, avalancheFuji } from "wagmi/chains";

const JAW_API_KEY = process.env.NEXT_PUBLIC_JAW_API_KEY || "";

export const jawConnect = jaw({
  apiKey: JAW_API_KEY,
  appName: "Elementzz",
  appLogoUrl: "https://elementzz.vercel.app/sprites/elem-fire.png",
  defaultChainId: baseSepolia.id,
  // ens: "elementzz.eth", // disabled — ENS resolution defaults to mainnet, need to fix chainId
  preference: {
    showTestnets: true,
  },
});

export const wagmiConfig = createConfig({
  chains: [baseSepolia, avalancheFuji],
  connectors: [jawConnect],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
});
