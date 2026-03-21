# CardBattle — Build & Test Spec

> Paste this entire file into a Claude conversation and say:
> **"Build and test everything in this spec. Use Hardhat. Solidity ^0.8.24."**

---

## What you are building

A fully on-chain PvP card battle game on Avalanche L1 where each card is an ERC-8004 autonomous agent wallet. Players stake USDC, their cards autonomously submit `attack()` or `defend()` each turn via scoped session keys, and the winner receives both stakes.

Three contracts + one off-chain agent runner + a full Hardhat test suite.

---

## Project structure

```
cardbattle/
├── contracts/
│   ├── CardAgent.sol
│   ├── CardFactory.sol
│   ├── BattleRoom.sol
│   └── mocks/
│       └── MockUSDC.sol
├── scripts/
│   └── deploy.ts
├── agent/
│   └── runner.ts
├── test/
│   ├── elemental.test.ts
│   ├── cardagent.test.ts
│   └── battleroom.test.ts
├── hardhat.config.ts
└── package.json
```

---

## Elemental system

### Triangle
```
Fire      beats  Lightning   (1.75×)
Water     beats  Fire        (1.75×)
Lightning beats  Water       (1.75×)
```

### 3×3 multiplier table (scaled ×100 for integer math)

```
[attacker][defender]   FIRE   WATER   LIGHTNING
FIRE                    100      50        175
WATER                   175     100         50
LIGHTNING                50     175        100
```

Encoded in Solidity as:
```solidity
uint8[3][3] memory t = [
    [uint8(100), uint8( 50), uint8(175)],  // Fire
    [uint8(175), uint8(100), uint8( 50)],  // Water
    [uint8( 50), uint8(175), uint8(100)]   // Lightning
];
return t[atkElement][defElement];
```

### Base stats per element

| Element   | ATK | DEF | HP | Role |
|-----------|-----|-----|----|------|
| Fire      |  8  |  4  | 20 | Aggressive — strong vs Lightning, weak vs Water |
| Water     |  5  |  8  | 22 | Defensive  — strong vs Fire, weak vs Lightning |
| Lightning |  9  |  3  | 18 | Burst      — strong vs Water, weak vs Fire |

### Damage formula

```
rawAtk = floor(attacker.atk × MULT_TABLE[attacker.element][defender.element] / 100)
net    = max(1, rawAtk − defender.def)

if defender chose DEFEND this turn:
  net = max(1, floor(net / 2))

Both cards deal damage simultaneously — resolve in parallel, not sequentially.
```

### DEFEND regen rule
After damage is applied, if a card chose DEFEND: `hp = min(hp + 2, maxHp)`. Regen is capped at maxHp and applied after taking damage so it cannot negate the hit entirely.

### Worked examples (use these as unit test cases)

```
1. Fire (atk=8) vs Water (def=8), no defend — resisted
   rawAtk = floor(8 × 50 / 100) = 4
   net    = max(1, 4 − 8)       = 1

2. Water (atk=5) vs Fire (def=4), Fire is defending — super effective
   rawAtk = floor(5 × 175 / 100) = 8
   net    = max(1, 8 − 4)        = 4
   halved = max(1, 4 / 2)        = 2

3. Lightning (atk=9) vs Water (def=8), no defend — super effective
   rawAtk = floor(9 × 175 / 100) = 15
   net    = max(1, 15 − 8)       = 7

4. Fire (atk=8) vs Lightning (def=3), no defend — super effective
   rawAtk = floor(8 × 175 / 100) = 14
   net    = max(1, 14 − 3)       = 11
```

---

## Contract 1 — CardAgent.sol

### What it is
An ERC-8004 autonomous agent smart account. Each card is its own wallet with its own address. Holds its own stats as storage. Can only act inside the BattleRoom it is locked into, via a scoped session key.

### Constants
```solidity
uint8 constant FIRE      = 0;
uint8 constant WATER     = 1;
uint8 constant LIGHTNING = 2;
```

