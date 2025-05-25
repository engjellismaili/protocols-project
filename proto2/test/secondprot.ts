import { expect } from "chai";
import { ethers } from "hardhat";
import { SecondProtocol } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SecondProtocol", function () {
    let secondProtocol: SecondProtocol;
    let owner: SignerWithAddress;
    // Alice will be addr1, Bob will be addr2
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;

    // Common test values
    let testHash: string; 

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        // Deploy the contract
        const SecondProtocolFactory = await ethers.getContractFactory("SecondProtocol");
        secondProtocol = await SecondProtocolFactory.deploy();
        
        // Generate a test hash to use throughout tests
        testHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await secondProtocol.getAddress()).to.be.properAddress;
        });
    });

    describe("Trigger", function () {
        it("should allow triggering with valid signatures", async function () {
            // Alice is addr1, Bob is addr2
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000); // Current timestamp
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call the Trigger function
            const tx = await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for Trigger: ${receipt?.gasUsed.toString()}`);
            
            // Get the entry to verify it was created
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            const entry = await secondProtocol.GetEntry(pid);
            
            // Verify the entry was created correctly
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t2).to.equal(t2);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            expect(entry.sig).to.equal(bobSignature);
        });
        
        it("should reject past deadlines", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const t1 = Math.floor(Date.now() / 1000) - 7200; // 2 hours in the past
            const t2 = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
            
            // Create signatures (these won't be checked because the function will fail early)
            const aliceSignature = "0x";
            const bobSignature = "0x";
            
            // Call should fail with t2 in the past
            await expect(
                secondProtocol.connect(bob).Trigger(
                    testHash, t1, t2, aliceSignature, bobSignature, alice.address
                )
            ).to.be.revertedWith("t2 must be in the future");
        });
        
        it("should reject invalid Alice signatures", async function () {
            const alice = addr1;
            const bob = addr2;
            const malicious = addr3;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hash
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign with malicious actor instead of Alice
            const fakeAliceSignature = await malicious.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call should fail with invalid Alice signature
            await expect(
                secondProtocol.connect(bob).Trigger(
                    testHash, t1, t2, fakeAliceSignature, bobSignature, alice.address
                )
            ).to.be.revertedWith("Invalid Alice signature");
        });
        
        it("should reject invalid Bob signatures", async function () {
            const alice = addr1;
            const bob = addr2;
            const malicious = addr3;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hash
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Create valid Alice signature but invalid Bob signature
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const fakeBobSignature = await malicious.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call should fail with invalid Bob signature
            await expect(
                secondProtocol.connect(bob).Trigger(
                    testHash, t1, t2, aliceSignature, fakeBobSignature, alice.address
                )
            ).to.be.revertedWith("Invalid Bob signature");
        });
        
        it("should reject duplicate entries", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // First call should succeed
            await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            
            // Second call with the same parameters should fail
            await expect(
                secondProtocol.connect(bob).Trigger(
                    testHash, t1, t2, aliceSignature, bobSignature, alice.address
                )
            ).to.be.revertedWith("Entry already exists");
        });
        
        it("should measure gas used for Trigger", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call and measure gas
            const tx = await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for Trigger with valid signatures: ${receipt?.gasUsed.toString()}`);
        });
    });

    describe("SetK", function () {
        let pid: string;
        let alice: SignerWithAddress;
        let bob: SignerWithAddress;
        let t2: number;
        
        beforeEach(async function () {
            alice = addr1;
            bob = addr2;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Create an entry
            await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            
            // Get the PID
            pid = await createPidForTest(alice.address, bob.address, testHash);
        });
        
        it("should allow setting a key by the sender", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            const tx = await secondProtocol.connect(alice).SetK(pid, testKey);
            const receipt = await tx.wait();
            console.log(`Gas used for SetK: ${receipt?.gasUsed.toString()}`);
            
            const entry = await secondProtocol.GetEntry(pid);
            expect(entry.k).to.equal(testKey);
        });
        
        it("should reject setting key by non-sender", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            await expect(
                secondProtocol.connect(bob).SetK(pid, testKey)
            ).to.be.revertedWith("Not allowed");
            
            await expect(
                secondProtocol.connect(owner).SetK(pid, testKey)
            ).to.be.revertedWith("Not allowed");
        });
        
        it("should reject setting key after deadline", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            // Increase time to after the deadline
            await time.increase(3601);
            
            await expect(
                secondProtocol.connect(alice).SetK(pid, testKey)
            ).to.be.revertedWith("t2 already passed");
        });
        
        it("should reject setting key twice", async function () {
            const testKey1 = ethers.keccak256(ethers.toUtf8Bytes("test key 1"));
            const testKey2 = ethers.keccak256(ethers.toUtf8Bytes("test key 2"));
            
            await secondProtocol.connect(alice).SetK(pid, testKey1);
            
            await expect(
                secondProtocol.connect(alice).SetK(pid, testKey2)
            ).to.be.revertedWith("Key already set");
        });
        
        it("should reject unknown pid", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            
            await expect(
                secondProtocol.connect(alice).SetK(fakePid, testKey)
            ).to.be.revertedWith("Unknown pid");
        });
    });

    describe("GetEntry", function () {
        let pid: string;
        let alice: SignerWithAddress;
        let bob: SignerWithAddress;
        
        beforeEach(async function () {
            alice = addr1;
            bob = addr2;
            
            // Set up the parameters
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Create an entry
            await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            
            // Get the PID
            pid = await createPidForTest(alice.address, bob.address, testHash);
        });
        
        it("should return correct entry data", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            await secondProtocol.connect(alice).SetK(pid, testKey);
            
            // Estimate gas for GetEntry (view function)
            const gasEstimate = await secondProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry (only costs gas when called from contracts): ${gasEstimate.toString()}`);
            
            const entry = await secondProtocol.GetEntry(pid);
            expect(entry.sender).to.equal(alice.address);
            expect(entry.k).to.equal(testKey);
        });
        
        it("should return empty entry for non-existent pid", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            const entry = await secondProtocol.GetEntry(fakePid);
            
            expect(entry.sender).to.equal(ethers.ZeroAddress);
            expect(entry.t2).to.equal(0);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        });
    });

    describe("Gas usage summary", function() {
        it("should provide a complete gas usage report", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Deployment gas estimate
            const SecondProtocolFactory = await ethers.getContractFactory("SecondProtocol");
            const deployTx = await SecondProtocolFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Set up the parameters for a workflow
            const t1 = Math.floor(Date.now() / 1000);
            const t2 = t1 + 3600; // 1 hour in the future
            
            // Create the message hashes for the workflow
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256', 'uint256', 'address'],
                [testHash, t1, t2, bob.address]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint256'],
                [testHash, t2]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Measure Trigger gas
            const triggerTx = await secondProtocol.connect(bob).Trigger(
                testHash, t1, t2, aliceSignature, bobSignature, alice.address
            );
            const triggerReceipt = await triggerTx.wait();
            console.log(`Gas used for Trigger in workflow: ${triggerReceipt?.gasUsed.toString()}`);
            
            // Get PID and measure SetK gas
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            const setKTx = await secondProtocol.connect(alice).SetK(pid, testKey);
            const setKReceipt = await setKTx.wait();
            console.log(`Gas used for SetK in workflow: ${setKReceipt?.gasUsed.toString()}`);
            
            // GetEntry gas estimate
            const getEntryEstimate = await secondProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry in workflow: ${getEntryEstimate.toString()}`);
        });
    });
    
    // Helper function to create the same PID as the contract
    async function createPidForTest(alice: string, bob: string, h: string): Promise<string> {
        // This should match the contract's _pid function
        return ethers.solidityPackedKeccak256(
            ['address', 'address', 'bytes32'],
            [alice, bob, h]
        );
    }
});