// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ThirdProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    struct Entry {
        address sender;
        uint48 t2;       
        bytes sig;
        // commitment c
        bytes32 c;
        // encryption key k; 0x0 means "not yet revealed"
        bytes32 k;
    }

    mapping(bytes32 pid => Entry) private _entries;
    
    error OnlyBeforeT1();
    error T2MustBeFuture();
    error T2MustBeAfterT1();
    error EntryAlreadyExists();
    error InvalidSignature();
    error UnknownPid();
    error NotAllowed();
    error DeadlinePassed();
    error KeyAlreadySet();
    error InvalidCommitment();

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes calldata signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function TriggerDispute(
        bytes calldata siga, 
        bytes calldata sigb, 
        bytes32 c, 
        bytes32 h, 
        uint48 t1, 
        uint48 t2, 
        address alice
    ) external {
        if (uint48(block.timestamp) >= t1) revert OnlyBeforeT1();
        if (t2 <= uint48(block.timestamp)) revert T2MustBeFuture();
        if (t2 <= t1) revert T2MustBeAfterT1();
        
        bytes32 pid = _pid(alice, msg.sender, h);
        if (_entries[pid].sender != address(0)) revert EntryAlreadyExists();

        // Verify Alice's signature (siga)
        bytes32 aliceHash = keccak256(abi.encodePacked(c, h, msg.sender, t1, t2, pid));
        if (!_verify(aliceHash, siga, alice)) revert InvalidSignature();
        
        // Verify Bob's signature (sigb)
        bytes32 bobHash = keccak256(abi.encodePacked(c, h, t2, pid));
        if (!_verify(bobHash, sigb, msg.sender)) revert InvalidSignature();
        
        Entry storage entry = _entries[pid];
        entry.sender = alice;
        entry.sig = sigb;
        entry.t2 = t2;
        entry.c = c;
    }

    function SendOp(bytes32 k, uint256 r, bytes32 pid) external {
        Entry storage e = _entries[pid];
        if (e.sender == address(0)) revert UnknownPid();
        if (msg.sender != e.sender) revert NotAllowed();
        if (uint48(block.timestamp) > e.t2) revert DeadlinePassed();
        if (e.k != bytes32(0)) revert KeyAlreadySet();

        // Verify the commitment
        bytes32 commitment = keccak256(abi.encodePacked(k, r));
        if (commitment != e.c) revert InvalidCommitment();

        e.k = k; 
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        return _entries[pid];
    }

    function getTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
}