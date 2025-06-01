// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)

contract SeventhProtocol {
    // Custom errors for gas savings
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
        // Check if the entry already exists - use custom error instead of require
        if (_entries[pid].t != 0) revert EntryAlreadyExists();
        if (uint48(block.timestamp) >= t) revert TimestampMustBeFuture();

        // Direct storage assignment without struct constructor
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
}