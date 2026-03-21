# CardBattle — UI Spec

> Paste this into Claude and say:
> **"Build this frontend exactly as specced. Next.js 14 app router, wagmi v2, viem, Tailwind CSS, shadcn/ui. Connect to Avalanche Fuji testnet."**

---

## Tech stack

```
Framework     : Next.js 14 (app router)
Wallet        : wagmi v2 + viem
Styling       : Tailwind CSS + shadcn/ui
State         : Zustand
Contract ABIs : auto-generated via wagmi CLI or paste manually
Chain         : Avalanche Fuji testnet (chainId: 43113)
RPC           : https://api.avax-test.network/ext/bc/C/rpc
USDC (mock)   : deploy address from deploy script
```

---

## Screens overview

```
/                   → Landing
/onboard            → Wallet connect + card assignment
/lobby              → Create room or browse open rooms
/room/[id]          → Battle arena (live match)
/result/[id]        → Post-match result + payout
```

---

## Screen 1 — Landing `/`

### Layout
Full viewport. Dark background (`#0a0a0a`). Centered content.

### Content
- Game title: **"CardBattle"** — large, bold
- Tagline: `"On-chain PvP. Autonomous agents. Real stakes."`
- Single CTA button: **"Connect Wallet"**
  - On click: open wagmi `ConnectButton` / wallet modal
  - On connected + `hasCards == true`: redirect to `/lobby`
  - On connected + `hasCards == false`: redirect to `/onboard`
- Below CTA: three element pills showing the triangle
  - 🔥 Fire → ⚡ Lightning → 🌊 Water → 🔥 Fire
  - Each pill: element icon + name + "beats X"

### Wallet states
```
Not connected   → show "Connect Wallet" button
Connected       → auto-redirect (check hasCards)
Wrong network   → show "Switch to Fuji" button
```

---

## Screen 2 — Onboarding `/onboard`

Only shown once per wallet. Calls `CardFactory.onboard()`.

### Layout
Centered card, max-width 480px.

### Step 1 — Intro
```
Heading : "Your cards are being summoned"
Body    : "Two card agents will be deployed to your wallet.
           Each card is an on-chain wallet that fights autonomously."
Button  : "Summon Cards"  → calls CardFactory.onboard()
```

Show transaction pending state:
```
Spinner + "Deploying card agents..."
Tx hash link: "View on explorer →"
```

### Step 2 — Cards revealed (after tx confirms)

Read `PlayerOnboarded` event from tx receipt to get card addresses.
Read element/atk/def/hp from each `CardAgent` contract.

Display two card components side by side:

```
┌─────────────┐  ┌─────────────┐
│  [element]  │  │  [element]  │
│    icon     │  │    icon     │
│             │  │             │
│  Card name  │  │  Card name  │
│  [element]  │  │  [element]  │
│             │  │             │
│ ATK 8 DEF 4 │  │ ATK 5 DEF 8 │
│    HP 20    │  │    HP 22    │
│             │  │             │
│ 0x1234...   │  │ 0x5678...   │
└─────────────┘  └─────────────┘
```

Card address shown truncated with copy-to-clipboard icon.

Below cards:
```
Body   : "These are your agents. They fight on your behalf."
Button : "Enter Lobby →"  → navigate to /lobby
```

### Card component spec

```
Element: Fire       → bg: #1a0a00, border: #D85A30, icon: 🔥
Element: Water      → bg: #001220, border: #185FA5, icon: 🌊
Element: Lightning  → bg: #120d00, border: #BA7517, icon: ⚡

Card width  : 180px
Card height : 240px
Border      : 1.5px solid [element color]
Border radius: 12px
Padding     : 16px

Top section (60%):
  - Large element icon (48px) centered
  - Card name centered below (see naming below)

Bottom section (40%):
  - Stats row: ATK [n]  DEF [n]
  - HP bar: filled rect, color by element
  - Address: monospace, 10px, truncated

Card names by element:
  Fire      → "Ember Drake"
  Water     → "Tide Serpent"
  Lightning → "Thunder Hawk"
```

---

## Screen 3 — Lobby `/lobby`

### Layout
Two columns: left = create room, right = open rooms list.

### Left — Create room

```
Heading: "Create Room"

Card selector (pick 2 from your 2 cards):
  Show both cards, selectable.
  Selected state: glowing border in element color.
  Must select exactly 2 to proceed (both of your cards for MVP).

Stake input:
  Label: "Stake amount (USDC)"
  Input: number, min 1, step 1
  Below: "Your balance: [n] USDC"
  "Approve USDC" button (if allowance < stake)
  → calls MockUSDC.approve(battleRoom, stakeAmount)

"Create Room" button:
  Disabled until: 2 cards selected + stake > 0 + USDC approved
  On click: calls BattleRoom.createRoom(cards, stakeAmount)
  Pending state: "Creating room..."
  On confirm: navigate to /room/[roomId]
```

