// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract FirstProtocol {
    // Change from uint256 to uint48 for gas savings
    uint48 private _pid;

    struct Entry {
        address sender;  // the opener (msg.sender)
        uint48 t2;       // deadline t2 chosen by Alice (uint48 for gas savings)
        bytes32 k;       // encryption key; 0x0 means "not yet revealed"
    }

    // Keep uint48 for pid key in mapping
    mapping(uint48 pid => Entry) private _entries;

    // Update event parameter types to uint48
    event HaveBeenSet(uint48 indexed pid, address indexed alice, uint48 t2);
    event KeySet(uint48 indexed pid, bytes32 indexed k);

    // Update custom error parameter types to uint48
    error UnknownPid(uint48 pid);
    error NotAllowed(uint48 pid);
    error KeyAlreadySet(uint48 pid);
    error DeadlineMustBeFuture();
    error DeadlinePassed();
    error KeyCannotBeZero();

    // Return uint48 timestamp
    function getTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }

    // Update function parameter and return type
    function SetT(uint48 t2) external returns (uint48 pid) {
        // Convert block.timestamp to uint48 for comparison
        if (t2 <= uint48(block.timestamp)) revert DeadlineMustBeFuture();
        
        // Increment pid and use it (saves gas by avoiding a function call)
        pid = ++_pid;
        
        // Store directly without using named parameters (saves gas)
        _entries[pid].sender = msg.sender;
        _entries[pid].t2 = t2;
        // No need to explicitly set k to 0 as it's the default value
        
        emit HaveBeenSet(pid, msg.sender, t2);
        
        // Return pid to caller (allows chaining and saves gas by avoiding a separate call)
        return pid;
    }

    // Update function parameter type
    function SetK(uint48 pid, bytes32 k) external {
        // Cache storage pointer to reduce SLOADs
        Entry storage e = _entries[pid];
        
        // Use custom errors for all conditions
        if (e.sender == address(0)) revert UnknownPid(pid);
        if (msg.sender != e.sender) revert NotAllowed(pid);
        if (uint48(block.timestamp) > e.t2) revert DeadlinePassed();
        if (e.k != bytes32(0)) revert KeyAlreadySet(pid);
        if (k == bytes32(0)) revert KeyCannotBeZero();

        // Set the key
        e.k = k;
        
        emit KeySet(pid, k);
    }

    // Update function parameter and return type
    function GetEntry(uint48 pid) external view returns (Entry memory) {
        return _entries[pid];
    }
}