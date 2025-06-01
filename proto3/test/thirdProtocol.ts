import { expect } from "chai";
import { ethers } from "hardhat";
import { ThirdProtocol } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ThirdProtocol", function () {
    let thirdProtocol: ThirdProtocol;
    let owner: SignerWithAddress;
    // Alice will be addr1, Bob will be addr2
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;

    // Common test values
    let testHash: string;
    let testCommitment: string;
    let testKey: string;
    let randomValue: bigint;

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        // Deploy the contract
        const ThirdProtocolFactory = await ethers.getContractFactory("ThirdProtocol");
        thirdProtocol = await ThirdProtocolFactory.deploy();
        
        // Generate test values
        testHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
        testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
        randomValue = BigInt(12345678); // A random value for commitment
        
        // Generate the commitment (key, random)
        testCommitment = ethers.keccak256(
            ethers.solidityPacked(
                ['bytes32', 'uint256'],
                [testKey, randomValue]
            )
        );
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await thirdProtocol.getAddress()).to.be.properAddress;
        });
    });

    describe("TriggerDispute", function () {
        it("should allow triggering dispute with valid signatures", async function () {
            // Alice is addr1, Bob is addr2
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call the TriggerDispute function
            const tx = await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for TriggerDispute: ${receipt?.gasUsed.toString()}`);
            
            // Get the entry to verify it was created
            const entry = await thirdProtocol.GetEntry(pid);
            
            // Verify the entry was created correctly
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t2).to.equal(t2);
            expect(entry.c).to.equal(testCommitment);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            expect(entry.sig).to.equal(bobSignature);
        });
        
        it("should reject when t1 is in the past", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp - BigInt(3600); // 1 hour in the past
            const t2 = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            // Create signatures (these won't be checked because the function will fail early)
            const aliceSignature = "0x";
            const bobSignature = "0x";
            
            // Call should fail with t1 in the past
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "OnlyBeforeT1");
        });
        
        it("should reject when t2 is in the past", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(3600); // 1 hour in the future
            const t2 = currentTimestamp - BigInt(3600); // 1 hour in the past
            
            // Create signatures
            const aliceSignature = "0x";
            const bobSignature = "0x";
            
            // Call should fail with t2 in the past
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "T2MustBeFuture");
        });
        
        it("should reject when t2 is before t1", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(10800); // 3 hours in the future
            const t2 = currentTimestamp + BigInt(7200); // 2 hours in the future (before t1)
            
            // Create signatures
            const aliceSignature = "0x";
            const bobSignature = "0x";
            
            // Call should fail with t2 before t1
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "T2MustBeAfterT1");
        });
        
        it("should reject invalid Alice signatures", async function () {
            const alice = addr1;
            const bob = addr2;
            const malicious = addr3;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hash
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign with malicious actor instead of Alice
            const fakeAliceSignature = await malicious.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call should fail with invalid Alice signature
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    fakeAliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "InvalidSignature");
        });
        
        it("should reject invalid Bob signatures", async function () {
            const alice = addr1;
            const bob = addr2;
            const malicious = addr3;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hash
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Create valid Alice signature but invalid Bob signature
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const fakeBobSignature = await malicious.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call should fail with invalid Bob signature
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    aliceSignature, fakeBobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "InvalidSignature");
        });
        
        it("should reject duplicate entries", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // First call should succeed
            await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
            
            // Second call with the same parameters should fail
            await expect(
                thirdProtocol.connect(bob).TriggerDispute(
                    aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
                )
            ).to.be.revertedWithCustomError(thirdProtocol, "EntryAlreadyExists");
        });
        
        it("should measure gas used for TriggerDispute", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Call and measure gas
            const tx = await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for TriggerDispute with valid signatures: ${receipt?.gasUsed.toString()}`);
        });
    });

    describe("SendOp", function () {
        let pid: string;
        let alice: SignerWithAddress;
        let bob: SignerWithAddress;
        let t2: bigint;
        
        beforeEach(async function () {
            alice = addr1;
            bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Create an entry
            await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
        });
        
        it("should allow revealing the key with correct commitment", async function () {
            const tx = await thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid);
            const receipt = await tx.wait();
            console.log(`Gas used for SendOp: ${receipt?.gasUsed.toString()}`);
            
            const entry = await thirdProtocol.GetEntry(pid);
            expect(entry.k).to.equal(testKey);
        });
        
        it("should reject revealing key by non-sender", async function () {
            await expect(
                thirdProtocol.connect(bob).SendOp(testKey, randomValue, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "NotAllowed");
            
            await expect(
                thirdProtocol.connect(owner).SendOp(testKey, randomValue, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "NotAllowed");
        });
        
        it("should reject revealing key after deadline", async function () {
            // Increase time to after the deadline
            await time.increase(10801);
            
            await expect(
                thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "DeadlinePassed");
        });
        
        it("should reject revealing key twice", async function () {
            await thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid);
            
            // Try to reveal again with the same key
            await expect(
                thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "KeyAlreadySet");
        });
        
        it("should reject unknown pid", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            
            await expect(
                thirdProtocol.connect(alice).SendOp(testKey, randomValue, fakePid)
            ).to.be.revertedWithCustomError(thirdProtocol, "UnknownPid");
        });
        
        it("should reject invalid commitment", async function () {
            const wrongKey = ethers.keccak256(ethers.toUtf8Bytes("wrong key"));
            const wrongRandom = BigInt(87654321);
            
            await expect(
                thirdProtocol.connect(alice).SendOp(wrongKey, randomValue, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "InvalidCommitment");
            
            await expect(
                thirdProtocol.connect(alice).SendOp(testKey, wrongRandom, pid)
            ).to.be.revertedWithCustomError(thirdProtocol, "InvalidCommitment");
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
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Create an entry
            await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
        });
        
        it("should return correct entry data", async function () {
            await thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid);
            
            // Estimate gas for GetEntry (view function)
            const gasEstimate = await thirdProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry (only costs gas when called from contracts): ${gasEstimate.toString()}`);
            
            const entry = await thirdProtocol.GetEntry(pid);
            expect(entry.sender).to.equal(alice.address);
            expect(entry.c).to.equal(testCommitment);
            expect(entry.k).to.equal(testKey);
        });
        
        it("should return empty entry for non-existent pid", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            const entry = await thirdProtocol.GetEntry(fakePid);
            
            expect(entry.sender).to.equal(ethers.ZeroAddress);
            expect(entry.t2).to.equal(0);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            expect(entry.c).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        });
    });

    describe("Gas usage summary", function() {
        it("should provide a complete gas usage report", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Deployment gas estimate
            const ThirdProtocolFactory = await ethers.getContractFactory("ThirdProtocol");
            const deployTx = await ThirdProtocolFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Set up the parameters for a workflow
            const currentTimestamp = await thirdProtocol.getTimestamp();
            const t1 = currentTimestamp + BigInt(7200); // 2 hours in the future
            const t2 = currentTimestamp + BigInt(10800); // 3 hours in the future
            
            // Calculate pid
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create the message hashes for the workflow
            const aliceMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'address', 'uint48', 'uint48', 'bytes32'],
                [testCommitment, testHash, bob.address, t1, t2, pid]
            );
            
            const bobMessageHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'bytes32', 'uint48', 'bytes32'],
                [testCommitment, testHash, t2, pid]
            );
            
            // Sign the messages
            const aliceSignature = await alice.signMessage(ethers.getBytes(aliceMessageHash));
            const bobSignature = await bob.signMessage(ethers.getBytes(bobMessageHash));
            
            // Measure TriggerDispute gas
            const triggerTx = await thirdProtocol.connect(bob).TriggerDispute(
                aliceSignature, bobSignature, testCommitment, testHash, t1, t2, alice.address
            );
            const triggerReceipt = await triggerTx.wait();
            console.log(`Gas used for TriggerDispute in workflow: ${triggerReceipt?.gasUsed.toString()}`);
            
            // Measure SendOp gas
            const sendOpTx = await thirdProtocol.connect(alice).SendOp(testKey, randomValue, pid);
            const sendOpReceipt = await sendOpTx.wait();
            console.log(`Gas used for SendOp in workflow: ${sendOpReceipt?.gasUsed.toString()}`);
            
            // GetEntry gas estimate
            const getEntryEstimate = await thirdProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry in workflow: ${getEntryEstimate.toString()}`);
            
            // Log current timestamp
            const finalTimestamp = await thirdProtocol.getTimestamp();
            console.log(`Current timestamp at end of test: ${finalTimestamp.toString()}`);
            
            // Compare gas usage 
            console.log("\nGas usage comparison:");
            console.log(`Optimized TriggerDispute function gas: ${triggerReceipt?.gasUsed.toString()}`);
            console.log(`Optimized SendOp function gas: ${sendOpReceipt?.gasUsed.toString()}`);
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