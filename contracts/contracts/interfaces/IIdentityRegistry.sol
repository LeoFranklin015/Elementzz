// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}

/// @title IIdentityRegistry
/// @notice ERC-8004 Identity Registry interface
/// @dev Deployed at 0x8004A818BFB912233c491871b3d84c89A494BD9e on Base Sepolia & Avalanche Fuji
interface IIdentityRegistry {
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);

    function register(
        string memory agentURI,
        MetadataEntry[] memory metadata
    ) external returns (uint256 agentId);

    function register(string memory agentURI) external returns (uint256 agentId);

    function register() external returns (uint256 agentId);

    function setAgentURI(uint256 agentId, string calldata newURI) external;

    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;

    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external;

    function getAgentWallet(uint256 agentId) external view returns (address);
    function unsetAgentWallet(uint256 agentId) external;
}
