// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ThirdProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    struct Entry {
        address sender;
        uint256 t2;
        bytes sig;
        // commitment c
        bytes32 c;
        // encryption key k; 0x0 means "not yet revealed"
        bytes32 k;
    }

    mapping(bytes32 pid => Entry) private _entries;

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes memory signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function TriggerDispute(bytes memory siga, bytes memory sigb, bytes32 c, bytes32 h, uint256 t1, uint256 t2, address alice) external {
        require(block.timestamp < t1, "can trigger only before t1");
        require(t2 > block.timestamp, "t2 must be in the future");
        require(t2 > t1, "t2 must be after t1");
        bytes32 pid = _pid(alice, msg.sender, h);
        require(_entries[pid].sender == address(0), "Entry already exists");

        // Verify Alice's signature (siga)
        bytes32 aliceHash = keccak256(abi.encodePacked(c, h, msg.sender, t1, t2, pid));
        require(_verify(aliceHash, siga, alice), "Invalid Alice signature");
        // Verify Bob's signature (sigb)
        bytes32 bobHash = keccak256(abi.encodePacked(c, h, t2, pid));
        require(_verify(bobHash, sigb, msg.sender), "Invalid Bob signature");
        // Store the entry
        _entries[pid] = Entry({
            sender: alice,
            sig: sigb,
            t2: t2,
            c: c,
            k: bytes32(0)
        });
    }

}