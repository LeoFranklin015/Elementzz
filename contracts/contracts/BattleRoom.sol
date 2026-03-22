// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./CardAgent.sol";
import "./CardFactory.sol";

/// @title BattleRoom
/// @notice Multi-room PvP card battle contract. Each room is independent.
contract BattleRoom is ReentrancyGuard {
    enum State  { WAITING, ACTIVE, SETTLED }
    enum Action { NONE, ATTACK, DEFEND }

    struct Slot {
        address cardAgent;
        uint8   element;
        uint8   atk;
        uint8   def;
        uint8   hp;
        uint8   maxHp;
        Action  action;
        bool    submitted;
    }

    struct Room {
        State   state;
        address p1Wallet;
        address p2Wallet;
        Slot[2] p1Slots;
        Slot[2] p2Slots;
        uint256 stake;
        uint8   turn;
        uint256 lastActionAt;
    }

    uint256 public roomCount;
    mapping(uint256 => Room) public rooms;

    address public immutable usdc;
    uint8   public constant MAX_TURNS = 20;
    address public immutable factory;

    // --- Events ---
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

    constructor(address _usdc, address _factory) {
        usdc = _usdc;
        factory = _factory;
    }

    // --- View helpers ---
    function getP1Slot(uint256 roomId, uint256 index) external view returns (
        address cardAgent, uint8 element, uint8 atkStat, uint8 defStat,
        uint8 hp, uint8 maxHp, Action action, bool submitted
    ) {
        Slot storage s = rooms[roomId].p1Slots[index];
        return (s.cardAgent, s.element, s.atk, s.def, s.hp, s.maxHp, s.action, s.submitted);
    }

    function getP2Slot(uint256 roomId, uint256 index) external view returns (
        address cardAgent, uint8 element, uint8 atkStat, uint8 defStat,
        uint8 hp, uint8 maxHp, Action action, bool submitted
    ) {
        Slot storage s = rooms[roomId].p2Slots[index];
        return (s.cardAgent, s.element, s.atk, s.def, s.hp, s.maxHp, s.action, s.submitted);
    }

    function getRoomState(uint256 roomId) external view returns (
        State state, address p1Wallet, address p2Wallet, uint256 stake, uint8 turn, uint256 lastActionAt
    ) {
        Room storage r = rooms[roomId];
        return (r.state, r.p1Wallet, r.p2Wallet, r.stake, r.turn, r.lastActionAt);
    }

    // --- Core functions ---

    /// @notice Player 1 creates a room with permit (no separate approve needed)
    function createRoom(
        address[2] calldata cards,
        uint256 stakeAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r_sig,
        bytes32 s
    ) external returns (uint256) {
        require(stakeAmount > 0, "stake must be > 0");

        // Permit: sets allowance in same tx, then transfer
        try IERC20Permit(usdc).permit(msg.sender, address(this), stakeAmount, deadline, v, r_sig, s) {} catch {}
        IERC20(usdc).transferFrom(msg.sender, address(this), stakeAmount);

        uint256 roomId = roomCount++;
        Room storage r = rooms[roomId];
        r.state = State.WAITING;
        r.p1Wallet = msg.sender;
        r.stake = stakeAmount;

        for (uint256 i = 0; i < 2; i++) {
            CardAgent card = CardAgent(cards[i]);
            uint8 mhp = card.maxHp();
            r.p1Slots[i] = Slot({
                cardAgent: cards[i],
                element:   card.element(),
                atk:       card.atk(),
                def:       card.def(),
                hp:        mhp,     // Always start at full HP
                maxHp:     mhp,
                action:    Action.NONE,
                submitted: false
            });
            CardFactory(factory).lockCard(cards[i], address(this));
        }

        emit RoomCreated(roomId, msg.sender, stakeAmount);
        return roomId;
    }

    /// @notice Player 2 joins a room with permit
    function joinRoom(
        uint256 roomId,
        address[2] calldata cards,
        uint256 deadline,
        uint8 v,
        bytes32 r_sig,
        bytes32 s
    ) external {
        Room storage r = rooms[roomId];
        require(r.state == State.WAITING, "not waiting");
        require(r.p1Wallet != address(0), "room not created");
        require(msg.sender != r.p1Wallet, "cannot join own room");

        try IERC20Permit(usdc).permit(msg.sender, address(this), r.stake, deadline, v, r_sig, s) {} catch {}
        IERC20(usdc).transferFrom(msg.sender, address(this), r.stake);

        r.p2Wallet = msg.sender;

        for (uint256 i = 0; i < 2; i++) {
            CardAgent card = CardAgent(cards[i]);
            uint8 mhp = card.maxHp();
            r.p2Slots[i] = Slot({
                cardAgent: cards[i],
                element:   card.element(),
                atk:       card.atk(),
                def:       card.def(),
                hp:        mhp,     // Always start at full HP
                maxHp:     mhp,
                action:    Action.NONE,
                submitted: false
            });
            CardFactory(factory).lockCard(cards[i], address(this));
        }

        r.state = State.ACTIVE;
        r.turn = 1;
        r.lastActionAt = block.timestamp;

        emit RoomJoined(roomId, msg.sender);
        emit TurnStart(roomId, 1);
    }

    /// @notice Card submits ATTACK. roomId must be provided.
    function attack(uint256 roomId) external {
        _onlyCardInRoom(roomId, msg.sender);
        _onlyActive(roomId);
        _submitAction(roomId, msg.sender, Action.ATTACK);
    }

    /// @notice Card submits DEFEND.
    function defend(uint256 roomId) external {
        _onlyCardInRoom(roomId, msg.sender);
        _onlyActive(roomId);
        _submitAction(roomId, msg.sender, Action.DEFEND);
    }

    function _onlyCardInRoom(uint256 roomId, address card) internal view {
        Room storage r = rooms[roomId];
        bool found = (
            card == r.p1Slots[0].cardAgent ||
            card == r.p1Slots[1].cardAgent ||
            card == r.p2Slots[0].cardAgent ||
            card == r.p2Slots[1].cardAgent
        );
        require(found, "not a card in this room");
    }

    function _onlyActive(uint256 roomId) internal view {
        require(rooms[roomId].state == State.ACTIVE, "not active");
    }

    function _submitAction(uint256 roomId, address cardAddr, Action action) internal {
        Room storage r = rooms[roomId];
        Slot storage slot = _findSlot(roomId, cardAddr);
        require(slot.hp > 0, "card is dead");
        require(!slot.submitted, "already submitted");

        slot.action = action;
        slot.submitted = true;
        r.lastActionAt = block.timestamp;

        if (_allAliveSubmitted(roomId)) {
            _resolveTurn(roomId);
        }
    }

    function _findSlot(uint256 roomId, address cardAddr) internal view returns (Slot storage) {
        Room storage r = rooms[roomId];
        if (r.p1Slots[0].cardAgent == cardAddr) return r.p1Slots[0];
        if (r.p1Slots[1].cardAgent == cardAddr) return r.p1Slots[1];
        if (r.p2Slots[0].cardAgent == cardAddr) return r.p2Slots[0];
        if (r.p2Slots[1].cardAgent == cardAddr) return r.p2Slots[1];
        revert("card not found");
    }

    function _allAliveSubmitted(uint256 roomId) internal view returns (bool) {
        Room storage r = rooms[roomId];
        for (uint256 i = 0; i < 2; i++) {
            if (r.p1Slots[i].hp > 0 && !r.p1Slots[i].submitted) return false;
            if (r.p2Slots[i].hp > 0 && !r.p2Slots[i].submitted) return false;
        }
        return true;
    }

    function _resolveTurn(uint256 roomId) internal {
        Room storage r = rooms[roomId];

        for (uint256 i = 0; i < 2; i++) {
            Slot storage p1s = r.p1Slots[i];
            Slot storage p2s = r.p2Slots[i];

            if (p1s.hp == 0 && p2s.hp == 0) continue;

            uint8 dmgToP2 = p1s.hp > 0 ? _calcDamage(p1s, p2s) : 0;
            uint8 dmgToP1 = p2s.hp > 0 ? _calcDamage(p2s, p1s) : 0;

            uint8 p1NewHp = dmgToP1 >= p1s.hp ? 0 : p1s.hp - dmgToP1;
            uint8 p2NewHp = dmgToP2 >= p2s.hp ? 0 : p2s.hp - dmgToP2;

            if (dmgToP1 > 0) CardAgent(p1s.cardAgent).takeDamage(dmgToP1);
            if (dmgToP2 > 0) CardAgent(p2s.cardAgent).takeDamage(dmgToP2);

            p1s.hp = p1NewHp;
            p2s.hp = p2NewHp;

            // DEFEND regen
            if (p1s.action == Action.DEFEND && p1s.hp > 0) {
                uint8 regen = p1s.hp + 2 > p1s.maxHp ? p1s.maxHp - p1s.hp : 2;
                p1s.hp += regen;
                if (regen > 0) CardAgent(p1s.cardAgent).applyRegen(regen);
            }
            if (p2s.action == Action.DEFEND && p2s.hp > 0) {
                uint8 regen = p2s.hp + 2 > p2s.maxHp ? p2s.maxHp - p2s.hp : 2;
                p2s.hp += regen;
                if (regen > 0) CardAgent(p2s.cardAgent).applyRegen(regen);
            }

            p1s.action = Action.NONE;
            p1s.submitted = false;
            p2s.action = Action.NONE;
            p2s.submitted = false;
        }

        emit TurnComplete(
            roomId, r.turn,
            r.p1Slots[0].hp, r.p1Slots[1].hp,
            r.p2Slots[0].hp, r.p2Slots[1].hp
        );

        bool p1Dead = r.p1Slots[0].hp == 0 && r.p1Slots[1].hp == 0;
        bool p2Dead = r.p2Slots[0].hp == 0 && r.p2Slots[1].hp == 0;

        if (p1Dead && p2Dead) {
            _settleRefund(roomId);
        } else if (p1Dead) {
            _settle(roomId, r.p2Wallet);
        } else if (p2Dead) {
            _settle(roomId, r.p1Wallet);
        } else if (r.turn >= MAX_TURNS || _isStalemate(roomId)) {
            uint256 p1Total = uint256(r.p1Slots[0].hp) + uint256(r.p1Slots[1].hp);
            uint256 p2Total = uint256(r.p2Slots[0].hp) + uint256(r.p2Slots[1].hp);
            if (p1Total > p2Total) {
                _settle(roomId, r.p1Wallet);
            } else if (p2Total > p1Total) {
                _settle(roomId, r.p2Wallet);
            } else {
                _settleRefund(roomId);
            }
        } else {
            r.turn++;
            emit TurnStart(roomId, r.turn);
        }
    }

    function _isStalemate(uint256 roomId) internal view returns (bool) {
        Room storage r = rooms[roomId];
        for (uint256 i = 0; i < 2; i++) {
            if (r.p1Slots[i].hp > 0 && r.p2Slots[i].hp > 0) return false;
        }
        return true;
    }

    function _calcDamage(Slot storage attacker, Slot storage defender) internal view returns (uint8) {
        uint256 mult   = _multiplier(attacker.element, defender.element);
        uint256 rawAtk = (uint256(attacker.atk) * mult) / 100;
        uint256 net    = rawAtk > uint256(defender.def) ? rawAtk - uint256(defender.def) : 1;
        if (defender.action == Action.DEFEND) {
            net = net > 1 ? net / 2 : 1;
        }
        return net > 255 ? 255 : uint8(net);
    }

    function _multiplier(uint8 atkEl, uint8 defEl) internal pure returns (uint256) {
        uint8[3][3] memory t = [
            [uint8(120), uint8( 50), uint8(200)],
            [uint8(200), uint8(120), uint8( 50)],
            [uint8( 50), uint8(200), uint8(120)]
        ];
        return uint256(t[atkEl][defEl]);
    }

    function _settle(uint256 roomId, address winner) internal nonReentrant {
        Room storage r = rooms[roomId];
        r.state = State.SETTLED;
        uint256 payout = r.stake * 2;

        emit BattleResult(roomId, winner, payout, r.turn);
        IERC20(usdc).transfer(winner, payout);
        _clearAllCards(roomId);
    }

    function _settleRefund(uint256 roomId) internal nonReentrant {
        Room storage r = rooms[roomId];
        r.state = State.SETTLED;

        emit BattleResult(roomId, address(0), 0, r.turn);
        IERC20(usdc).transfer(r.p1Wallet, r.stake);
        IERC20(usdc).transfer(r.p2Wallet, r.stake);
        _clearAllCards(roomId);
    }

    function _clearAllCards(uint256 roomId) internal {
        Room storage r = rooms[roomId];
        for (uint256 i = 0; i < 2; i++) {
            if (r.p1Slots[i].cardAgent != address(0)) CardAgent(r.p1Slots[i].cardAgent).clearRoom();
            if (r.p2Slots[i].cardAgent != address(0)) CardAgent(r.p2Slots[i].cardAgent).clearRoom();
        }
    }

    /// @notice Force settle after 1 hour timeout
    function forceSettle(uint256 roomId) external {
        Room storage r = rooms[roomId];
        require(r.state == State.ACTIVE, "not active");
        require(msg.sender == r.p1Wallet || msg.sender == r.p2Wallet, "not a player");
        require(block.timestamp >= r.lastActionAt + 1 hours, "timeout not reached");

        uint256 p1Total = uint256(r.p1Slots[0].hp) + uint256(r.p1Slots[1].hp);
        uint256 p2Total = uint256(r.p2Slots[0].hp) + uint256(r.p2Slots[1].hp);

        if (p1Total > p2Total) {
            _settle(roomId, r.p1Wallet);
        } else if (p2Total > p1Total) {
            _settle(roomId, r.p2Wallet);
        } else {
            _settleRefund(roomId);
        }
    }
}