### Storage
```solidity
address public owner;
address public factory;
uint8   public element;     // 0=Fire 1=Water 2=Lightning
uint8   public atk;
uint8   public def;
uint8   public hp;          // mutable during battle
uint8   public maxHp;
bool    public inBattle;
address public activeRoom;
```

### Functions

```solidity
function initialize(
    address _owner,
    uint8 _element,
    uint8 _atk,
    uint8 _def,
    uint8 _hp
) external
```
- Called once by CardFactory after deploy
- Sets all stats. `maxHp = _hp`
- Reverts if already initialized

```solidity
function takeDamage(uint8 amount) external onlyActiveRoom
```
- Reduces `hp` by `amount`. `hp` cannot go below 0.

```solidity
function applyRegen(uint8 amount) external onlyActiveRoom
```
- Adds `amount` to `hp` up to `maxHp`.

```solidity
function setActiveRoom(address room) external onlyFactory
```
- Sets `activeRoom = room`, `inBattle = true`
- Reverts if `inBattle == true`

```solidity
function clearRoom() external onlyActiveRoom
```
- Resets `inBattle = false`, `activeRoom = address(0)`

### Access control modifiers
```solidity
modifier onlyFactory()     { require(msg.sender == factory); _; }
modifier onlyActiveRoom()  { require(msg.sender == activeRoom); _; }
```

---

## Contract 2 — CardFactory.sol

### What it is
Deploys two `CardAgent` contracts per player. Assigns random element + stats. Issues scoped session keys via JAW `SessionKeyModule`. Tracks card ownership.

> **MVP note:** For initial build and testing, skip JAW session keys. The card owner can call `attack()` / `defend()` directly. Add session key scoping in a second pass.

### Storage
```solidity
mapping(address => address[2]) public playerCards;
mapping(address => bool)       public hasCards;
address public immutable sessionKeyModule;
mapping(address => bool)       public allowedRooms;
address public owner;
```

### Functions

```solidity
function onboard() external
```
- Reverts if `hasCards[msg.sender]`
- Deploys two `CardAgent` contracts for `msg.sender`
- Assigns element via `uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, msg.sender, i))) % 3)` — different seed per card
- Sets stats from element preset table (see above)
- Calls `CardAgent.initialize()` on each
- Sets `hasCards[msg.sender] = true`
- Stores in `playerCards[msg.sender]`
- Emits `PlayerOnboarded(msg.sender, card1, card2)`

```solidity
function getCards(address player)
    external view returns (address card1, address card2)
```

```solidity
function allowRoom(address room) external onlyOwner
```
- Adds room to `allowedRooms`

```solidity
function lockCard(address card, address room) external
```
- Called internally by BattleRoom via delegated call, or exposed for BattleRoom to call
- Calls `CardAgent.setActiveRoom(room)` on behalf of factory
- Reverts if `!allowedRooms[room]`

### Events
```solidity
event PlayerOnboarded(address indexed player, address card1, address card2);
```

---

## Contract 3 — BattleRoom.sol

### What it is
The core game contract. State machine for a single match. Holds USDC escrow. Receives `attack()` / `defend()` from card session keys. Resolves turns using the elemental formula. Pays winner.

### Enums and structs

```solidity
enum State  { WAITING, ACTIVE, SETTLED }
enum Action { NONE, ATTACK, DEFEND }

struct Slot {
    address cardAgent;   // CardAgent contract address
    uint8   element;
    uint8   atk;
    uint8   def;
    uint8   hp;
    Action  action;      // chosen this turn
    bool    submitted;   // has acted this turn?
}

struct Player {
    address wallet;
    Slot[2] slots;
}
```

### Storage
```solidity
uint256 public roomId;
State   public state;
Player  public p1;
Player  public p2;
address public immutable usdc;
uint256 public stake;
uint8   public turn;
uint256 public lastActionAt;     // timestamp — for forceSettle timeout
uint8   public constant MAX_TURNS = 20;
address public immutable factory;
```

