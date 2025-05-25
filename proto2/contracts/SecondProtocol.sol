// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)

contract SecondProtocol {

    struct Entry {
        address sender;
        bytes sig;
        uint256 t2;     // deadline t2 chosen by Alice
        bytes32 k;      // encryption key; 0x0 means “not yet revealed”
    }

    mapping(uint256 pid => Entry) private _entries;

    function GetEntry(uint256 pid) external view returns (Entry memory) {
        return _entries[pid];
    }
}