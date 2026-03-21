// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BattleRoomHarness
/// @notice Exposes internal damage formula functions for unit testing
contract BattleRoomHarness {
    enum Action { NONE, ATTACK, DEFEND }

    /// @notice 3x3 elemental multiplier table (scaled x100)
    function multiplier(uint8 atkEl, uint8 defEl) public pure returns (uint256) {
        uint8[3][3] memory t = [
            [uint8(120), uint8( 50), uint8(200)],  // Fire
            [uint8(200), uint8(120), uint8( 50)],  // Water
            [uint8( 50), uint8(200), uint8(120)]   // Lightning
        ];
        return uint256(t[atkEl][defEl]);
    }

    /// @notice Calculate damage given attacker/defender stats and actions
    function calcDamage(
        uint8 atkElement,
        uint8 atkStat,
        uint8 defElement,
        uint8 defStat,
        bool defenderDefending
    ) public pure returns (uint8) {
        uint256 mult   = multiplier(atkElement, defElement);
        uint256 rawAtk = (uint256(atkStat) * mult) / 100;
        uint256 net    = rawAtk > uint256(defStat) ? rawAtk - uint256(defStat) : 1;
        if (defenderDefending) {
            net = net > 1 ? net / 2 : 1;
        }
        return net > 255 ? 255 : uint8(net);
    }

    /// @notice Simulate regen: min(hp + amount, maxHp)
    function applyRegen(uint8 hp, uint8 amount, uint8 maxHp) public pure returns (uint8) {
        uint8 newHp = hp + amount;
        return newHp > maxHp ? maxHp : newHp;
    }
}
