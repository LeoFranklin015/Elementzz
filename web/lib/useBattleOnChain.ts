"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { encodeFunctionData, keccak256, toBytes, type Address } from "viem";
import { battleRoomAbi, cardAgentAbi } from "./contracts";
import { getOrCreateSessionAccount, getStoredPermissionId } from "./sessionKey";
import { decide, type Strategy, type Action, type Decision, type CardState } from "./agent";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const WSS_URL = process.env.NEXT_PUBLIC_WSS_URL || "wss://api.avax-test.network/ext/bc/C/ws";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
const POLICY_ID = process.env.NEXT_PUBLIC_POLICY_ID || "";

export interface SlotData {
  cardAgent: Address;
  element: number;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  action: number;
  submitted: boolean;
}

export interface BattleLog { text: string; color: string; turn: number; txHash?: string }

const NAMES = ["Inferno", "Frost Tide", "Volt Phantom"];
const COLORS = ["#ff4400", "#0088ff", "#ffaa00"];

const TURN_COMPLETE_TOPIC = keccak256(toBytes("TurnComplete(uint256,uint8,uint8,uint8,uint8,uint8)"));
const BATTLE_RESULT_TOPIC = keccak256(toBytes("BattleResult(uint256,address,uint256,uint8)"));
const TURN_START_TOPIC = keccak256(toBytes("TurnStart(uint256,uint8)"));

export type BattlePhase = "loading" | "waiting" | "submitting" | "opponent" | "resolved" | "settled";

