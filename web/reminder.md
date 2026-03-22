# Elementzz — Reminders & TODOs

## DONE: Multi-Room Support
- [x] BattleRoom refactored with `mapping(uint256 => Room)` for multiple concurrent games
- [x] `createRoom` returns roomId, `joinRoom/attack/defend/forceSettle` all take roomId
- [x] `getRoomState(roomId)` view function for reading room data
- [x] Lobby lists open rooms, creates new ones with incrementing roomIds
- [x] Route players to `/room/[roomId]`

## DONE: USDC Approval Flow
- [x] Player approves USDC once via JAW popup (large allowance: 10000 USDC)
- [x] Session key then calls createRoom/joinRoom via permissions without further approval
- [x] Future: investigate JAW `spends` permission for fully automated approval

## DONE: Card Stats Rebalance
- [x] Fire: ATK=10, DEF=3, HP=15 (glass cannon)
- [x] Water: ATK=8, DEF=5, HP=17 (balanced)
- [x] Lightning: ATK=12, DEF=2, HP=13 (burst)
- [x] Super-effective matchups end in 1-2 turns, neutral in 2-4 turns
- [x] Typical game: 3-4 rounds

## Remaining TODOs
- [ ] Wire results page to on-chain data (read BattleResult event)
- [ ] Handle page refresh during battle (resume from on-chain state)
- [ ] Deploy to Vercel
- [ ] ENS subname issuance (elementzz.eth) — needs ENS on Sepolia not mainnet
