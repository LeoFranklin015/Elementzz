import { type Address } from "viem";

// ── Contract Addresses (Base Sepolia) ────────────────────────────────
export const CARD_FACTORY = (process.env.NEXT_PUBLIC_CARD_FACTORY || "0x") as Address;
export const BATTLE_ROOM = (process.env.NEXT_PUBLIC_BATTLE_ROOM || "0x") as Address;
export const MOCK_USDC = (process.env.NEXT_PUBLIC_MOCK_USDC || "0x") as Address;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");

// ── CardFactory ABI ──────────────────────────────────────────────────
export const cardFactoryAbi = [
  { name: "onboard", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "getCards", type: "function", inputs: [{ name: "player", type: "address" }], outputs: [{ name: "card1", type: "address" }, { name: "card2", type: "address" }], stateMutability: "view" },
  { name: "hasCards", type: "function", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { name: "PlayerOnboarded", type: "event", inputs: [{ name: "player", type: "address", indexed: true }, { name: "card1", type: "address", indexed: false }, { name: "card2", type: "address", indexed: false }] },
] as const;

// ── CardAgent ABI ────────────────────────────────────────────────────
export const cardAgentAbi = [
  { name: "element", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "atk", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "def", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "hp", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "maxHp", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "owner", type: "function", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { name: "inBattle", type: "function", inputs: [], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { name: "execute", type: "function", inputs: [{ name: "target", type: "address" }, { name: "data", type: "bytes" }], outputs: [{ name: "", type: "bytes" }], stateMutability: "nonpayable" },
] as const;

// ── BattleRoom ABI ───────────────────────────────────────────────────
export const battleRoomAbi = [
  { name: "createRoom", type: "function", inputs: [{ name: "cards", type: "address[2]" }, { name: "stakeAmount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "joinRoom", type: "function", inputs: [{ name: "cards", type: "address[2]" }], outputs: [], stateMutability: "nonpayable" },
  { name: "attack", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "defend", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "forceSettle", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "state", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "turn", type: "function", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { name: "stake", type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "p1Wallet", type: "function", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { name: "p2Wallet", type: "function", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { name: "getP1Slot", type: "function", inputs: [{ name: "index", type: "uint256" }], outputs: [{ name: "cardAgent", type: "address" }, { name: "element", type: "uint8" }, { name: "atkStat", type: "uint8" }, { name: "defStat", type: "uint8" }, { name: "hp", type: "uint8" }, { name: "maxHp", type: "uint8" }, { name: "action", type: "uint8" }, { name: "submitted", type: "bool" }], stateMutability: "view" },
  { name: "getP2Slot", type: "function", inputs: [{ name: "index", type: "uint256" }], outputs: [{ name: "cardAgent", type: "address" }, { name: "element", type: "uint8" }, { name: "atkStat", type: "uint8" }, { name: "defStat", type: "uint8" }, { name: "hp", type: "uint8" }, { name: "maxHp", type: "uint8" }, { name: "action", type: "uint8" }, { name: "submitted", type: "bool" }], stateMutability: "view" },
  { name: "TurnComplete", type: "event", inputs: [{ name: "roomId", type: "uint256", indexed: true }, { name: "turn", type: "uint8", indexed: false }, { name: "p1hp0", type: "uint8", indexed: false }, { name: "p1hp1", type: "uint8", indexed: false }, { name: "p2hp0", type: "uint8", indexed: false }, { name: "p2hp1", type: "uint8", indexed: false }] },
  { name: "BattleResult", type: "event", inputs: [{ name: "roomId", type: "uint256", indexed: true }, { name: "winner", type: "address", indexed: false }, { name: "usdcPaid", type: "uint256", indexed: false }, { name: "finalTurn", type: "uint8", indexed: false }] },
] as const;

// ── MockUSDC ABI ─────────────────────────────────────────────────────
export const mockUsdcAbi = [
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { name: "mint", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;
