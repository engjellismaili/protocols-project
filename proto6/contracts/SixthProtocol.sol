// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SixthProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Custom errors for gas savings
    error T2MustBeInFuture();
    error T2MustBeAfterT1();
    error PledgeAmountTooLow();
    error EntryAlreadyExists();
    error EntryDoesNotExist();
    error OnlySenderCanSetSignature();
    error PledgeAlreadyReleased();
    error InvalidSignature();
    error TransferFailed();

    struct Entry {
        address sender;       // 20 bytes
        address receiver;     // 20 bytes 
        uint48 t1;            // 6 bytes
        uint48 t2;            // 6 bytes
        bool pledgeReleased;  // 1 byte
        // The above pack into two 32-byte slots
        
        bytes32 tao;          // 32 bytes (separate slot)
        uint256 pledgeAmount; // 32 bytes (separate slot)
        bytes sig;            // 32+ bytes (separate slots)
    }

    mapping(bytes32 => Entry) private _entries;

    event TupleCreated(bytes32 indexed pid, address indexed sender, address indexed receiver, uint256 pledgeAmount);
    event PledgeReleased(bytes32 indexed pid, address receiver, uint256 amount);

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes calldata signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    function SetTuple(uint48 t1, uint48 t2, bytes32 tao, address bob, bytes32 h) external payable {
        if (t2 <= block.timestamp) revert T2MustBeInFuture();
        if (t2 <= t1) revert T2MustBeAfterT1();
        if (msg.value == 0) revert PledgeAmountTooLow();

        bytes32 pid = _pid(msg.sender, bob, h);
        Entry storage entry = _entries[pid];

        if (entry.sender != address(0)) revert EntryAlreadyExists();
        
        // Set the tuple with pledge information
        entry.sender = msg.sender;
        entry.t1 = t1;
        entry.t2 = t2;
        entry.tao = tao;
        entry.receiver = bob;
        entry.pledgeAmount = msg.value;
        entry.pledgeReleased = false;

        emit TupleCreated(pid, msg.sender, bob, msg.value);
    }

    function SetSignature(bytes calldata signature, bytes32 pid) external {
        Entry storage entry = _entries[pid];
        
        if (entry.sender == address(0)) revert EntryDoesNotExist();
        if (entry.sender != msg.sender) revert OnlySenderCanSetSignature();
        if (entry.pledgeReleased) revert PledgeAlreadyReleased();

        // Verify the signature
        bytes32 dataHash = keccak256(abi.encodePacked(entry.sender, entry.t1, entry.t2, entry.tao, pid));
        if (!_verify(dataHash, signature, entry.receiver)) revert InvalidSignature();

        // Mark pledge as released first (prevents reentrancy)
        entry.pledgeReleased = true;
        
        // Set the signature
        entry.sig = signature;
        
        // Release the pledge to the sender
        uint256 amount = entry.pledgeAmount;
        (bool success, ) = entry.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit PledgeReleased(pid, entry.sender, amount);
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        Entry storage entry = _entries[pid];
        if (entry.sender == address(0)) revert EntryDoesNotExist();
        return entry;
    }

    function GetTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
    
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}