// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;   // latest stable (May 2025)
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SixthProtocol {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Entry {
        address sender;
        uint48 t1;
        uint48 t2;
        bytes32 tao;
        address receiver;
        bytes sig;
        uint256 pledgeAmount;  // Amount of ETH pledged
        bool pledgeReleased;   // Track if pledge has been released
    }

    mapping(bytes32 => Entry) private _entries;

    // Events for better tracking
    event TupleCreated(bytes32 indexed pid, address sender, address receiver, uint256 pledgeAmount);
    event PledgeReleased(bytes32 indexed pid, address receiver, uint256 amount);
    event PledgeRefunded(bytes32 indexed pid, address sender, uint256 amount);

    function _pid(address alice, address bob, bytes32 h) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(alice, bob, h));
    }

    function _verify(bytes32 data, bytes calldata signature, address signer) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == signer;
    }

    // Modified to accept ETH pledge
    function SetTuple(uint48 t1, uint48 t2, bytes32 tao, address bob, bytes32 h) external payable {
        // Ensure t2 is in the future
        require(t2 > block.timestamp, "t2 must be in the future");
        // Ensure t2 is after t1
        require(t2 > t1, "t2 must be after t1");
        // Ensure some ETH is sent as pledge
        require(msg.value > 0, "Pledge amount must be greater than 0");

        bytes32 pid = _pid(msg.sender, bob, h);
        Entry storage entry = _entries[pid];

        // Check if the entry already exists
        require(entry.sender == address(0), "Entry already exists");
        
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

    // Modified to release pledge to receiver upon successful verification
    function SetSignature(bytes calldata signature, bytes32 pid) external {
        Entry storage entry = _entries[pid];
        
        // Ensure the entry exists
        require(entry.sender != address(0), "Entry does not exist");
        require(entry.sender == msg.sender, "Only the sender can set the signature");
        require(!entry.pledgeReleased, "Pledge already released");

        // Verify the signature
        bytes32 dataHash = keccak256(abi.encodePacked(entry.sender, entry.t1, entry.t2, entry.tao, pid));
        require(_verify(dataHash, signature, entry.receiver), "Invalid signature");

        // Set the signature
        entry.sig = signature;
        
        // Mark pledge as released
        entry.pledgeReleased = true;
        
        // Release the pledge to the receiver
        uint256 amount = entry.pledgeAmount;
        (bool success, ) = entry.sender.call{value: amount}("");
        require(success, "Failed to send pledge to sender");
        
        emit PledgeReleased(pid, entry.sender, amount);
    }

    function GetEntry(bytes32 pid) external view returns (Entry memory) {
        Entry storage entry = _entries[pid];
        
        // Ensure the entry exists
        require(entry.sender != address(0), "Entry does not exist");
        
        return entry;
    }

    function GetTimestamp() external view returns (uint48) {
        return uint48(block.timestamp);
    }
    
    // Function to check contract balance (for testing/debugging)
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}