### Right — Open rooms

```
Heading: "Open Rooms"
Refresh icon (re-fetches every 10s)

List of rooms where state == WAITING.
Read from RoomCreated events filtered by state.

Per room row:
  ┌─────────────────────────────────────────┐
  │ Room #[id]    [stake] USDC   [P1 addr]  │
  │ 🔥 Fire  🌊 Water  vs  ???              │
  │                          [Join Room →]  │
  └─────────────────────────────────────────┘

"Join Room" button:
  On click: shows confirmation modal (see below)

Empty state: "No open rooms. Create one to start."
```

### Join room modal

```
Heading: "Join Room #[id]"

Shows:
  - P1's cards (element + name)
  - Stake required: [n] USDC
  - Your cards (both)
  - "Approve USDC" if needed

"Confirm & Join" button:
  Calls BattleRoom.joinRoom(roomId, [card1, card2])
  On confirm: navigate to /room/[roomId]
```

---

## Screen 4 — Battle Arena `/room/[id]`

The main game screen. Real-time updates via event polling or WebSocket.

### Layout

```
┌──────────────────────────────────────────────────────┐
│  Room #[id]  ·  Turn [n] / 20  ·  [state badge]     │
├────────────────────────┬─────────────────────────────┤
│      PLAYER 1          │         PLAYER 2            │
│  [addr truncated]      │     [addr truncated]        │
│                        │                             │
│  ┌──────┐  ┌──────┐   │   ┌──────┐  ┌──────┐       │
│  │Card 1│  │Card 2│   │   │Card 1│  │Card 2│       │
│  │  🔥  │  │  🌊  │   │   │  ⚡  │  │  🔥  │       │
│  │──────│  │──────│   │   │──────│  │──────│       │
│  │HP bar│  │HP bar│   │   │HP bar│  │HP bar│       │
│  │20/20 │  │22/22 │   │   │18/18 │  │20/20 │       │
│  └──────┘  └──────┘   │   └──────┘  └──────┘       │
│                        │                             │
│   Stake: [n] USDC      │     Stake: [n] USDC         │
├────────────────────────┴─────────────────────────────┤
│                  BATTLE LOG                          │
│  Turn 3 · Card 1: ⚡→🌊 · 7 dmg · P2 Card1: 15hp   │
│  Turn 3 · Card 2: 🔥→⚡ · 11 dmg · P2 Card2: 7hp   │
│  Turn 2 · Card 1: 🌊 defended · took 1 dmg + 2 regen│
│  ...                                                  │
├──────────────────────────────────────────────────────┤
│           [Agent activity ticker]                    │
│  0xCard1... submitted attack()  ·  tx: 0x1234...    │
│  0xCard2... submitted defend()  ·  tx: 0x5678...    │
└──────────────────────────────────────────────────────┘
```

### HP bar component

```
Full width of card
Height: 8px
Border radius: 4px
Background: #1a1a1a
Fill color:
  > 60% HP → element color (bright)
  30–60%   → amber (#BA7517)
  < 30%    → red (#E24B4A)
Animated: smooth transition on HP change (300ms)
Label below: "[current] / [max]" in 11px monospace
```

### State badge

```
WAITING  → gray pill  "Waiting for opponent"
ACTIVE   → green pill "Battle in progress"
SETTLED  → purple pill "Settled"
```

### Turn indicator

```
"Turn 4 / 20"
Progress bar below: filled to turn/20
```

### Battle log

```
Scrollable list, newest on top.
Max 8 visible rows, scroll for more.
Each row:
  Turn [n] · [CardName] ([element icon]) → [element icon] · [dmg] damage · [target] now [hp] HP
  If DEFEND: "[CardName] defended · took [dmg] dmg · regened 2 HP"
```

### Agent activity ticker

```
Small strip at bottom.
Shows last 4 txns from the 4 card agents.
Each row:
  [truncated card address]  [action: attack/defend]  tx: [hash link]
Auto-updates as TurnComplete events come in.
```

### Polling / event listening

Poll `TurnComplete` events every 2s (or use `watchContractEvent` from wagmi).

On each `TurnComplete`:
- Update HP bars with animation
- Append to battle log
- Update turn counter

On `BattleResult`:
- Show victory overlay (see below)
- Auto-redirect to `/result/[id]` after 3s

