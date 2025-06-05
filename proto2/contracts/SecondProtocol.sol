// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SecondProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    struct Entry {
        address sender;
        bytes sig;
        uint48 t2;      // deadline t2 chosen by Alice (saves gas vs uint256)
        bytes32 k;      // encryption key; 0x0 means "not yet revealed"
    }

    mapping(bytes32 pid => Entry) private _entries;
    
    error EntryAlreadyExists();
    error InvalidSignature();
    error T2MustBeFuture();
    error OnlyBeforeT1();
    error UnknownPid();
    error NotAllowed();
    error DeadlinePassed();
    error KeyAlreadySet();
    
    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes memory signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function Trigger(
        bytes32 h, 
        uint48 t1, 
        uint48 t2, 
        bytes calldata siga, 
        bytes calldata sigb, 
        address alice
    ) external {
        if (t2 <= uint48(block.timestamp)) revert T2MustBeFuture();
        if (uint48(block.timestamp) >= t1) revert OnlyBeforeT1();
        
        bytes32 pid = _pid(alice, msg.sender, h);
        if (_entries[pid].sender != address(0)) revert EntryAlreadyExists();

        bytes32 aliceHash = keccak256(abi.encodePacked(h, t1, t2, msg.sender));
        if (!_verify(aliceHash, siga, alice)) revert InvalidSignature();
        
        bytes32 bobHash = keccak256(abi.encodePacked(h, t2));
        if (!_verify(bobHash, sigb, msg.sender)) revert InvalidSignature();

        Entry storage entry = _entries[pid];
        entry.sender = alice;
        entry.sig = sigb;
        entry.t2 = t2;
    }

    function SetK(bytes32 pid, bytes32 k) external {
        Entry storage e = _entries[pid];
        
        if (e.sender == address(0)) revert UnknownPid();
        if (msg.sender != e.sender) revert NotAllowed();
        if (uint48(block.timestamp) > e.t2) revert DeadlinePassed();
        if (e.k != bytes32(0)) revert KeyAlreadySet();

        e.k = k;
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        return _entries[pid];
    }

    function getTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
}