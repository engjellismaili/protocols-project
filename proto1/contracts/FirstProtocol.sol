// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/Counters.sol";

using Counters for Counters.Counter;

// A baby contract just for sanity-checking the toolchain
contract FirstProtocol {
    Counters.Counter private _pid;

    struct Entry {
        address sender;  // the opener (msg.sender)
        uint256 t2;     // deadline t2 chosen by Alice
        bytes32 k;      // encryption key; 0x0 means “not yet revealed”
    }

    mapping(uint256 pid => Entry) private _entries;

    event HaveBeenSet(uint256 indexed pid, address indexed alice, uint256 t2);
    event KeySet(uint256 indexed pid, bytes32 indexed k);

    error UnknownPid(uint256 pid);
    error NotAllowed(uint256 pid);
    error KeyAlreadySet(uint256 pid);

    function getTimestamp() view external returns (uint256){
        return block.timestamp;
    }

    function _nextPid() internal returns (uint256) {
        _pid.increment();
        return _pid.current();
    }

    function SetT(uint256 t2) external {
        require(t2 > block.timestamp, "t2 must be in the future");
        uint256 _curPid = _nextPid();
        _entries[_curPid] = Entry({
            sender : msg.sender,
            t2: t2,
            k : bytes32(0)
        });
        emit HaveBeenSet(_curPid, msg.sender, t2);
    }

    function SetK(uint256 pid, bytes32 k) external {
        Entry storage e = _entries[pid];
        if (e.sender == address(0)) revert UnknownPid(pid); // There wasn't an entry at this pid
        if (msg.sender != e.sender) revert NotAllowed(pid); // Only sender should call this method
        require(block.timestamp <= e.t2, "t2 already passed");
        if (e.k != bytes32(0)) revert KeyAlreadySet(pid);

        e.k = k;
        emit KeySet(pid, k);
    }

    function GetEntry(uint256 pid) external view returns (Entry memory) {
        return _entries[pid];
    }
}