### Victory overlay (shown over arena before redirect)

```
Full screen overlay, semi-transparent dark bg.

If current wallet is winner:
  Large text: "Victory"
  Subtext: "You won [stake × 2] USDC"
  Color: green

If current wallet is loser:
  Large text: "Defeated"
  Subtext: "[winner address] wins"
  Color: red

Auto-redirect countdown: "Redirecting in 3..."
```

### Force settle button

```
Small button, bottom right, only visible if:
  state == ACTIVE AND block.timestamp > lastActionAt + 1h

"Force Settle" → calls BattleRoom.forceSettle()
Confirmation dialog first: "No activity for 1h. Settle by HP?"
```

---

## Screen 5 — Result `/result/[id]`

### Layout
Centered, max-width 560px.

### Content

```
Winner banner:
  If I won:  🏆  "You won!"   green
  If I lost:     "Defeated"   muted

USDC payout row:
  "Prize paid: [stake × 2] USDC"
  Tx hash: "View payout tx →" (links to Fuji explorer)

Final HP summary:
  Two columns — P1 cards vs P2 cards
  Each card: icon + name + final HP / maxHp
  Winner's cards slightly highlighted

Match stats:
  "Total turns: [n]"
  "Decisive hit: [CardName] dealt [n] dmg on turn [n]"
  (Find max single-turn damage from TurnComplete events)

Elemental breakdown:
  Small table showing which matchup did the most damage
  e.g. ⚡ vs 🌊 → avg 7 dmg/turn

Buttons:
  "Play Again"  → /lobby
  "Share"       → copies match URL to clipboard
```

---

## Global components

### Navbar (all screens except landing)

```
Left:  "CardBattle" wordmark
Right: Connected wallet address (truncated) + USDC balance + Disconnect
```

### Card component (reused across screens)

```tsx
interface CardProps {
  element: 0 | 1 | 2        // Fire / Water / Lightning
  atk: number
  def: number
  hp: number
  maxHp: number
  address: string
  selected?: boolean         // lobby selector
  isDead?: boolean           // hp === 0
  isActing?: boolean         // flash animation when submitting tx
}
```

When `isDead`: grayscale filter, opacity 50%, skull overlay.
When `isActing`: border pulses in element color (CSS animation, 600ms).

### Transaction toast

Every on-chain action shows a toast:
```
Pending  : "[Action]... View tx →"   (spinner)
Success  : "[Action] confirmed"       (green check)
Failed   : "Transaction failed"       (red x)
```

---

## Contract reads needed

```ts
// CardFactory
CardFactory.hasCards(address)                        → bool
CardFactory.getCards(address)                        → [address, address]

// CardAgent
CardAgent.element()                                  → uint8
CardAgent.atk()                                      → uint8
CardAgent.def()                                      → uint8
CardAgent.hp()                                       → uint8
CardAgent.maxHp()                                    → uint8

// BattleRoom
BattleRoom.state()                                   → uint8
BattleRoom.turn()                                    → uint8
BattleRoom.stake()                                   → uint256
BattleRoom.p1() / BattleRoom.p2()                    → Player struct
BattleRoom.lastActionAt()                            → uint256

// MockUSDC
MockUSDC.balanceOf(address)                          → uint256
MockUSDC.allowance(owner, spender)                   → uint256
```

## Contract writes needed

```ts
MockUSDC.approve(battleRoom, amount)
CardFactory.onboard()
BattleRoom.createRoom(cards[2], stakeAmount)
BattleRoom.joinRoom(cards[2])
BattleRoom.attackFor(cardAddress)     // MVP: owner signs on behalf of card
BattleRoom.defendFor(cardAddress)     // MVP: owner signs on behalf of card
BattleRoom.forceSettle()
```

## Events to watch

```ts
CardFactory : PlayerOnboarded(player, card1, card2)
BattleRoom  : RoomCreated(roomId, p1, stake)
BattleRoom  : RoomJoined(roomId, p2)
BattleRoom  : TurnStart(roomId, turn)
BattleRoom  : TurnComplete(roomId, turn, p1hp0, p1hp1, p2hp0, p2hp1)
BattleRoom  : BattleResult(roomId, winner, usdcPaid, finalTurn)
```

---

## Environment variables

```env
NEXT_PUBLIC_CHAIN_ID=43113
NEXT_PUBLIC_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
NEXT_PUBLIC_CARD_FACTORY=0x...
NEXT_PUBLIC_BATTLE_ROOM=0x...
NEXT_PUBLIC_MOCK_USDC=0x...
```

---
