// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./CardAgent.sol";
import "./interfaces/IIdentityRegistry.sol";

/// @title CardFactory
/// @notice Deploys two CardAgent contracts per player, assigns random element + stats,
///         and registers each card in the ERC-8004 Identity Registry as an autonomous agent.
contract CardFactory is IERC721Receiver {
    mapping(address => address[2]) internal _playerCards;
    mapping(address => bool) public hasCards;
    mapping(address => bool) public allowedRooms;
    mapping(address => uint256) public cardAgentId; // card address → ERC-8004 agent ID
    address public owner;
    address public identityRegistry;

    string[3] private _elementNames;

    event PlayerOnboarded(address indexed player, address card1, address card2);
    event CardRegistered(address indexed card, uint256 agentId, uint8 element);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _identityRegistry) {
        owner = msg.sender;
        identityRegistry = _identityRegistry;
        _elementNames[0] = "Fire";
        _elementNames[1] = "Water";
        _elementNames[2] = "Lightning";
    }

    /// @notice Deploys two cards for the caller with random elements
    function onboard() external {
        require(!hasCards[msg.sender], "already onboarded");

        address[2] memory cards;

        for (uint256 i = 0; i < 2; i++) {
            uint8 element = uint8(
                uint256(keccak256(abi.encodePacked(block.prevrandao, msg.sender, i))) % 3
            );

            (uint8 atkStat, uint8 defStat, uint8 hpStat) = _getStats(element);

            CardAgent card = new CardAgent();
            card.initialize(msg.sender, element, atkStat, defStat, hpStat);
            cards[i] = address(card);

            // Register in ERC-8004 Identity Registry (fault-tolerant — card works even if registration fails)
            if (identityRegistry != address(0)) {
                try CardFactory(this)._registerCardExternal(address(card), element, atkStat, defStat, hpStat, i) {
                } catch {
                    // Registration failed — card is still fully functional without ERC-8004 identity
                }
            }
        }

        _playerCards[msg.sender] = cards;
        hasCards[msg.sender] = true;

        emit PlayerOnboarded(msg.sender, cards[0], cards[1]);
    }

    /// @notice Registers a card as an ERC-8004 autonomous agent with full metadata
    /// @dev External so it can be used with try/catch. Only callable by this contract.
    function _registerCardExternal(
        address cardAddr,
        uint8 element,
        uint8 atkStat,
        uint8 defStat,
        uint8 hpStat,
        uint256 slotIndex
    ) external {
        require(msg.sender == address(this), "only self");
        // Build agent URI — JSON metadata describing this card agent
        string memory agentURI = string(abi.encodePacked(
            '{"name":"CardBattle Agent #', _uint2str(slotIndex),
            '","element":"', _elementNames[element],
            '","atk":', _uint2str(uint256(atkStat)),
            ',"def":', _uint2str(uint256(defStat)),
            ',"hp":', _uint2str(uint256(hpStat)),
            ',"type":"autonomous-battle-card","protocol":"CardBattle"}'
        ));

        // Build metadata entries
        MetadataEntry[] memory metadata = new MetadataEntry[](4);
        metadata[0] = MetadataEntry("name", abi.encode(string(abi.encodePacked("CardBattle ", _elementNames[element], " Agent"))));
        metadata[1] = MetadataEntry("description", abi.encode("Autonomous battle card agent for CardBattle PvP game"));
        metadata[2] = MetadataEntry("cardAddress", abi.encode(cardAddr));
        metadata[3] = MetadataEntry("element", abi.encode(_elementNames[element]));

        uint256 agentId = IIdentityRegistry(identityRegistry).register(agentURI, metadata);
        cardAgentId[cardAddr] = agentId;

        emit CardRegistered(cardAddr, agentId, element);
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
            v /= 10;
        }
        return string(buffer);
    }

    function getCards(address player) external view returns (address card1, address card2) {
        return (_playerCards[player][0], _playerCards[player][1]);
    }

    function allowRoom(address room) external onlyOwner {
        allowedRooms[room] = true;
    }

    /// @notice Locks a card into a battle room
    function lockCard(address card, address room) external {
        require(allowedRooms[room], "room not allowed");
        CardAgent(card).setActiveRoom(room);
    }

    /// @notice Accept ERC-721 tokens (required for ERC-8004 registry minting agent NFTs to this contract)
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _getStats(uint8 element) internal pure returns (uint8 atkStat, uint8 defStat, uint8 hpStat) {
        if (element == 0) return (8, 4, 20);  // Fire
        if (element == 1) return (5, 8, 22);  // Water
        if (element == 2) return (9, 3, 18);  // Lightning
        revert("invalid element");
    }
}
