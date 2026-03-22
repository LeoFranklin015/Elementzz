# Elementzz

On-chain PvP card battler with autonomous AI agents. Players summon cards, stake USDC, and their agents fight without any user interaction.

**[Live App](https://elementzz.vercel.app/)** | **[Demo Video](https://youtu.be/cdiCO53urVk)**

Built on **Avalanche Fuji** | **JAW Smart Accounts (ERC-4337)** | **ERC-8004 Agent Identity** | **ERC-7715 Permissions**

## How It Works

```
Connect (passkey) → Summon 2 Cards → Grant Session Key → Battle Autonomously
```

1. **Connect** — JAW passkey login creates an ERC-4337 smart account
2. **Summon** — `CardFactory` deploys 2 `CardAgent` contracts with random elements + stats, registered in ERC-8004 Identity Registry
3. **Session Key** — A local keypair gets scoped on-chain permissions (ERC-7715) to play on your behalf
4. **Battle** — Create/join rooms, stake USDC. AI agent decides ATTACK/DEFEND each turn. Session key submits moves as UserOps through the ERC-4337 bundler — zero popups

## Element Matchup Table

| ATK ↓ / DEF → | Fire | Water | Lightning |
|---|---|---|---|
| **Fire** | 1.2x | 0.5x | **2.0x** |
| **Water** | **2.0x** | 1.2x | 0.5x |
| **Lightning** | 0.5x | **2.0x** | 1.2x |

> **2.0x** = super effective &nbsp; **0.5x** = resisted &nbsp; **1.2x** = mirror bonus

## Card Stats

| Element | ATK | DEF | HP | Archetype |
|---|---|---|---|---|
| Fire | 10 | 3 | 15 | Glass cannon |
| Water | 8 | 5 | 17 | Balanced |
| Lightning | 12 | 2 | 13 | Burst |

## Damage Formula

```
DMG = floor(ATK × multiplier / 100) - DEF    (min 1)
DEFEND = halve incoming damage + regen 2 HP
```

## Contracts (Avalanche Fuji)

| Contract | Address |
|---|---|
| CardFactory | `0x6ae5dbc0bf1562b8b960e60225dd89e26a1a7920` |
| BattleRoom | `0x62b0a95449e0782cc036855ab24b3fa79e727e96` |
| USDC (Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` |

## ERC-8004 Registered Agents

Each card is registered as an autonomous agent in the ERC-8004 Identity Registry during onboard. See [`CardFactory._registerCardExternal()`](contracts/contracts/CardFactory.sol#L71-L107).

| Agent | Element | Link |
|---|---|---|
| Volt Phantom #93 | Lightning | [8004scan.io/agents/avalanche-fuji/93](https://testnet.8004scan.io/agents/avalanche-fuji/93) |
| Inferno #94 | Fire | [8004scan.io/agents/avalanche-fuji/94](https://testnet.8004scan.io/agents/avalanche-fuji/94) |
| Frost Tide #95 | Water | [8004scan.io/agents/avalanche-fuji/95](https://testnet.8004scan.io/agents/avalanche-fuji/95) |

## Architecture

<img width="3558" height="2970" alt="image" src="https://github.com/user-attachments/assets/2b011f5e-edb7-4947-924d-4effc280b548" />


**Session Key flow:** Local private key → JAW Smart Account → sends UserOps with `permissionId` → PermissionManager validates on-chain → executes `CardAgent.execute(BattleRoom.attack/defend)`

## AI Strategies

| Strategy | Name | Behavior |
|---|---|---|
| Aggressive | BERSERKER | Always attacks. Only defends at critical HP |
| Balanced | TACTICIAN | Reads matchups. Presses advantages, defends when outmatched |
| Defensive | GUARDIAN | Defends often, regens HP, waits for openings |

## Battle Rules

- 2 cards per player, matched by slot index (card 0 vs card 0)
- Max 20 turns. All alive cards must submit each turn
- Turn resolves when both players have submitted all alive cards
- Battle ends when all cards of one side are dead, or at max turns / stalemate (highest total HP wins)
- Winner takes both stakes. Draw = refund
- 1-hour timeout → `forceSettle()` by either player

## Setup

```bash
cd web
cp .env.example .env.local  # fill in your keys
npm install
npm run dev
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, wagmi 3
- **Wallet:** JAW (`@jaw.id/wagmi` + `@jaw.id/core`) — passkey smart accounts
- **Chain:** Avalanche Fuji (43113)
- **Contracts:** Solidity 0.8.24, Hardhat 3, OpenZeppelin
- **Account Abstraction:** jaw.id 
