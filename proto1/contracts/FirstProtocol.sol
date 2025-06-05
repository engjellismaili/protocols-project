// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract FirstProtocol {
    uint48 private _pid;

    struct Entry {
        address sender;  // the opener (msg.sender)
        uint48 t2;       // deadline t2 chosen by Alice
        bytes32 k;       // encryption key; 0x0 means "not yet revealed"
    }

    mapping(uint48 pid => Entry) private _entries;

    event HaveBeenSet(uint48 indexed pid, address indexed alice, uint48 t2);
    event KeySet(uint48 indexed pid, bytes32 indexed k);

    // Update custom error parameter types to uint48
    error UnknownPid(uint48 pid);
    error NotAllowed(uint48 pid);
    error KeyAlreadySet(uint48 pid);
    error DeadlineMustBeFuture();
    error DeadlinePassed();
    error KeyCannotBeZero();

    function getTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }

    function SetT(uint48 t2) external returns (uint48 pid) {
        if (t2 <= uint48(block.timestamp)) revert DeadlineMustBeFuture();
        
        pid = ++_pid;
        
        _entries[pid].sender = msg.sender;
        _entries[pid].t2 = t2;
        
        emit HaveBeenSet(pid, msg.sender, t2);
        
        return pid;
    }

    function SetK(uint48 pid, bytes32 k) external {
        Entry storage e = _entries[pid];
        
        if (e.sender == address(0)) revert UnknownPid(pid);
        if (msg.sender != e.sender) revert NotAllowed(pid);
        if (uint48(block.timestamp) > e.t2) revert DeadlinePassed();
        if (e.k != bytes32(0)) revert KeyAlreadySet(pid);
        if (k == bytes32(0)) revert KeyCannotBeZero();

        e.k = k;
        
        emit KeySet(pid, k);
    }

    function GetEntry(uint48 pid) external view returns (Entry memory) {
        return _entries[pid];
    }
}