HP is snapshotted from `CardAgent` into `Slot` at room creation. `Slot.hp` is the source of truth during battle. `CardAgent.takeDamage()` and `CardAgent.applyRegen()` are called to keep the agent in sync.

### Functions

```solidity
function createRoom(
    address[2] calldata cards,
    uint256 stakeAmount
) external
```
- Reverts if `state != WAITING` (already created)
- Pulls `stakeAmount` USDC from `msg.sender` via `transferFrom`
- For each card: reads `element`, `atk`, `def`, `hp` from `CardAgent` and snapshots into `p1.slots`
- Calls `CardFactory.lockCard(card, address(this))` for each P1 card
- Sets `stake = stakeAmount`, `state = WAITING`
- Emits `RoomCreated(roomId, msg.sender, stakeAmount)`

```solidity
function joinRoom(address[2] calldata cards) external
```
- Reverts if `state != WAITING`
- Reverts if `msg.sender == p1.wallet`
- Pulls `stake` USDC from P2
- Snapshots P2 cards into `p2.slots`
- Locks P2 cards
- Sets `state = ACTIVE`, `turn = 1`, `lastActionAt = block.timestamp`
- Emits `RoomJoined(roomId, msg.sender)`
- Emits `TurnStart(roomId, 1)`

```solidity
function attack() external onlyCardInRoom onlyActive
```
- Identifies which slot `msg.sender` belongs to (P1 or P2, slot 0 or 1)
- Sets `slot.action = ATTACK`, `slot.submitted = true`
- Updates `lastActionAt`
- If all 4 cards submitted: calls `_resolveTurn()`

```solidity
function defend() external onlyCardInRoom onlyActive
```
- Same as `attack()` but `Action.DEFEND`

```solidity
function _resolveTurn() internal
```
Resolve slot 0 pair and slot 1 pair. For each pair:
```
dmgToP2 = _calcDamage(p1slot, p2slot)
dmgToP1 = _calcDamage(p2slot, p1slot)

apply simultaneously:
  p1slot.hp = p1slot.hp > dmgToP1 ? p1slot.hp - dmgToP1 : 0
  p2slot.hp = p2slot.hp > dmgToP2 ? p2slot.hp - dmgToP2 : 0

sync to CardAgent:
  CardAgent(p1slot.cardAgent).takeDamage(dmgToP1)
  CardAgent(p2slot.cardAgent).takeDamage(dmgToP2)

if slot chose DEFEND:
  apply regen: slot.hp = min(slot.hp + 2, maxHp)
  CardAgent(slot.cardAgent).applyRegen(2)

reset: slot.action = NONE, slot.submitted = false (all 4 slots)
```
After both pairs resolved:
- Emit `TurnComplete(roomId, turn, p1hp0, p1hp1, p2hp0, p2hp1)`
- If P1 both slots at hp=0: `_settle(p2.wallet)`
- Else if P2 both slots at hp=0: `_settle(p1.wallet)`
- Else if `turn >= MAX_TURNS`: `_settle(higherTotalHp)`
- Else: `turn++`, emit `TurnStart(roomId, turn)`

```solidity
function _calcDamage(
    Slot memory attacker,
    Slot memory defender
) internal pure returns (uint8)
```
```solidity
uint256 mult   = _multiplier(attacker.element, defender.element);
uint256 rawAtk = (uint256(attacker.atk) * mult) / 100;
uint256 net    = rawAtk > defender.def ? rawAtk - defender.def : 1;
if (defender.action == Action.DEFEND) net = net > 1 ? net / 2 : 1;
return net > 255 ? 255 : uint8(net);
```

```solidity
function _multiplier(uint8 atkEl, uint8 defEl)
    internal pure returns (uint256)
```
Returns value from the 3×3 table above.

