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
    [baseSepolia.id]: http("https://base-sepolia.g.alchemy.com/v2/6unFRgRqxklQkmPxSBhd2WE9aMV5ffMY"),
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
});
