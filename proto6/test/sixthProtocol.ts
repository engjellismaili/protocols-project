import { expect } from "chai";
import { ethers } from "hardhat";
import { SixthProtocol } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SixthProtocol", function () {
    let sixthProtocol: SixthProtocol;
    let owner: SignerWithAddress;
    // Alice will be addr1, Bob will be addr2
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;

    // Common test values
    let testHash: string;
    let testTao: string;

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        // Deploy the contract
        const SixthProtocolFactory = await ethers.getContractFactory("SixthProtocol");
        sixthProtocol = await SixthProtocolFactory.deploy();
        
        // Generate test values
        testHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
        testTao = ethers.keccak256(ethers.toUtf8Bytes("test tao"));
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await sixthProtocol.getAddress()).to.be.properAddress;
        });
    });

    describe("GetTimestamp", function() {
        it("should return current timestamp", async function() {
            const contractTimestamp = await sixthProtocol.GetTimestamp();
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            
            // Allow small variance (blocktime can be slightly different than JS time)
            expect(contractTimestamp).to.be.closeTo(currentTimestamp, 5n); 
            console.log(`Contract timestamp: ${contractTimestamp.toString()}`);
        });
    });

    describe("SetTuple", function () {
        it("should allow setting a tuple with valid parameters", async function () {
            // Alice is addr1, Bob is addr2
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters - use contract's timestamp instead of JS Date
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Call the SetTuple function
            const tx = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, testHash
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for SetTuple: ${receipt?.gasUsed.toString()}`);
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Get the entry to verify it was created
            const entry = await sixthProtocol.GetEntry(pid);
            
            // Verify the entry was created correctly
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t1).to.equal(t1);
            expect(entry.t2).to.equal(t2);
            expect(entry.tao).to.equal(testTao);
            expect(entry.receiver).to.equal(bob.address);
            // Signature should still be empty
            expect(entry.sig).to.equal("0x");
        });
        
        it("should reject when t2 is in the past", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp - BigInt(7200)); // 2 hours in the past
            const t2 = uint48(currentTimestamp - BigInt(3600)); // 1 hour in the past
            
            // Call should fail with t2 in the past
            await expect(
                sixthProtocol.connect(alice).SetTuple(t1, t2, testTao, bob.address, testHash)
            ).to.be.revertedWith("t2 must be in the future");
        });
        
        it("should reject when t2 is before t1", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            const t2 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future (before t1)
            
            // Call should fail with t2 before t1
            await expect(
                sixthProtocol.connect(alice).SetTuple(t1, t2, testTao, bob.address, testHash)
            ).to.be.revertedWith("t2 must be after t1");
        });
        
        it("should reject duplicate entries", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // First call should succeed
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, testHash
            );
            
            // Second call with the same parameters should fail
            await expect(
                sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, testHash
                )
            ).to.be.revertedWith("Entry already exists");
        });
        
        it("should measure gas used for SetTuple with different parameters", async function () {
            const alice = addr1;
            const bob = addr2;
            
            // Set up different parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Different hashes
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("test data 1"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test data 2"));
            
            // Call and measure gas for first set
            const tx1 = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, hash1
            );
            
            const receipt1 = await tx1.wait();
            
            // Call and measure gas for second set with different hash
            const tx2 = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, hash2
            );
            
            const receipt2 = await tx2.wait();
            
            console.log(`Gas used for first SetTuple: ${receipt1?.gasUsed.toString()}`);
            console.log(`Gas used for second SetTuple: ${receipt2?.gasUsed.toString()}`);
        });
    });

    describe("SetSignature", function () {
        let pid: string;
        let alice: SignerWithAddress;
        let bob: SignerWithAddress;
        let t1: number;
        let t2: number;
        
        beforeEach(async function () {
            alice = addr1;
            bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Create an entry
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, testHash
            );
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testHash);
        });
        
        it("should allow setting a signature with valid parameters", async function () {
            // Create the data hash that Bob will sign
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Bob signs the data hash
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Alice sets the signature
            const tx = await sixthProtocol.connect(alice).SetSignature(signature, pid);
            const receipt = await tx.wait();
            console.log(`Gas used for SetSignature: ${receipt?.gasUsed.toString()}`);
            
            // Verify the signature was set
            const entry = await sixthProtocol.GetEntry(pid);
            expect(entry.sig).to.equal(signature);
        });
        
        it("should reject setting signature for non-existent entry", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            const signature = "0x123456"; // Dummy signature
            
            await expect(
                sixthProtocol.connect(alice).SetSignature(signature, fakePid)
            ).to.be.revertedWith("Entry does not exist");
        });
        
        it("should reject setting signature by non-sender", async function () {
            // Create the data hash that Bob will sign
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Bob signs the data hash
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Someone else tries to set the signature
            await expect(
                sixthProtocol.connect(addr3).SetSignature(signature, pid)
            ).to.be.revertedWith("Only the sender can set the signature");
        });
        
        it("should reject invalid signature", async function () {
            // Create an invalid data hash
            const invalidDataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2 + 1, testTao, pid] // t2 is different than what's in storage
            );
            
            // Bob signs the invalid data hash
            const invalidSignature = await bob.signMessage(ethers.getBytes(invalidDataHash));
            
            // Try to set the invalid signature
            await expect(
                sixthProtocol.connect(alice).SetSignature(invalidSignature, pid)
            ).to.be.revertedWith("Invalid signature");
        });
        
        it("should reject signature by someone else than the receiver", async function () {
            // Create the data hash
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Someone other than Bob signs the data hash
            const wrongSignature = await addr3.signMessage(ethers.getBytes(dataHash));
            
            // Try to set the wrong signature
            await expect(
                sixthProtocol.connect(alice).SetSignature(wrongSignature, pid)
            ).to.be.revertedWith("Invalid signature");
        });
    });

    describe("GetEntry", function () {
        let pid: string;
        let alice: SignerWithAddress;
        let bob: SignerWithAddress;
        let t1: number;
        let t2: number;
        
        beforeEach(async function () {
            alice = addr1;
            bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Create an entry
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, testHash
            );
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create and set the signature
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            await sixthProtocol.connect(alice).SetSignature(signature, pid);
        });
        
        it("should return correct entry data", async function () {
            // Estimate gas for GetEntry (view function)
            const gasEstimate = await sixthProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry (only costs gas when called from contracts): ${gasEstimate.toString()}`);
            
            const entry = await sixthProtocol.GetEntry(pid);
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t1).to.equal(t1);
            expect(entry.t2).to.equal(t2);
            expect(entry.tao).to.equal(testTao);
            expect(entry.receiver).to.equal(bob.address);
            // Verify signature exists (not empty)
            expect(entry.sig).to.not.equal("0x");
            expect(entry.sig.length).to.be.gt(0);
        });
        
        it("should reject retrieving non-existent entry", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            
            await expect(
                sixthProtocol.GetEntry(fakePid)
            ).to.be.revertedWith("Entry does not exist");
        });
    });

    describe("Gas usage summary", function() {
        it("should provide a complete gas usage report", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Deployment gas estimate
            const SixthProtocolFactory = await ethers.getContractFactory("SixthProtocol");
            const deployTx = await SixthProtocolFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Set up the parameters for a workflow
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Measure SetTuple gas
            const setTupleTx = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, testHash
            );
            const setTupleReceipt = await setTupleTx.wait();
            console.log(`Gas used for SetTuple in workflow: ${setTupleReceipt?.gasUsed.toString()}`);
            
            // Calculate pid
            const pid = await createPidForTest(alice.address, bob.address, testHash);
            
            // Create and set the signature
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Measure SetSignature gas
            const setSigTx = await sixthProtocol.connect(alice).SetSignature(signature, pid);
            const setSigReceipt = await setSigTx.wait();
            console.log(`Gas used for SetSignature in workflow: ${setSigReceipt?.gasUsed.toString()}`);
            
            // GetEntry gas estimate
            const getEntryEstimate = await sixthProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry in workflow: ${getEntryEstimate.toString()}`);
            
            // GetTimestamp gas estimate
            const getTimestampEstimate = await sixthProtocol.GetTimestamp.estimateGas();
            console.log(`Gas estimate for GetTimestamp: ${getTimestampEstimate.toString()}`);
            
            // Compare gas usage for different-sized signatures
            const shortData = ethers.toUtf8Bytes("short message");
            const shortHash = ethers.keccak256(shortData);
            const shortSig = await bob.signMessage(ethers.getBytes(shortHash));
            
            const longData = ethers.concat([
                ethers.toUtf8Bytes("This is a much longer message with a lot more text"),
                ethers.toUtf8Bytes(" to see if signature size affects gas costs significantly."),
                ethers.toUtf8Bytes(" Ethereum charges more for larger storage values.")
            ]);
            const longHash = ethers.keccak256(longData);
            const longSig = await bob.signMessage(ethers.getBytes(longHash));
            
            // Create new entry for signature comparison
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test data 2"));
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, hash2
            );
            const pid2 = await createPidForTest(alice.address, bob.address, hash2);
            
            // Get correct data hash for pid2
            const dataHash2 = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid2]
            );
            
            // Create short and long signatures that will work with the contract
            const workingShortSig = await bob.signMessage(ethers.getBytes(dataHash2));
            const workingLongSig = await bob.signMessage(ethers.getBytes(dataHash2));
            
            console.log(`\nSignature size comparison:`);
            console.log(`Short signature length: ${shortSig.length} characters (${Math.floor(shortSig.length / 2 - 1)} bytes)`);
            console.log(`Long signature length: ${longSig.length} characters (${Math.floor(longSig.length / 2 - 1)} bytes)`);
            console.log(`Note: ECDSA signatures have fixed length of 65 bytes, so these will likely be the same size`);
            
            // Measure gas usage for different signature verifications
            const hash3 = ethers.keccak256(ethers.toUtf8Bytes("test data 3"));
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, hash3
            );
            const pid3 = await createPidForTest(alice.address, bob.address, hash3);
            
            const dataHash3 = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid3]
            );
            const sig3 = await bob.signMessage(ethers.getBytes(dataHash3));
            
            const signatureTx = await sixthProtocol.connect(alice).SetSignature(sig3, pid3);
            const signatureReceipt = await signatureTx.wait();
            console.log(`\nGas used for normal SetSignature: ${signatureReceipt?.gasUsed.toString()}`);
            
            // Gas usage table
            console.log("\nGas usage summary table:");
            console.log("+-----------------+------------------+");
            console.log("| Operation       | Gas Used         |");
            console.log("+-----------------+------------------+");
            console.log(`| Deployment      | ${deployEstimate.toString().padStart(16)} |`);
            console.log(`| SetTuple        | ${setTupleReceipt?.gasUsed.toString().padStart(16)} |`);
            console.log(`| SetSignature    | ${setSigReceipt?.gasUsed.toString().padStart(16)} |`);
            console.log(`| GetEntry        | ${getEntryEstimate.toString().padStart(16)} |`);
            console.log(`| GetTimestamp    | ${getTimestampEstimate.toString().padStart(16)} |`);
            console.log("+-----------------+------------------+");
        });
        
        it("should compare gas costs between similar operations", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Set up base parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600));
            const t2 = uint48(currentTimestamp + BigInt(7200));
            
            // Create different test data
            const hashes = [];
            for (let i = 0; i < 5; i++) {
                hashes.push(ethers.keccak256(ethers.toUtf8Bytes(`test data ${i}`)));
            }
            
            // Measure gas costs for sequential SetTuple operations
            console.log("\nGas costs for sequential SetTuple operations:");
            const tupleGasCosts = [];
            for (let i = 0; i < 5; i++) {
                const tx = await sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, hashes[i]
                );
                const receipt = await tx.wait();
                tupleGasCosts.push(receipt?.gasUsed);
                console.log(`SetTuple #${i+1}: ${receipt?.gasUsed.toString()} gas`);
            }
            
            // Calculate average using a simpler approach to avoid errors with .reduce()
            let totalTupleGas = BigInt(0);
            for (const gas of tupleGasCosts) {
                if (gas) totalTupleGas += gas;
            }
            const avgTupleGas = totalTupleGas / BigInt(tupleGasCosts.length);
            console.log(`Average gas for SetTuple: ${avgTupleGas.toString()}`);
            
            // Create pids for signature operations
            const pids = [];
            for (let i = 0; i < 5; i++) {
                pids.push(await createPidForTest(alice.address, bob.address, hashes[i]));
            }
            
            // Create valid signatures
            const signatures = [];
            for (let i = 0; i < 5; i++) {
                const dataHash = ethers.solidityPackedKeccak256(
                    ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                    [alice.address, t1, t2, testTao, pids[i]]
                );
                signatures.push(await bob.signMessage(ethers.getBytes(dataHash)));
            }
            
            // Measure gas costs for sequential SetSignature operations
            console.log("\nGas costs for sequential SetSignature operations:");
            const sigGasCosts = [];
            for (let i = 0; i < 5; i++) {
                const tx = await sixthProtocol.connect(alice).SetSignature(
                    signatures[i], pids[i]
                );
                const receipt = await tx.wait();
                sigGasCosts.push(receipt?.gasUsed);
                console.log(`SetSignature #${i+1}: ${receipt?.gasUsed.toString()} gas`);
            }
            
            // Calculate average using a simpler approach
            let totalSigGas = BigInt(0);
            for (const gas of sigGasCosts) {
                if (gas) totalSigGas += gas;
            }
            const avgSigGas = totalSigGas / BigInt(sigGasCosts.length);
            console.log(`Average gas for SetSignature: ${avgSigGas.toString()}`);
            
            console.log("\nGas cost comparison between operations:");
            console.log(`SetTuple average: ${avgTupleGas.toString()} gas`);
            console.log(`SetSignature average: ${avgSigGas.toString()} gas`);
            console.log(`Difference: ${(avgTupleGas - avgSigGas).toString()} gas`);
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
    
    // Helper function to safely convert to uint48
    function uint48(value: bigint): number {
        // Ensure value fits in uint48 (2^48 - 1)
        const MAX_UINT48 = BigInt(2)**BigInt(48) - BigInt(1);
        if (value > MAX_UINT48) {
            throw new Error(`Value ${value} exceeds maximum uint48 (${MAX_UINT48})`);
        }
        return Number(value);
    }
});