```solidity
function _settle(address winner) internal
```
- `state = SETTLED`
- `IERC20(usdc).transfer(winner, stake * 2)`
- `CardAgent(card).clearRoom()` on all 4 cards
- Emit `BattleResult(roomId, winner, stake * 2, turn)`

```solidity
function forceSettle() external
```
- Callable by either player only
- Reverts if `block.timestamp < lastActionAt + 1 hours`
- Calculates total HP remaining for each player
- If P1 total > P2 total: `_settle(p1.wallet)`
- If P2 total > P1 total: `_settle(p2.wallet)`
- If equal: refund both (`stake` each), set `state = SETTLED`

### Access control modifiers
```solidity
modifier onlyCardInRoom() {
    bool found = (
        msg.sender == p1.slots[0].cardAgent ||
        msg.sender == p1.slots[1].cardAgent ||
        msg.sender == p2.slots[0].cardAgent ||
        msg.sender == p2.slots[1].cardAgent
    );
    require(found, "not a card in this room");
    _;
}
modifier onlyActive() { require(state == State.ACTIVE); _; }
```

### Events
```solidity
event RoomCreated(uint256 indexed roomId, address p1, uint256 stake);
event RoomJoined(uint256 indexed roomId, address p2);
event TurnStart(uint256 indexed roomId, uint8 turn);
event TurnComplete(
    uint256 indexed roomId, uint8 turn,
    uint8 p1hp0, uint8 p1hp1,
    uint8 p2hp0, uint8 p2hp1
);
event BattleResult(
    uint256 indexed roomId,
    address winner,
    uint256 usdcPaid,
    uint8   finalTurn
);
```

---

## Mock contract — MockUSDC.sol

```solidity
// Standard ERC-20 with a public mint function for testnet use
function mint(address to, uint256 amount) external {
    _mint(to, amount);
}
```

---

## Off-chain agent runner — agent/runner.ts

Watches `TurnStart` events and autonomously submits `attack()` or `defend()` for each card.

### Decision logic

```ts
const MULT: Record<number, Record<number, number>> = {
  0: { 0: 100, 1:  50, 2: 175 },  // Fire
  1: { 0: 175, 1: 100, 2:  50 },  // Water
  2: { 0:  50, 1: 175, 2: 100 },  // Lightning
}

function decide(my: CardState, opp: CardState): 'attack' | 'defend' {
  const myMult      = MULT[my.element][opp.element]
  const rawAtk      = Math.floor(my.atk * myMult / 100)
  const myDamage    = Math.max(1, rawAtk - opp.def)

  const oppMult     = MULT[opp.element][my.element]
  const oppRawAtk   = Math.floor(opp.atk * oppMult / 100)
  const incomingDmg = Math.max(1, oppRawAtk - my.def)

  // defend if incoming hit would kill us
  if (incomingDmg >= my.hp)                          return 'defend'
  // defend if low HP and can't finish them
  if (my.hp / my.maxHp < 0.3 && myDamage < opp.hp)  return 'defend'
  // press elemental advantage
  if (myMult === 175)                                 return 'attack'
  // attack if damage is meaningful
  if (myDamage >= 3)                                  return 'attack'
  // default: conserve HP
  return 'defend'
}
```

### Runner flow
1. Connect to RPC, listen for `TurnStart(roomId, turn)` on BattleRoom
2. For each card owned by this player in that room:
   - Read current HP from `Slot` (or `CardAgent.hp`)
   - Call `decide(myCard, opponentCard)`
   - Sign and submit `card.attack()` or `card.defend()` using card's session key (or owner key for MVP)
3. Listen for `TurnComplete` to update local state cache

---

## Deployment script — scripts/deploy.ts

Deploy in this exact order:

