import { expect } from "chai";
import { ethers } from "hardhat";
import { Ledger } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Ledger", function () {
    let ledger: Ledger;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;

    // Common test values
    let testSig: string;
    let testKey: string;
    let testPid: string;
    
    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        // Deploy the contract
        const LedgerFactory = await ethers.getContractFactory("Ledger");
        ledger = await LedgerFactory.deploy();
        
        // Generate test values
        testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
        
        // Create timer value - using contract timestamp like in thirdProtocol.ts
        const currentTimestamp = await ledger.getTimestamp();
        const futureTime = Number(currentTimestamp + BigInt(3600)); // 1 hour in the future
        
        // Create signature over hash h (testKey) and timer t (futureTime)
        // Need to hash them together first
        const dataToSign = ethers.solidityPacked(
            ['bytes32', 'uint48'],
            [testKey, futureTime]
        );
        const messageHash = ethers.keccak256(dataToSign);
        
        // Sign the hash
        testSig = await addr2.signMessage(ethers.getBytes(messageHash));
        
        // Verify signature is 65 bytes
        if (ethers.dataLength(testSig) !== 65) {
            console.warn(`Warning: Signature length is ${ethers.dataLength(testSig)} bytes, not 65 bytes`);
        }
        
        testPid = ethers.keccak256(ethers.toUtf8Bytes("test pid"));
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await ledger.getAddress()).to.be.properAddress;
        });
    });
    
    describe("getTimestamp", function() {
        it("should return the current blockchain timestamp", async function() {
            const contractTimestamp = await ledger.getTimestamp();
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            
            // Allow small variance (blocktime can be different than JS time)
            expect(contractTimestamp).to.be.closeTo(currentTimestamp, 5n);
            console.log(`Current contract timestamp: ${contractTimestamp}`);
        });
        
        it("should estimate gas cost for getTimestamp", async function() {
            const gasEstimate = await ledger.getTimestamp.estimateGas();
            console.log(`Gas estimate for getTimestamp: ${gasEstimate}`);
            expect(gasEstimate).to.be.lt(30000); // Should be very cheap
        });
    });

    describe("SetTuple", function () {
        it("should allow setting a tuple with future timestamp", async function () {
            // Create new timestamp and signature for this test - using BigInt like in thirdProtocol.ts
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Create proper signature based on hash and time
            const dataToSign = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, futureTime]
            );
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            const tx = await ledger.connect(addr1).SetTuple(
                signature, futureTime, testKey, testPid
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for SetTuple: ${receipt?.gasUsed.toString()}`);
            
            // Verify the tuple was stored correctly
            const [sig, t, k] = await ledger.GetTuple(testPid);
            expect(sig).to.equal(signature);
            expect(t).to.equal(futureTime);
            expect(k).to.equal(testKey);
        });
        
        it("should reject setting tuple with past timestamp", async function () {
            const contractTimestamp = await ledger.getTimestamp();
            const pastTime = Number(contractTimestamp - BigInt(3600)); // 1 hour in the past
            
            // Create signature for this test
            const dataToSign = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, pastTime]
            );
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            await expect(
                ledger.connect(addr1).SetTuple(signature, pastTime, testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "TimestampMustBeFuture");
        });
        
        it("should reject setting tuple with current timestamp", async function () {
            const contractTimestamp = await ledger.getTimestamp();
            const currentTime = Number(contractTimestamp);
            
            // Create signature for this test
            const dataToSign = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, currentTime]
            );
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            await expect(
                ledger.connect(addr1).SetTuple(signature, currentTime, testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "TimestampMustBeFuture");
        });
        
        it("should reject setting duplicate entries", async function () {
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Create signature
            const dataToSign = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, futureTime]
            );
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            // First call should succeed
            await ledger.connect(addr1).SetTuple(signature, futureTime, testKey, testPid);
            
            // Second call should fail
            await expect(
                ledger.connect(addr1).SetTuple(signature, futureTime, testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "EntryAlreadyExists");
        });
        
        it("should allow different users to set different tuples", async function () {
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            const testPid2 = ethers.keccak256(ethers.toUtf8Bytes("test pid 2"));
            const testKey2 = ethers.keccak256(ethers.toUtf8Bytes("test key 2"));
            
            // Create signatures for both users
            const dataToSign1 = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, futureTime]
            );
            const messageHash1 = ethers.keccak256(dataToSign1);
            const signature1 = await addr1.signMessage(ethers.getBytes(messageHash1));
            
            const dataToSign2 = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey2, futureTime]
            );
            const messageHash2 = ethers.keccak256(dataToSign2);
            const signature2 = await addr2.signMessage(ethers.getBytes(messageHash2));
            
            // First user sets their tuple
            const tx1 = await ledger.connect(addr1).SetTuple(
                signature1, futureTime, testKey, testPid
            );
            const receipt1 = await tx1.wait();
            
            // Second user sets their tuple
            const tx2 = await ledger.connect(addr2).SetTuple(
                signature2, futureTime, testKey2, testPid2
            );
            const receipt2 = await tx2.wait();
            
            console.log(`Gas used for first SetTuple: ${receipt1?.gasUsed.toString()}`);
            console.log(`Gas used for second SetTuple: ${receipt2?.gasUsed.toString()}`);
            
            // Verify both tuples
            const [sig1, t1, k1] = await ledger.GetTuple(testPid);
            expect(sig1).to.equal(signature1);
            expect(t1).to.equal(futureTime);
            expect(k1).to.equal(testKey);
            
            const [sig2, t2, k2] = await ledger.GetTuple(testPid2);
            expect(sig2).to.equal(signature2);
            expect(t2).to.equal(futureTime);
            expect(k2).to.equal(testKey2);
        });
    });

    describe("GetTuple", function () {
        it("should retrieve a previously set tuple", async function () {
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Create signature
            const dataToSign = ethers.solidityPacked(
                ['bytes32', 'uint48'],
                [testKey, futureTime]
            );
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            // Set the tuple
            await ledger.connect(addr1).SetTuple(signature, futureTime, testKey, testPid);
            
            // Get the tuple and verify
            const [sig, t, k] = await ledger.GetTuple(testPid);
            expect(sig).to.equal(signature);
            expect(t).to.equal(futureTime);
            expect(k).to.equal(testKey);
            
            // Estimate gas for GetTuple
            const gasEstimate = await ledger.GetTuple.estimateGas(testPid);
            console.log(`Gas estimate for GetTuple (only costs gas when called from contracts): ${gasEstimate.toString()}`);
        });
        
        it("should reject retrieving non-existent tuple", async function () {
            const nonExistentPid = ethers.keccak256(ethers.toUtf8Bytes("non-existent pid"));
            
            // Attempt to get a non-existent tuple should fail
            await expect(
                ledger.GetTuple(nonExistentPid)
            ).to.be.revertedWithCustomError(ledger, "EntryDoesNotExist");
        });
    });

    describe("Gas usage comparison", function() {
        it("should measure gas usage with different sizes of signatures", async function() {
            // Setup for gas measurement
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Different keys to sign
            const smallKey = ethers.keccak256(ethers.toUtf8Bytes("small"));
            const mediumKey = ethers.keccak256(ethers.toUtf8Bytes("medium"));
            const largeKey = ethers.keccak256(ethers.toUtf8Bytes("large"));
            
            // Different PIDs
            const smallPid = ethers.keccak256(ethers.toUtf8Bytes("small-pid"));
            const mediumPid = ethers.keccak256(ethers.toUtf8Bytes("medium-pid"));
            const largePid = ethers.keccak256(ethers.toUtf8Bytes("large-pid"));
            
            // Create signatures
            const smallData = ethers.solidityPacked(['bytes32', 'uint48'], [smallKey, futureTime]);
            const mediumData = ethers.solidityPacked(['bytes32', 'uint48'], [mediumKey, futureTime]);
            const largeData = ethers.solidityPacked(['bytes32', 'uint48'], [largeKey, futureTime]);
            
            const smallHash = ethers.keccak256(smallData);
            const mediumHash = ethers.keccak256(mediumData);
            const largeHash = ethers.keccak256(largeData);
            
            const smallSig = await addr1.signMessage(ethers.getBytes(smallHash));
            const mediumSig = await addr2.signMessage(ethers.getBytes(mediumHash));
            const largeSig = await addr3.signMessage(ethers.getBytes(largeHash));
            
            // All signatures should be the same size (65 bytes) because they're ECDSA signatures
            console.log(`Small signature length: ${ethers.dataLength(smallSig)}`);
            console.log(`Medium signature length: ${ethers.dataLength(mediumSig)}`);
            console.log(`Large signature length: ${ethers.dataLength(largeSig)}`);
            
            // Set tuples with different signatures and measure gas
            const tx1 = await ledger.connect(addr1).SetTuple(
                smallSig, futureTime, smallKey, smallPid
            );
            const receipt1 = await tx1.wait();
            
            const tx2 = await ledger.connect(addr2).SetTuple(
                mediumSig, futureTime, mediumKey, mediumPid
            );
            const receipt2 = await tx2.wait();
            
            const tx3 = await ledger.connect(addr3).SetTuple(
                largeSig, futureTime, largeKey, largePid
            );
            const receipt3 = await tx3.wait();
            
            // Log gas usage (should be similar since signatures are fixed size)
            console.log("\nGas usage for different signers:");
            console.log(`Signer 1: ${receipt1?.gasUsed.toString()} gas`);
            console.log(`Signer 2: ${receipt2?.gasUsed.toString()} gas`);
            console.log(`Signer 3: ${receipt3?.gasUsed.toString()} gas`);
            
            // Gas comparison for fixed-size signatures
            console.log("\nGas comparison for fixed-size signatures:");
            console.log(`Max difference: ${Math.max(
                Number(receipt1!.gasUsed - receipt2!.gasUsed),
                Number(receipt2!.gasUsed - receipt3!.gasUsed),
                Number(receipt3!.gasUsed - receipt1!.gasUsed)
            )}`);
        });
        
        it("should provide a complete gas usage report", async function() {
            // Deployment gas estimate
            const LedgerFactory = await ethers.getContractFactory("Ledger");
            const deployTx = await LedgerFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Setup test data
            const contractTimestamp = await ledger.getTimestamp();
            const futureTime = Number(contractTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Create signature
            const dataToSign = ethers.solidityPacked(['bytes32', 'uint48'], [testKey, futureTime]);
            const messageHash = ethers.keccak256(dataToSign);
            const signature = await addr2.signMessage(ethers.getBytes(messageHash));
            
            // SetTuple gas measurement
            const setTx = await ledger.connect(addr1).SetTuple(
                signature, futureTime, testKey, testPid
            );
            const setReceipt = await setTx.wait();
            console.log(`Gas used for SetTuple: ${setReceipt?.gasUsed.toString()}`);
            
            // GetTuple gas estimate
            const getTupleEstimate = await ledger.GetTuple.estimateGas(testPid);
            console.log(`Gas estimate for GetTuple: ${getTupleEstimate.toString()}`);
            
            // getTimestamp gas estimate
            const getTimestampEstimate = await ledger.getTimestamp.estimateGas();
            console.log(`Gas estimate for getTimestamp: ${getTimestampEstimate.toString()}`);
            
            // Compare with worst case scenario (empty contract vs. filled storage)
            const emptyContractFactory = await ethers.getContractFactory("Ledger");
            const emptyContract = await emptyContractFactory.deploy();
            
            // Fill the contract with 10 entries to compare gas costs
            for (let i = 0; i < 10; i++) {
                const pid = ethers.keccak256(ethers.toUtf8Bytes(`pid-${i}`));
                const key = ethers.keccak256(ethers.toUtf8Bytes(`key-${i}`));
                
                const dataToSign = ethers.solidityPacked(['bytes32', 'uint48'], [key, futureTime]);
                const messageHash = ethers.keccak256(dataToSign);
                const sig = await addr1.signMessage(ethers.getBytes(messageHash));
                
                await ledger.connect(addr1).SetTuple(
                    sig, futureTime, key, pid
                );
            }
            
            // Now measure gas on the contract with filled storage
            const newPid = ethers.keccak256(ethers.toUtf8Bytes("new-pid"));
            const newKey = ethers.keccak256(ethers.toUtf8Bytes("new-key"));
            
            const newDataToSign = ethers.solidityPacked(['bytes32', 'uint48'], [newKey, futureTime]);
            const newMessageHash = ethers.keccak256(newDataToSign);
            const newSig = await addr1.signMessage(ethers.getBytes(newMessageHash));
            
            const filledStorageTx = await ledger.connect(addr1).SetTuple(
                newSig, futureTime, newKey, newPid
            );
            const filledStorageReceipt = await filledStorageTx.wait();
            
            // Empty contract (first transaction)
            const emptyStorageTx = await emptyContract.connect(addr1).SetTuple(
                newSig, futureTime, newKey, newPid
            );
            const emptyStorageReceipt = await emptyStorageTx.wait();
            
            console.log("\nGas usage comparison between empty and filled storage:");
            console.log(`Gas for SetTuple on empty contract: ${emptyStorageReceipt?.gasUsed.toString()}`);
            console.log(`Gas for SetTuple on contract with 10 entries: ${filledStorageReceipt?.gasUsed.toString()}`);
            console.log(`Difference: ${((emptyStorageReceipt?.gasUsed || BigInt(0)) - (filledStorageReceipt?.gasUsed || BigInt(0))).toString()}`);
            
            // Log current timestamp at end of test (like in thirdProtocol.ts)
            const finalTimestamp = await ledger.getTimestamp();
            console.log(`Current timestamp at end of test: ${finalTimestamp.toString()}`);
            
            // Gas usage table
            console.log("\nGas usage summary table:");
            console.log("+-----------------------+------------------+");
            console.log("| Operation             | Gas Used         |");
            console.log("+-----------------------+------------------+");
            console.log(`| Deployment            | ${deployEstimate.toString().padStart(16)} |`);
            console.log(`| SetTuple              | ${setReceipt?.gasUsed.toString().padStart(16)} |`);
            console.log(`| GetTuple (estimate)   | ${getTupleEstimate.toString().padStart(16)} |`);
            console.log(`| getTimestamp          | ${getTimestampEstimate.toString().padStart(16)} |`);
            console.log("+-----------------------+------------------+");
        });
    });
});