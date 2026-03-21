import { jaw } from "@jaw.id/wagmi";
import { Mode } from "@jaw.id/core";
import { ReactUIHandler } from "@jaw.id/ui";
import { http, createConfig } from "wagmi";
import { baseSepolia, avalancheFuji } from "wagmi/chains";

const JAW_API_KEY = process.env.NEXT_PUBLIC_JAW_API_KEY || "";

export const jawConnect = jaw({
  apiKey: JAW_API_KEY,
  appName: "Elementzz",
  appLogoUrl: "https://elementzz.vercel.app/sprites/elem-fire.png",
  defaultChainId: baseSepolia.id,
  ens: "elementzz.eth",
  preference: {
    mode: Mode.AppSpecific,
    showTestnets: true,
    uiHandler: new ReactUIHandler(),
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
