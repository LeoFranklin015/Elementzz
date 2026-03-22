"use client";

import { useState, useCallback } from "react";
import { useGrantPermissions } from "@jaw.id/wagmi";
import { type Address } from "viem";
import { getOrCreateSessionAccount, setStoredPermissionId } from "./sessionKey";
import { BATTLE_ROOM, MOCK_USDC } from "./contracts";

export function useGrantSessionPermissions() {
  const { mutateAsync: grantPermissions, isPending } = useGrantPermissions();
  const [error, setError] = useState<string | null>(null);

  const grant = useCallback(async (card1: Address, card2: Address) => {
    setError(null);
    try {
      // Get the JAW smart account address from the session key
      const { smartAddress } = await getOrCreateSessionAccount();
      console.log("Granting permissions to session smart account:", smartAddress);

      const result = await grantPermissions({
        expiry: Math.floor(Date.now() / 1000) + 7200, // 2 hours
        spender: smartAddress,
        permissions: {
          calls: [
            // USDC operations
            { target: MOCK_USDC, functionSignature: "approve(address,uint256)" },
            { target: MOCK_USDC, functionSignature: "mint(address,uint256)" },
            // Room operations
            { target: BATTLE_ROOM, functionSignature: "createRoom(address[2],uint256,uint256,uint8,bytes32,bytes32)" },
            { target: BATTLE_ROOM, functionSignature: "joinRoom(uint256,address[2],uint256,uint8,bytes32,bytes32)" },
            { target: BATTLE_ROOM, functionSignature: "forceSettle(uint256)" },
            // Card agent execute (attack/defend)
            { target: card1, functionSignature: "execute(address,bytes)" },
            { target: card2, functionSignature: "execute(address,bytes)" },
          ],
          spends: [
            {
              token: MOCK_USDC,
              allowance: "1000000000", // 1000 USDC (6 decimals)
              unit: "forever" as const,
            },
          ],
        },
      });

      if (result?.permissionId) {
        setStoredPermissionId(result.permissionId);
        console.log("Permission granted:", result.permissionId);
        return result.permissionId;
      }

      return null;
    } catch (e: any) {
      const msg = e.shortMessage || e.message || "Failed to grant permissions";
      setError(msg);
      console.error("Grant permissions failed:", e);
      return null;
    }
  }, [grantPermissions]);

  return { grant, isPending, error };
}
