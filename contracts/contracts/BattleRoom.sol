// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CardAgent.sol";
import "./CardFactory.sol";

/// @title BattleRoom
/// @notice Core PvP card battle contract. State machine for a single match.
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

    uint256 public roomId;
    State   public state;

    address public p1Wallet;
    address public p2Wallet;
    Slot[2] private _p1Slots;
    Slot[2] private _p2Slots;

    address public immutable usdc;
    uint256 public stake;
    uint8   public turn;
    uint256 public lastActionAt;
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

    // --- Modifiers ---
    modifier onlyCardInRoom() {
        bool found = (
            msg.sender == _p1Slots[0].cardAgent ||
            msg.sender == _p1Slots[1].cardAgent ||
            msg.sender == _p2Slots[0].cardAgent ||
            msg.sender == _p2Slots[1].cardAgent
        );
        require(found, "not a card in this room");
        _;
    }

    modifier onlyActive() {
        require(state == State.ACTIVE, "not active");
        _;
    }

    constructor(address _usdc, address _factory) {
        usdc = _usdc;
        factory = _factory;
        roomId = 1; // MVP: one room per deployed contract
    }

    // --- View helpers ---
    function getP1Slot(uint256 index) external view returns (
        address cardAgent, uint8 element, uint8 atkStat, uint8 defStat,
        uint8 hp, uint8 maxHp, Action action, bool submitted
    ) {
        Slot storage s = _p1Slots[index];
        return (s.cardAgent, s.element, s.atk, s.def, s.hp, s.maxHp, s.action, s.submitted);
    }

    function getP2Slot(uint256 index) external view returns (
        address cardAgent, uint8 element, uint8 atkStat, uint8 defStat,
        uint8 hp, uint8 maxHp, Action action, bool submitted
    ) {
        Slot storage s = _p2Slots[index];
        return (s.cardAgent, s.element, s.atk, s.def, s.hp, s.maxHp, s.action, s.submitted);
    }

    // --- Core functions ---

    /// @notice Player 1 creates a room with two cards and a USDC stake
    function createRoom(
        address[2] calldata cards,
        uint256 stakeAmount
    ) external {
        require(state == State.WAITING, "room already created");
        require(stakeAmount > 0, "stake must be > 0");

        IERC20(usdc).transferFrom(msg.sender, address(this), stakeAmount);

        p1Wallet = msg.sender;
        stake = stakeAmount;

        for (uint256 i = 0; i < 2; i++) {
            CardAgent card = CardAgent(cards[i]);
            _p1Slots[i] = Slot({
                cardAgent: cards[i],
                element:   card.element(),
                atk:       card.atk(),
                def:       card.def(),
                hp:        card.hp(),
                maxHp:     card.maxHp(),
                action:    Action.NONE,
                submitted: false
            });
            CardFactory(factory).lockCard(cards[i], address(this));
        }

        emit RoomCreated(roomId, msg.sender, stakeAmount);
    }

    /// @notice Player 2 joins the room with two cards, matching the stake
    function joinRoom(address[2] calldata cards) external {
        require(state == State.WAITING, "not waiting");
        require(p1Wallet != address(0), "room not created");
        require(msg.sender != p1Wallet, "cannot join own room");

        IERC20(usdc).transferFrom(msg.sender, address(this), stake);

        p2Wallet = msg.sender;

        for (uint256 i = 0; i < 2; i++) {
            CardAgent card = CardAgent(cards[i]);
            _p2Slots[i] = Slot({
                cardAgent: cards[i],
                element:   card.element(),
                atk:       card.atk(),
                def:       card.def(),
                hp:        card.hp(),
                maxHp:     card.maxHp(),
                action:    Action.NONE,
                submitted: false
            });
            CardFactory(factory).lockCard(cards[i], address(this));
        }

        state = State.ACTIVE;
        turn = 1;
        lastActionAt = block.timestamp;

        emit RoomJoined(roomId, msg.sender);
        emit TurnStart(roomId, 1);
    }

    /// @notice Card submits an ATTACK action
    function attack() external onlyCardInRoom onlyActive {
        _submitAction(msg.sender, Action.ATTACK);
    }

    /// @notice Card submits a DEFEND action
    function defend() external onlyCardInRoom onlyActive {
        _submitAction(msg.sender, Action.DEFEND);
    }

    function _submitAction(address cardAddr, Action action) internal {
        Slot storage slot = _findSlot(cardAddr);
        require(slot.hp > 0, "card is dead");
        require(!slot.submitted, "already submitted");

        slot.action = action;
        slot.submitted = true;
        lastActionAt = block.timestamp;

        if (_allAliveSubmitted()) {
            _resolveTurn();
        }
    }

    function _findSlot(address cardAddr) internal view returns (Slot storage) {
        if (_p1Slots[0].cardAgent == cardAddr) return _p1Slots[0];
        if (_p1Slots[1].cardAgent == cardAddr) return _p1Slots[1];
        if (_p2Slots[0].cardAgent == cardAddr) return _p2Slots[0];
        if (_p2Slots[1].cardAgent == cardAddr) return _p2Slots[1];
        revert("card not found");
    }

    function _allAliveSubmitted() internal view returns (bool) {
        for (uint256 i = 0; i < 2; i++) {
            if (_p1Slots[i].hp > 0 && !_p1Slots[i].submitted) return false;
            if (_p2Slots[i].hp > 0 && !_p2Slots[i].submitted) return false;
        }
        return true;
    }

    function _resolveTurn() internal {
        // Resolve each slot pair simultaneously
        for (uint256 i = 0; i < 2; i++) {
            Slot storage p1s = _p1Slots[i];
            Slot storage p2s = _p2Slots[i];

            // Skip if both dead
            if (p1s.hp == 0 && p2s.hp == 0) continue;

            uint8 dmgToP2 = p1s.hp > 0 ? _calcDamage(p1s, p2s) : 0;
            uint8 dmgToP1 = p2s.hp > 0 ? _calcDamage(p2s, p1s) : 0;

            // Apply damage simultaneously
            uint8 p1NewHp = dmgToP1 >= p1s.hp ? 0 : p1s.hp - dmgToP1;
            uint8 p2NewHp = dmgToP2 >= p2s.hp ? 0 : p2s.hp - dmgToP2;

            // Sync damage to CardAgent
            if (dmgToP1 > 0) CardAgent(p1s.cardAgent).takeDamage(dmgToP1);
            if (dmgToP2 > 0) CardAgent(p2s.cardAgent).takeDamage(dmgToP2);

            p1s.hp = p1NewHp;
            p2s.hp = p2NewHp;

            // DEFEND regen: +2 HP capped at maxHp, applied after damage
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

            // Reset actions
            p1s.action = Action.NONE;
            p1s.submitted = false;
            p2s.action = Action.NONE;
            p2s.submitted = false;
        }

        emit TurnComplete(
            roomId, turn,
            _p1Slots[0].hp, _p1Slots[1].hp,
            _p2Slots[0].hp, _p2Slots[1].hp
        );

        // Check win conditions
        bool p1Dead = _p1Slots[0].hp == 0 && _p1Slots[1].hp == 0;
        bool p2Dead = _p2Slots[0].hp == 0 && _p2Slots[1].hp == 0;

        if (p1Dead && p2Dead) {
            _settleRefund();
        } else if (p1Dead) {
            _settle(p2Wallet);
        } else if (p2Dead) {
            _settle(p1Wallet);
        } else if (turn >= MAX_TURNS || _isStalemate()) {
            // Stalemate: no slot has both cards alive, so no more damage possible.
            // Or MAX_TURNS reached. Settle by higher total HP.
            uint256 p1Total = uint256(_p1Slots[0].hp) + uint256(_p1Slots[1].hp);
            uint256 p2Total = uint256(_p2Slots[0].hp) + uint256(_p2Slots[1].hp);
            if (p1Total > p2Total) {
                _settle(p1Wallet);
            } else if (p2Total > p1Total) {
                _settle(p2Wallet);
            } else {
                _settleRefund();
            }
        } else {
            turn++;
            emit TurnStart(roomId, turn);
        }
    }

    /// @notice Returns true if no slot has both cards alive — no more damage possible
    function _isStalemate() internal view returns (bool) {
        for (uint256 i = 0; i < 2; i++) {
            if (_p1Slots[i].hp > 0 && _p2Slots[i].hp > 0) {
                return false; // this slot still has a live matchup
            }
        }
        return true;
    }

    function _calcDamage(
        Slot storage attacker,
        Slot storage defender
    ) internal view returns (uint8) {
        uint256 mult   = _multiplier(attacker.element, defender.element);
        uint256 rawAtk = (uint256(attacker.atk) * mult) / 100;
        uint256 net    = rawAtk > uint256(defender.def) ? rawAtk - uint256(defender.def) : 1;
        if (defender.action == Action.DEFEND) {
            net = net > 1 ? net / 2 : 1;
        }
        return net > 255 ? 255 : uint8(net);
    }

    /// @notice 3x3 elemental multiplier table (scaled x100)
    function _multiplier(uint8 atkEl, uint8 defEl) internal pure returns (uint256) {
        // [attacker][defender]  FIRE  WATER  LIGHTNING
        // FIRE                  120    50     200
        // WATER                 200   120      50
        // LIGHTNING              50   200     120
        uint8[3][3] memory t = [
            [uint8(120), uint8( 50), uint8(200)],  // Fire
            [uint8(200), uint8(120), uint8( 50)],  // Water
            [uint8( 50), uint8(200), uint8(120)]   // Lightning
        ];
        return uint256(t[atkEl][defEl]);
    }

    function _settle(address winner) internal nonReentrant {
        state = State.SETTLED;
        uint256 payout = stake * 2;

        emit BattleResult(roomId, winner, payout, turn);

        IERC20(usdc).transfer(winner, payout);

        // Clear all 4 cards from room
        _clearAllCards();
    }

    function _settleRefund() internal nonReentrant {
        state = State.SETTLED;

        emit BattleResult(roomId, address(0), 0, turn);

        IERC20(usdc).transfer(p1Wallet, stake);
        IERC20(usdc).transfer(p2Wallet, stake);

        _clearAllCards();
    }

    function _clearAllCards() internal {
        for (uint256 i = 0; i < 2; i++) {
            if (_p1Slots[i].cardAgent != address(0)) {
                CardAgent(_p1Slots[i].cardAgent).clearRoom();
            }
            if (_p2Slots[i].cardAgent != address(0)) {
                CardAgent(_p2Slots[i].cardAgent).clearRoom();
            }
        }
    }

    /// @notice Force settle after 1 hour timeout
    function forceSettle() external {
        require(state == State.ACTIVE, "not active");
        require(
            msg.sender == p1Wallet || msg.sender == p2Wallet,
            "not a player"
        );
        require(
            block.timestamp >= lastActionAt + 1 hours,
            "timeout not reached"
        );

        uint256 p1Total = uint256(_p1Slots[0].hp) + uint256(_p1Slots[1].hp);
        uint256 p2Total = uint256(_p2Slots[0].hp) + uint256(_p2Slots[1].hp);

        if (p1Total > p2Total) {
            _settle(p1Wallet);
        } else if (p2Total > p1Total) {
            _settle(p2Wallet);
        } else {
            _settleRefund();
        }
    }
}