export function useBattleOnChain(battleRoomAddress: Address, roomId: number, strategy: Strategy) {
  const { address } = useAccount();

  const [roomState, setRoomState] = useState<number>(0);
  const [turn, setTurn] = useState<number>(0);
  const [p1Slots, setP1Slots] = useState<SlotData[]>([]);
  const [p2Slots, setP2Slots] = useState<SlotData[]>([]);
  const [p1Wallet, setP1Wallet] = useState<Address | null>(null);
  const [p2Wallet, setP2Wallet] = useState<Address | null>(null);
  const [amP1, setAmP1] = useState<boolean>(true);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [settled, setSettled] = useState(false);
  const [winner, setWinner] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("loading");
  const [attackingSlot, setAttackingSlot] = useState<number | null>(null);

  const submittingRef = useRef(false);
  const lastSubmittedTurn = useRef(0);
  const turnRef = useRef(0);
  const amP1Ref = useRef(true);
  const p1SlotsRef = useRef<SlotData[]>([]);
  const p2SlotsRef = useRef<SlotData[]>([]);

  useEffect(() => { amP1Ref.current = amP1; }, [amP1]);
  useEffect(() => { p1SlotsRef.current = p1Slots; }, [p1Slots]);
  useEffect(() => { p2SlotsRef.current = p2Slots; }, [p2Slots]);

  // ── RPC helper ─────────────────────────────────────────────────────
  const rpc = useCallback(async (data: string): Promise<string | null> => {
    try {
      const resp = await fetch(RPC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: battleRoomAddress, data }, "latest"] }),
      });
      const json = await resp.json();
      return json.result || null;
    } catch { return null; }
  }, [battleRoomAddress]);

  const decodeSlot = (hex: string): SlotData => {
    const d = hex.slice(2);
    const w: string[] = [];
    for (let i = 0; i < d.length; i += 64) w.push(d.slice(i, i + 64));
    return {
      cardAgent: ("0x" + w[0].slice(24)) as Address,
      element: Number(BigInt("0x" + w[1])), atk: Number(BigInt("0x" + w[2])),
      def: Number(BigInt("0x" + w[3])), hp: Number(BigInt("0x" + w[4])),
      maxHp: Number(BigInt("0x" + w[5])), action: Number(BigInt("0x" + w[6])),
      submitted: BigInt("0x" + w[7]) !== BigInt(0),
    };
  };

  // ── Read full room state ───────────────────────────────────────────
  const readRoomState = useCallback(async () => {
    const rid = BigInt(roomId);
    const [roomHex, s0, s1, s2, s3] = await Promise.all([
      rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getRoomState", args: [rid] })),
      rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP1Slot", args: [rid, BigInt(0)] })),
      rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP1Slot", args: [rid, BigInt(1)] })),
      rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP2Slot", args: [rid, BigInt(0)] })),
      rpc(encodeFunctionData({ abi: battleRoomAbi, functionName: "getP2Slot", args: [rid, BigInt(1)] })),
    ]);

    if (!roomHex) return null;

    // Decode getRoomState: (uint8 state, address p1, address p2, uint256 stake, uint8 turn, uint256 lastActionAt)
    const rd = roomHex.slice(2);
    const rw: string[] = [];
    for (let i = 0; i < rd.length; i += 64) rw.push(rd.slice(i, i + 64));

    const state = Number(BigInt("0x" + rw[0]));
    const p1w = ("0x" + rw[1].slice(24)) as Address;
    const p2w = ("0x" + rw[2].slice(24)) as Address;
    const turnNum = Number(BigInt("0x" + rw[4]));

    setRoomState(state);
    setTurn(turnNum);
    turnRef.current = turnNum;
    setP1Wallet(p1w);
    setP2Wallet(p2w);

    const isP1 = address ? p1w.toLowerCase() === address.toLowerCase() : true;
    setAmP1(isP1);
    amP1Ref.current = isP1;

    const empty: SlotData = { cardAgent: "0x" as Address, element: 0, atk: 0, def: 0, hp: 0, maxHp: 0, action: 0, submitted: false };
    const slots = [
      s0 ? decodeSlot(s0) : empty, s1 ? decodeSlot(s1) : empty,
      s2 ? decodeSlot(s2) : empty, s3 ? decodeSlot(s3) : empty,
    ];

    setP1Slots([slots[0], slots[1]]);
    setP2Slots([slots[2], slots[3]]);

    if (state === 2) { setSettled(true); setPhase("settled"); }
    else if (state === 1) { if (phase === "loading") setPhase("waiting"); }

    console.log(`[state] room=${roomId} turn=${turnNum} state=${state} HP: P1[${slots[0].hp},${slots[1].hp}] P2[${slots[2].hp},${slots[3].hp}]`);
    return { state, turnNum, slots, isP1 };
  }, [rpc, address, roomId, phase]);

  // ── Submit my cards' actions ───────────────────────────────────────
  const submitActions = useCallback(async () => {
    const permissionId = getStoredPermissionId();
    if (!permissionId || submittingRef.current || settled) return;

    // Read FRESH state before deciding to submit
    const freshState = await readRoomState();
    if (!freshState || freshState.state !== 1) return; // Only submit if ACTIVE

    const currentTurn = freshState.turnNum || 1;
    if (lastSubmittedTurn.current >= currentTurn) return;

    const mySlots = freshState.isP1 ? [freshState.slots[0], freshState.slots[1]] : [freshState.slots[2], freshState.slots[3]];
    const oppSlots = freshState.isP1 ? [freshState.slots[2], freshState.slots[3]] : [freshState.slots[0], freshState.slots[1]];

    if (!mySlots[0]?.cardAgent || mySlots[0].maxHp === 0) return;
    if (mySlots.every(s => s.hp <= 0 || s.submitted)) { lastSubmittedTurn.current = currentTurn; return; }

    lastSubmittedTurn.current = currentTurn;
    submittingRef.current = true;
    setPhase("submitting");
    setError(null);

    const toSubmit: Array<{ index: number; action: Action; decision: Decision }> = [];
    const newDecisions: Decision[] = [];

    for (let i = 0; i < 2; i++) {
      if (mySlots[i].hp <= 0) { newDecisions.push({ action: "ATTACK", reasoning: ["DEAD"], confidence: 0 }); continue; }
      if (mySlots[i].submitted) { newDecisions.push({ action: "ATTACK", reasoning: ["Submitted"], confidence: 0 }); continue; }
      const my: CardState = { element: mySlots[i].element as 0|1|2, atk: mySlots[i].atk, def: mySlots[i].def, hp: mySlots[i].hp, maxHp: mySlots[i].maxHp };
      const opp: CardState = { element: oppSlots[i].element as 0|1|2, atk: oppSlots[i].atk, def: oppSlots[i].def, hp: oppSlots[i].hp, maxHp: oppSlots[i].maxHp };
      const decision = decide(my, opp, strategy);
      newDecisions.push(decision);
      toSubmit.push({ index: i, action: decision.action, decision });
    }

    setDecisions(newDecisions);
    if (toSubmit.length === 0) { submittingRef.current = false; return; }

    try {
      const { account } = await getOrCreateSessionAccount();

      for (const { index, action } of toSubmit) {
        const cardAddr = mySlots[index].cardAgent;
        // attack(roomId) / defend(roomId) — NEW: takes roomId as arg
        const innerCalldata = encodeFunctionData({
          abi: battleRoomAbi,
          functionName: action === "ATTACK" ? "attack" : "defend",
          args: [BigInt(roomId)],
        });
        const executeCalldata = encodeFunctionData({
          abi: cardAgentAbi, functionName: "execute",
          args: [battleRoomAddress, innerCalldata],
        });

        console.log(`[submit] T${currentTurn} ${NAMES[mySlots[index].element]} → ${action}`);

        // Show attack animation for this slot
        setAttackingSlot(index);

        const result = await account.sendCalls(
          [{ to: cardAddr, data: executeCalldata }],
          { permissionId },
          PAYMASTER_URL || undefined,
          POLICY_ID ? { sponsorshipPolicyId: POLICY_ID } : undefined,
        );

        const txHash = result.id; // UserOp hash

        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const status = account.getCallStatus(result.id);
            if (status?.status === 200) break;
            if (status?.status === 400 || status?.status === 500) throw new Error(`Tx failed (${status.status})`);
          } catch (e: any) { if (e.message?.includes("failed")) throw e; }
        }

        setAttackingSlot(null);
        setLogs(prev => [{
          text: `${NAMES[mySlots[index].element]} → ${action}`,
          color: COLORS[mySlots[index].element],
          turn: currentTurn,
          txHash,
        }, ...prev]);

        // After each card, check if battle settled (this card might have triggered resolution)
        const freshState = await readRoomState();
        if (freshState?.state === 2) {
          console.log("[submit] Battle settled after card submission!");
          setSettled(true);
          setPhase("settled");
          submittingRef.current = false;
          return;
        }
      }

      setPhase("opponent");
    } catch (e: any) {
      console.error("[submit] Failed:", e);
      // Check if it failed because battle settled
      const freshState = await readRoomState();
      if (freshState?.state === 2) {
        console.log("[submit] Battle settled (caught in error)");
        setSettled(true);
        setPhase("settled");
        submittingRef.current = false;
        return;
      }
      setError(e.shortMessage || e.message || "Failed");
      lastSubmittedTurn.current = 0;
      setPhase("waiting");
    } finally {
      submittingRef.current = false;
    }
  }, [strategy, battleRoomAddress, roomId]);

  // ── WebSocket + initial read ───────────────────────────────────────
  useEffect(() => {
    if (!battleRoomAddress || roomId === undefined) return;

    readRoomState();

    const ws = new WebSocket(WSS_URL);

    ws.onopen = () => {
      console.log("[ws] Connected");
      ws.send(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_subscribe",
        params: ["logs", { address: battleRoomAddress }],
      }));
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.id === 1 && data.result) { console.log("[ws] Subscribed:", data.result); return; }

      if (data.method === "eth_subscription" && data.params?.result) {
        const topic = data.params.result.topics?.[0];

        // Always read fresh state first
        const result = await readRoomState();
        if (!result) return;

        // Check if battle settled — takes priority over everything
        if (result.state === 2 || topic === BATTLE_RESULT_TOPIC) {
          console.log("[ws] Battle settled!");
          try {
            const winnerAddr = ("0x" + data.params.result.data.slice(26, 66)) as Address;
            setWinner(winnerAddr);
          } catch { /* read from state */ }
          setSettled(true);
          setPhase("settled");
          return; // Don't process anything else
        }

        if (topic === TURN_COMPLETE_TOPIC) {
          console.log("[ws] TurnComplete — turn", result.turnNum);
          setLogs(prev => [{
            text: `Turn ${result.turnNum}: P1[${result.slots[0].hp},${result.slots[1].hp}] P2[${result.slots[2].hp},${result.slots[3].hp}]`,
            color: "#ffffff", turn: result.turnNum,
          }, ...prev]);
          lastSubmittedTurn.current = 0;
          setPhase("resolved");
          // Only submit next turn if still active
          setTimeout(() => {
            if (result.state === 1) {
              setPhase("waiting");
              submitActions();
            }
          }, 3000);
        }

        if (topic === TURN_START_TOPIC) {
          console.log("[ws] TurnStart — turn", result.turnNum);
          if (result.state === 1) {
            setTimeout(() => submitActions(), 1000);
          }
        }
      }
    };

    ws.onclose = () => { console.log("[ws] Disconnected"); };
    ws.onerror = (e) => { console.error("[ws] Error:", e); };

    return () => { ws.close(); };
  }, [battleRoomAddress, roomId]);

  // No separate auto-submit effect — the fallback poll handles all submission triggers

  // Fallback poll: runs always when battle active, checks for unsubmitted cards
  useEffect(() => {
    if (!battleRoomAddress || roomId === undefined) return;

    const fallback = setInterval(async () => {
      if (submittingRef.current || settled) return;

      const result = await readRoomState();
      if (!result) return;

      // Settled
      if (result.state === 2) {
        console.log("[fallback] Battle settled!");
        setSettled(true);
        setPhase("settled");
        return;
      }

      // Active — check if my cards need to submit
      if (result.state === 1) {
        const mySlots = result.isP1 ? [result.slots[0], result.slots[1]] : [result.slots[2], result.slots[3]];
        const hasUnsubmitted = mySlots.some(s => s.hp > 0 && !s.submitted);
        const hasCards = mySlots[0]?.maxHp > 0;

        if (hasUnsubmitted && hasCards && !submittingRef.current) {
          console.log("[fallback] Unsubmitted cards found, submitting...");
          lastSubmittedTurn.current = 0;
          setPhase("waiting");
          submitActions();
        }
      }
    }, 8000);

    return () => clearInterval(fallback);
  }, [battleRoomAddress, roomId, settled]);

  return {
    roomState, turn, p1Slots, p2Slots, p1Wallet, p2Wallet,
    amP1, logs, decisions, settled, winner, phase, error,
    submitting: submittingRef.current, attackingSlot,
  };
}
