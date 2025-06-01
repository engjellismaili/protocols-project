// SPDX-License-Identifier: MITcd
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SixthProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Entry {
        address sender;
        uint48 t1;
        uint48 t2;
        bytes32 tao;
        address receiver;
        bytes sig;
    }

    mapping(bytes32 => Entry) private _entries;

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes calldata signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function SetTuple(uint48 t1, uint48 t2, bytes32 tao, address bob, bytes32 h) external {
        // Ensure t2 is in the future
        require(t2 > block.timestamp, "t2 must be in the future");
        // Ensure t2 is after t1
        require(t2 > t1, "t2 must be after t1");

        bytes32 pid = _pid(msg.sender, bob, h); // Assuming bob is not involved here
        Entry storage entry = _entries[pid];

        // Check if the entry already exists
        require(entry.sender == address(0), "Entry already exists");
        
        // Set the tuple
        entry.sender = msg.sender;
        entry.t1 = t1;
        entry.t2 = t2;
        entry.tao = tao;
        entry.receiver = bob;
    }

    function SetSignature(bytes calldata signature, bytes32 pid) external {
        Entry storage entry = _entries[pid];
        
        // Ensure the entry exists
        require(entry.sender != address(0), "Entry does not exist");
        require(entry.sender == msg.sender, "Only the sender can set the signature");

        // Verify the signature
        bytes32 dataHash = keccak256(abi.encodePacked(entry.sender, entry.t1, entry.t2, entry.tao, pid));
        require(_verify(dataHash, signature, entry.receiver), "Invalid signature");

        // Set the signature
        entry.sig = signature;
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        Entry storage entry = _entries[pid];
        
        // Ensure the entry exists
        require(entry.sender != address(0), "Entry does not exist");
        
        return entry;
    }

    function GetTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
}