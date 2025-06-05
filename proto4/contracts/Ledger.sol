// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Ledger {
    error EntryAlreadyExists();
    error TimestampMustBeFuture();
    error EntryDoesNotExist();
    
    struct Entry {
        bytes sig;  
        uint48 t;
        bytes32 k;
    }

    mapping(bytes32 => Entry) private _entries;

    function SetTuple(bytes calldata sig, uint48 t, bytes32 k, bytes32 pid) external {
        if (_entries[pid].t != 0) revert EntryAlreadyExists();
        if (uint48(block.timestamp) >= t) revert TimestampMustBeFuture();

        Entry storage entry = _entries[pid];
        entry.sig = sig;
        entry.t = t;
        entry.k = k;
    }

    function GetTuple(bytes32 pid) external view returns (bytes memory sig, uint48 t, bytes32 k) {
        Entry storage entry = _entries[pid];
        if (entry.t == 0) revert EntryDoesNotExist();

        return (entry.sig, entry.t, entry.k);
    }

    function getTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
}