"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCallback, useState } from "react";
import { type Address } from "viem";
import { CARD_FACTORY, MOCK_USDC, cardFactoryAbi, cardAgentAbi, mockUsdcAbi } from "./contracts";

export interface CardData {
  address: Address;
  element: number;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
}

export function useHasCards(address: Address | undefined) {
  return useReadContract({
    address: CARD_FACTORY,
    abi: cardFactoryAbi,
    functionName: "hasCards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function usePlayerCardAddresses(address: Address | undefined) {
  return useReadContract({
    address: CARD_FACTORY,
    abi: cardFactoryAbi,
    functionName: "getCards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useCardStats(cardAddress: Address | undefined) {
  const element = useReadContract({ address: cardAddress, abi: cardAgentAbi, functionName: "element", query: { enabled: !!cardAddress } });
  const atk = useReadContract({ address: cardAddress, abi: cardAgentAbi, functionName: "atk", query: { enabled: !!cardAddress } });
  const def_ = useReadContract({ address: cardAddress, abi: cardAgentAbi, functionName: "def", query: { enabled: !!cardAddress } });
  const hp = useReadContract({ address: cardAddress, abi: cardAgentAbi, functionName: "hp", query: { enabled: !!cardAddress } });
  const maxHp = useReadContract({ address: cardAddress, abi: cardAgentAbi, functionName: "maxHp", query: { enabled: !!cardAddress } });

  const isLoading = element.isLoading || atk.isLoading || def_.isLoading || hp.isLoading || maxHp.isLoading;
  const isReady = element.data !== undefined && atk.data !== undefined;

  return {
    data: isReady && cardAddress
      ? {
          address: cardAddress,
          element: Number(element.data),
          atk: Number(atk.data),
          def: Number(def_.data),
          hp: Number(hp.data),
          maxHp: Number(maxHp.data),
        } as CardData
      : null,
    isLoading,
  };
}

export function useOnboard() {
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isSummoning, setIsSummoning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  const summon = useCallback(async () => {
    setIsSummoning(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: CARD_FACTORY,
        abi: cardFactoryAbi,
        functionName: "onboard",
      });
      setTxHash(hash);
      return hash;
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Failed to summon");
      setIsSummoning(false);
      return null;
    }
  }, [writeContractAsync]);

  const mintUsdc = useCallback(async (to: Address, amount: bigint) => {
    try {
      return await writeContractAsync({
        address: MOCK_USDC,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [to, amount],
      });
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Failed to mint USDC");
      return null;
    }
  }, [writeContractAsync]);

  return { summon, mintUsdc, txHash, isSummoning, isConfirming, receipt, error };
}

export function useUsdcBalance(address: Address | undefined) {
  return useReadContract({
    address: MOCK_USDC,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}
