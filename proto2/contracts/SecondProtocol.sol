// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SecondProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    struct Entry {
        address sender;
        bytes sig;
        uint256 t2;     // deadline t2 chosen by Alice
        bytes32 k;      // encryption key; 0x0 means "not yet revealed"
    }

    mapping(bytes32 pid => Entry) private _entries;

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes memory signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function Trigger(bytes32 h, uint256 t1, uint256 t2, bytes memory siga, bytes memory sigb, address alice) external {
        require(t2 > block.timestamp, "t2 must be in the future");
        bytes32 pid = _pid(alice, msg.sender, h);
        require(_entries[pid].sender == address(0), "Entry already exists");

        // Verify Alice's signature (siga)
        bytes32 aliceHash = keccak256(abi.encodePacked(h, t1, t2, msg.sender));
        require(_verify(aliceHash, siga, alice), "Invalid Alice signature");
        
        bytes32 bobHash = keccak256(abi.encodePacked(h, t2));
        require(_verify(bobHash, sigb, msg.sender), "Invalid Bob signature");

        // Store the entry
        _entries[pid] = Entry({
            sender: alice,
            sig: sigb,
            t2: t2,
            k: bytes32(0)
        });
    }

    function SetK(bytes32 pid, bytes32 k) external {
        Entry storage e = _entries[pid];
        require(e.sender != address(0), "Unknown pid"); // There wasn't an entry at this pid
        require(msg.sender == e.sender, "Not allowed"); // Only sender should call this method
        require(block.timestamp <= e.t2, "t2 already passed");
        require(e.k == bytes32(0), "Key already set");

        e.k = k;
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        return _entries[pid];
    }

    function getTimestamp() view external returns (uint256){
        return block.timestamp;
    }
}