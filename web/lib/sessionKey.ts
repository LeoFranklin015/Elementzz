import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

const SK_KEY = "elementzz_session_key";
const SK_ADDR_KEY = "elementzz_session_addr";
const PERM_KEY = "elementzz_permission_id";

// ── Generate or load session key ─────────────────────────────────────

export function getOrCreateSessionKey(): { privateKey: Hex; address: Address } {
  if (typeof window === "undefined") {
    return { privateKey: "0x" as Hex, address: "0x" as Address };
  }

  const existing = localStorage.getItem(SK_KEY);
  if (existing) {
    const addr = localStorage.getItem(SK_ADDR_KEY);
    if (addr) return { privateKey: existing as Hex, address: addr as Address };
    const account = privateKeyToAccount(existing as Hex);
    localStorage.setItem(SK_ADDR_KEY, account.address);
    return { privateKey: existing as Hex, address: account.address };
  }

  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  localStorage.setItem(SK_KEY, pk);
  localStorage.setItem(SK_ADDR_KEY, account.address);
  return { privateKey: pk, address: account.address };
}

export function loadSessionKey(): { privateKey: Hex; address: Address } | null {
  if (typeof window === "undefined") return null;
  const pk = localStorage.getItem(SK_KEY);
  const addr = localStorage.getItem(SK_ADDR_KEY);
  if (!pk || !addr) return null;
  return { privateKey: pk as Hex, address: addr as Address };
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
  localStorage.removeItem(PERM_KEY);
}
