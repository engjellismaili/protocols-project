import { expect } from "chai";
import { ethers } from "hardhat";
import { Ledger } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SeventhProtocol", function () {
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
        testSig = await addr1.signMessage(ethers.getBytes(testKey)); // Sample signature
        testPid = ethers.keccak256(ethers.toUtf8Bytes("test pid"));
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await ledger.getAddress()).to.be.properAddress;
        });
    });

    describe("SetTuple", function () {
        it("should allow setting a tuple with future timestamp", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            const tx = await ledger.connect(addr1).SetTuple(
                testSig, futureTime, testKey, testPid
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for SetTuple: ${receipt?.gasUsed.toString()}`);
            
            // Verify the tuple was stored correctly
            const [sig, t, k] = await ledger.GetTuple(testPid);
            expect(sig).to.equal(testSig);
            expect(t).to.equal(futureTime);
            expect(k).to.equal(testKey);
        });
        
        it("should reject setting tuple with past timestamp", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const pastTime = uint48(currentTimestamp - BigInt(3600)); // 1 hour in the past
            
            await expect(
                ledger.connect(addr1).SetTuple(testSig, pastTime, testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "TimestampMustBeFuture");
        });
        
        it("should reject setting tuple with current timestamp", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            
            await expect(
                ledger.connect(addr1).SetTuple(testSig, uint48(currentTimestamp), testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "TimestampMustBeFuture");
        });
        
        it("should reject setting duplicate entries", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            // First call should succeed
            await ledger.connect(addr1).SetTuple(testSig, futureTime, testKey, testPid);
            
            // Second call should fail
            await expect(
                ledger.connect(addr1).SetTuple(testSig, futureTime, testKey, testPid)
            ).to.be.revertedWithCustomError(ledger, "EntryAlreadyExists");
        });
        
        it("should allow different users to set different tuples", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            const testPid2 = ethers.keccak256(ethers.toUtf8Bytes("test pid 2"));
            const testKey2 = ethers.keccak256(ethers.toUtf8Bytes("test key 2"));
            const testSig2 = await addr2.signMessage(ethers.getBytes(testKey2));
            
            // First user sets their tuple
            const tx1 = await ledger.connect(addr1).SetTuple(
                testSig, futureTime, testKey, testPid
            );
            const receipt1 = await tx1.wait();
            
            // Second user sets their tuple
            const tx2 = await ledger.connect(addr2).SetTuple(
                testSig2, futureTime, testKey2, testPid2
            );
            const receipt2 = await tx2.wait();
            
            console.log(`Gas used for first SetTuple: ${receipt1?.gasUsed.toString()}`);
            console.log(`Gas used for second SetTuple: ${receipt2?.gasUsed.toString()}`);
            
            // Verify both tuples
            const [sig1, t1, k1] = await ledger.GetTuple(testPid);
            expect(sig1).to.equal(testSig);
            expect(t1).to.equal(futureTime);
            expect(k1).to.equal(testKey);
            
            const [sig2, t2, k2] = await ledger.GetTuple(testPid2);
            expect(sig2).to.equal(testSig2);
            expect(t2).to.equal(futureTime);
            expect(k2).to.equal(testKey2);
        });
        
        it("should measure gas used for SetTuple with different signature lengths", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Short signature
            const shortKey = ethers.keccak256(ethers.toUtf8Bytes("short"));
            const shortSig = await addr1.signMessage(ethers.getBytes(shortKey));
            const shortPid = ethers.keccak256(ethers.toUtf8Bytes("short pid"));
            
            // Long signature (simulate a longer signature by concatenating)
            const longData = ethers.concat([
                ethers.toUtf8Bytes("long signature data that is much longer"),
                ethers.toUtf8Bytes("to see how gas costs increase with signature size"),
                ethers.toUtf8Bytes("because signature storage is expensive in Ethereum")
            ]);
            const longKey = ethers.keccak256(longData);
            const longSig = await addr1.signMessage(ethers.getBytes(longKey));
            const longPid = ethers.keccak256(ethers.toUtf8Bytes("long pid"));
            
            // Set tuple with short signature
            const tx1 = await ledger.connect(addr1).SetTuple(
                shortSig, futureTime, shortKey, shortPid
            );
            const receipt1 = await tx1.wait();
            
            // Set tuple with long signature
            const tx2 = await ledger.connect(addr1).SetTuple(
                longSig, futureTime, longKey, longPid
            );
            const receipt2 = await tx2.wait();
            
            console.log(`Gas used for SetTuple with short signature (${shortSig.length} bytes): ${receipt1?.gasUsed.toString()}`);
            console.log(`Gas used for SetTuple with long signature (${longSig.length} bytes): ${receipt2?.gasUsed.toString()}`);
            console.log(`Gas difference: ${(receipt2!.gasUsed - receipt1!.gasUsed).toString()}`);
        });
    });

    describe("GetTuple", function () {
        it("should retrieve a previously set tuple", async function () {
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Set the tuple
            await ledger.connect(addr1).SetTuple(testSig, futureTime, testKey, testPid);
            
            // Get the tuple and verify
            const [sig, t, k] = await ledger.GetTuple(testPid);
            expect(sig).to.equal(testSig);
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
        it("should measure gas usage with different sizes of data", async function() {
            // Setup for gas measurement
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            // Different sized keys (these will all produce the same length keccak256 hash)
            const smallKey = ethers.keccak256(ethers.toUtf8Bytes("small"));
            const mediumKey = ethers.keccak256(ethers.toUtf8Bytes("medium sized key for testing"));
            const largeKey = ethers.keccak256(ethers.toUtf8Bytes("large key with lots of data to see if the key size affects gas consumption in any way"));
            
            // Different PIDs
            const smallPid = ethers.keccak256(ethers.toUtf8Bytes("small-pid"));
            const mediumPid = ethers.keccak256(ethers.toUtf8Bytes("medium-pid"));
            const largePid = ethers.keccak256(ethers.toUtf8Bytes("large-pid"));
            
            // Different signatures
            const smallSig = await addr1.signMessage(ethers.getBytes(smallKey));
            const mediumSig = await addr1.signMessage(ethers.getBytes(mediumKey));
            const largeSig = await addr1.signMessage(ethers.getBytes(largeKey));
            
            // Set tuples with different sized data and measure gas
            const tx1 = await ledger.connect(addr1).SetTuple(
                smallSig, futureTime, smallKey, smallPid
            );
            const receipt1 = await tx1.wait();
            
            const tx2 = await ledger.connect(addr1).SetTuple(
                mediumSig, futureTime, mediumKey, mediumPid
            );
            const receipt2 = await tx2.wait();
            
            const tx3 = await ledger.connect(addr1).SetTuple(
                largeSig, futureTime, largeKey, largePid
            );
            const receipt3 = await tx3.wait();
            
            // Log gas usage
            console.log("\nGas usage for different sized signatures:");
            console.log(`Small signature (${smallSig.length} bytes): ${receipt1?.gasUsed.toString()} gas`);
            console.log(`Medium signature (${mediumSig.length} bytes): ${receipt2?.gasUsed.toString()} gas`);
            console.log(`Large signature (${largeSig.length} bytes): ${receipt3?.gasUsed.toString()} gas`);
            
            // Gas per byte calculation
            const gasPerByteSmall = receipt1!.gasUsed / BigInt(smallSig.length - 2); // -2 for "0x" prefix
            const gasPerByteMedium = receipt2!.gasUsed / BigInt(mediumSig.length - 2);
            const gasPerByteLarge = receipt3!.gasUsed / BigInt(largeSig.length - 2);
            
            console.log("\nGas per byte of signature data:");
            console.log(`Small signature: ${gasPerByteSmall.toString()} gas per byte`);
            console.log(`Medium signature: ${gasPerByteMedium.toString()} gas per byte`);
            console.log(`Large signature: ${gasPerByteLarge.toString()} gas per byte`);
        });
        
        it("should provide a complete gas usage report", async function() {
            // Deployment gas estimate
            const LedgerFactory = await ethers.getContractFactory("Ledger");
            const deployTx = await LedgerFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Setup test data
            const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
            const futureTime = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            
            // SetTuple gas measurement
            const setTx = await ledger.connect(addr1).SetTuple(
                testSig, futureTime, testKey, testPid
            );
            const setReceipt = await setTx.wait();
            console.log(`Gas used for SetTuple: ${setReceipt?.gasUsed.toString()}`);
            
            // GetTuple gas estimate
            const getTupleEstimate = await ledger.GetTuple.estimateGas(testPid);
            console.log(`Gas estimate for GetTuple: ${getTupleEstimate.toString()}`);
            
            // Compare with worst case scenario (empty contract vs. filled storage)
            const emptyContractFactory = await ethers.getContractFactory("Ledger");
            const emptyContract = await emptyContractFactory.deploy();
            
            // Fill the contract with 10 entries to compare gas costs
            for (let i = 0; i < 10; i++) {
                const pid = ethers.keccak256(ethers.toUtf8Bytes(`pid-${i}`));
                const key = ethers.keccak256(ethers.toUtf8Bytes(`key-${i}`));
                const sig = await addr1.signMessage(ethers.getBytes(key));
                
                await ledger.connect(addr1).SetTuple(
                    sig, futureTime, key, pid
                );
            }
            
            // Now measure gas on the contract with filled storage
            const newPid = ethers.keccak256(ethers.toUtf8Bytes("new-pid"));
            const newKey = ethers.keccak256(ethers.toUtf8Bytes("new-key"));
            const newSig = await addr1.signMessage(ethers.getBytes(newKey));
            
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
        });
    });
    
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