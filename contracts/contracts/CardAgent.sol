// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CardAgent
/// @notice ERC-8004 autonomous agent smart account — each card is its own wallet
contract CardAgent {
    uint8 public constant FIRE = 0;
    uint8 public constant WATER = 1;
    uint8 public constant LIGHTNING = 2;

    address public owner;
    address public factory;
    uint8   public element;
    uint8   public atk;
    uint8   public def;
    uint8   public hp;
    uint8   public maxHp;
    bool    public inBattle;
    address public activeRoom;

    bool private _initialized;

    modifier onlyFactory() {
        require(msg.sender == factory, "only factory");
        _;
    }

    modifier onlyActiveRoom() {
        require(msg.sender == activeRoom, "only active room");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /// @notice Called once by CardFactory after deploy
    function initialize(
        address _owner,
        uint8 _element,
        uint8 _atk,
        uint8 _def,
        uint8 _hp
    ) external {
        require(!_initialized, "already initialized");
        require(_element <= 2, "invalid element");
        _initialized = true;
        factory = msg.sender;
        owner = _owner;
        element = _element;
        atk = _atk;
        def = _def;
        hp = _hp;
        maxHp = _hp;
    }

    /// @notice Reduces hp by amount. hp cannot go below 0.
    function takeDamage(uint8 amount) external onlyActiveRoom {
        hp = amount >= hp ? 0 : hp - amount;
    }

    /// @notice Adds amount to hp up to maxHp.
    function applyRegen(uint8 amount) external onlyActiveRoom {
        uint8 newHp = hp + amount;
        hp = newHp > maxHp ? maxHp : newHp;
    }

    /// @notice Sets activeRoom and inBattle. Reverts if already in battle.
    function setActiveRoom(address room) external onlyFactory {
        require(!inBattle, "already in battle");
        activeRoom = room;
        inBattle = true;
    }

    /// @notice Resets inBattle and activeRoom.
    function clearRoom() external onlyActiveRoom {
        inBattle = false;
        activeRoom = address(0);
    }

    /// @notice Execute a call on behalf of this card agent.
    /// @dev For MVP, owner calls this to trigger attack/defend on BattleRoom.
    ///      msg.sender in the target contract will be this CardAgent's address.
    function execute(address target, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            // Forward the inner revert reason
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        return result;
    }
}