```ts
1. MockUSDC.deploy()
2. CardAgent implementation = CardAgent.deploy()   // logic only, no init
3. CardFactory.deploy(sessionKeyModuleAddress)     // pass zero address for MVP
4. BattleRoom.deploy(mockUSDC.address, cardFactory.address)
5. cardFactory.allowRoom(battleRoom.address)
// Print all addresses
```

---

## Test suite

### test/elemental.test.ts — unit tests for damage formula

Deploy a helper contract that exposes `_calcDamage` and `_multiplier` as public functions.

```
[ ] Fire (atk=8) vs Water (def=8), no defend → damage = 1
[ ] Water (atk=5) vs Fire (def=4), Fire defending → damage = 2
[ ] Lightning (atk=9) vs Water (def=8), no defend → damage = 7
[ ] Fire (atk=8) vs Lightning (def=3), no defend → damage = 11
[ ] Same element, no defend → uses 1× multiplier
[ ] Any attacker, defender defending → damage = max(1, floor(normal/2))
[ ] DEFEND regen = +2 HP, capped at maxHp
[ ] rawAtk < def → net = 1 (never 0)
```

### test/cardagent.test.ts — unit tests for CardAgent

```
[ ] initialize() sets element, atk, def, hp, maxHp correctly
[ ] initialize() reverts on second call
[ ] takeDamage() reduces hp correctly
[ ] takeDamage() cannot reduce hp below 0
[ ] applyRegen() adds hp correctly
[ ] applyRegen() cannot exceed maxHp
[ ] setActiveRoom() sets inBattle=true and activeRoom
[ ] setActiveRoom() reverts if already inBattle
[ ] clearRoom() resets inBattle=false and activeRoom=address(0)
[ ] takeDamage() reverts if caller != activeRoom
[ ] clearRoom() reverts if caller != activeRoom
[ ] setActiveRoom() reverts if caller != factory
```

### test/battleroom.test.ts — integration tests

Setup: deploy MockUSDC, CardFactory, BattleRoom. Mint USDC to two test players. Each player calls `onboard()`.

```
[ ] createRoom() transfers USDC to contract and locks P1 cards
[ ] createRoom() reverts if P1 has not called onboard()
[ ] joinRoom() with matching stake starts battle, emits TurnStart
[ ] joinRoom() reverts with wrong stake amount
[ ] joinRoom() reverts if P1 tries to join own room
[ ] attack() from a non-card address reverts
[ ] defend() from a non-card address reverts
[ ] all 4 cards submit attack() → _resolveTurn() fires, TurnComplete emitted
[ ] HP values in TurnComplete match expected formula output
[ ] p2 cards reach hp=0 → BattleResult emitted with p1 as winner
[ ] USDC balance of winner = stake × 2 after settlement
[ ] USDC balance of contract = 0 after settlement
[ ] cards cleared from room after settlement (inBattle=false)
[ ] turn reaches MAX_TURNS → winner = higher total HP
[ ] forceSettle() reverts before 1h timeout
[ ] forceSettle() after 1h → pays correct winner
[ ] forceSettle() equal HP → refunds both players
```

---

## Notes for Claude

- Solidity `^0.8.24`. Use `unchecked` blocks where safe (HP arithmetic after bounds check).
- All USDC amounts are in 6 decimals (USDC standard). MockUSDC should use `decimals() = 6`.
- `roomId` can be a simple incrementing counter managed by a `BattleRoomFactory` or hardcoded to 1 per deployed BattleRoom for MVP.
- For MVP, skip JAW session keys — card owner address can call `attack()` / `defend()` directly. The `onlyCardInRoom` modifier checks `msg.sender == cardAgent address`. For MVP testing, impersonate the card address using Hardhat's `hardhat_impersonateAccount`.
- Emit events before state changes where possible (CEI pattern for reentrancy safety).
- `_settle()` should use `nonReentrant` guard (import OpenZeppelin `ReentrancyGuard`).
- Do not use `block.timestamp` for game logic other than the `forceSettle` timeout.