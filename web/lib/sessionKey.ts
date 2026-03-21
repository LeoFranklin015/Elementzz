import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Account } from "@jaw.id/core";
import type { Address, Hex } from "viem";
import { CHAIN_ID } from "./contracts";

const SK_KEY = "elementzz_session_key";
const SK_ADDR_KEY = "elementzz_session_addr"; // JAW smart account address
const SK_EOA_KEY = "elementzz_session_eoa";   // raw EOA address
const PERM_KEY = "elementzz_permission_id";

const JAW_API_KEY = process.env.NEXT_PUBLIC_JAW_API_KEY || "";

// ── Generate or load session key ─────────────────────────────────────

export function getOrCreateSessionKeyRaw(): { privateKey: Hex; eoaAddress: Address } {
  if (typeof window === "undefined") {
    return { privateKey: "0x" as Hex, eoaAddress: "0x" as Address };
  }

  const existing = localStorage.getItem(SK_KEY);
  if (existing) {
    const eoa = localStorage.getItem(SK_EOA_KEY);
    if (eoa) return { privateKey: existing as Hex, eoaAddress: eoa as Address };
    const account = privateKeyToAccount(existing as Hex);
    localStorage.setItem(SK_EOA_KEY, account.address);
    return { privateKey: existing as Hex, eoaAddress: account.address };
  }

  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  localStorage.setItem(SK_KEY, pk);
  localStorage.setItem(SK_EOA_KEY, account.address);
  return { privateKey: pk, eoaAddress: account.address };
}

// ── Create JAW smart account from session key ────────────────────────
// This is async because it needs to compute the counterfactual address

let cachedAccount: any = null;

export async function getOrCreateSessionAccount(): Promise<{
  account: any;
  smartAddress: Address;
  privateKey: Hex;
}> {
  const { privateKey } = getOrCreateSessionKeyRaw();

  if (cachedAccount) {
    const addr = (await cachedAccount.getAddress()) as Address;
    return { account: cachedAccount, smartAddress: addr, privateKey };
  }

  const localAccount = privateKeyToAccount(privateKey);
  const account = await Account.fromLocalAccount(
    { chainId: CHAIN_ID, apiKey: JAW_API_KEY },
    localAccount
  );

  cachedAccount = account;
  const smartAddress = (await account.getAddress()) as Address;

  // Store the JAW smart account address (this is the spender for permissions)
  localStorage.setItem(SK_ADDR_KEY, smartAddress);

  console.log("Session key EOA:", localAccount.address);
  console.log("Session key smart account:", smartAddress);

  return { account, smartAddress, privateKey };
}

// ── Read stored addresses ────────────────────────────────────────────

export function getStoredSessionAddress(): Address | null {
  if (typeof window === "undefined") return null;
  const addr = localStorage.getItem(SK_ADDR_KEY);
  return addr ? (addr as Address) : null;
}

export function loadSessionKey(): { privateKey: Hex; eoaAddress: Address } | null {
  if (typeof window === "undefined") return null;
  const pk = localStorage.getItem(SK_KEY);
  const eoa = localStorage.getItem(SK_EOA_KEY);
  if (!pk || !eoa) return null;
  return { privateKey: pk as Hex, eoaAddress: eoa as Address };
}

// ── Permission ID ────────────────────────────────────────────────────

export function getStoredPermissionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PERM_KEY);
}

export function setStoredPermissionId(id: string) {
  if (typeof window !== "undefined") localStorage.setItem(PERM_KEY, id);
}

// ── Cleanup ──────────────────────────────────────────────────────────

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SK_KEY);
  localStorage.removeItem(SK_ADDR_KEY);
  localStorage.removeItem(SK_EOA_KEY);
  localStorage.removeItem(PERM_KEY);
  cachedAccount = null;
}
