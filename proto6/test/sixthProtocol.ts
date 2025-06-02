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
    let testTao: string;
    // Default pledge amount
    const pledgeAmount = ethers.parseEther("0.1"); // 0.1 ETH

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        // Deploy the contract
        const SixthProtocolFactory = await ethers.getContractFactory("SixthProtocol");
        sixthProtocol = await SixthProtocolFactory.deploy();
        
        // Generate test values
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

    describe("SetTuple with Pledge", function () {
        it("should allow setting a tuple with valid parameters and pledge", async function () {
            // Alice is addr1, Bob is addr2
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Get initial balances
            const aliceInitialBalance = await ethers.provider.getBalance(alice.address);
            const contractInitialBalance = await sixthProtocol.getContractBalance();
            
            // Call the SetTuple function with pledge
            const tx = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            const receipt = await tx.wait();
            console.log(`Gas used for SetTuple with pledge: ${receipt?.gasUsed.toString()}`);
            
            // Calculate transaction fee
            const txFee = receipt ? receipt.gasUsed * receipt.gasPrice : BigInt(0);
            
            // Calculate the pid that will be used
            const pid = await createPidForTest(alice.address, bob.address, testTao);
            
            // Get the entry to verify it was created
            const entry = await sixthProtocol.GetEntry(pid);
            
            // Verify the entry was created correctly
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t1).to.equal(t1);
            expect(entry.t2).to.equal(t2);
            expect(entry.tao).to.equal(testTao);
            expect(entry.receiver).to.equal(bob.address);
            expect(entry.pledgeAmount).to.equal(pledgeAmount);
            expect(entry.pledgeReleased).to.be.false;
            // Signature should still be empty
            expect(entry.sig).to.equal("0x");
            
            // Check balances
            const aliceNewBalance = await ethers.provider.getBalance(alice.address);
            const contractNewBalance = await sixthProtocol.getContractBalance();
            
            // Verify that Alice's balance decreased by pledge + gas
            expect(aliceInitialBalance - aliceNewBalance).to.equal(pledgeAmount + txFee);
            
            // Verify that contract's balance increased by pledge amount
            expect(contractNewBalance - contractInitialBalance).to.equal(pledgeAmount);
        });
        
        it("should reject setting a tuple without pledge", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Call without sending ETH should fail
            await expect(
                sixthProtocol.connect(alice).SetTuple(t1, t2, testTao, bob.address)
            ).to.be.revertedWithCustomError(sixthProtocol, "PledgeAmountTooLow");
        });
        
        it("should reject when t2 is in the past", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp - BigInt(7200)); // 2 hours in the past
            const t2 = uint48(currentTimestamp - BigInt(3600)); // 1 hour in the past
            
            // Call should fail with t2 in the past
            await expect(
                sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, { value: pledgeAmount }
                )
            ).to.be.revertedWithCustomError(sixthProtocol, "T2MustBeInFuture");
        });
        
        it("should reject when t2 is before t1", async function () {
            const alice = addr1;
            const bob = addr2;
            
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            const t2 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future (before t1)
            
            // Call should fail with t2 before t1
            await expect(
                sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, { value: pledgeAmount }
                )
            ).to.be.revertedWithCustomError(sixthProtocol, "T2MustBeAfterT1");
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
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            // Second call with the same parameters should fail
            await expect(
                sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, { value: pledgeAmount }
                )
            ).to.be.revertedWithCustomError(sixthProtocol, "EntryAlreadyExists");
        });
        
        it("should accept different pledge amounts", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600)); // 1 hour in the future
            const t2 = uint48(currentTimestamp + BigInt(7200)); // 2 hours in the future
            
            // Create different hashes for multiple entries
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("test data 1"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test data 2"));
            
            const smallPledge = ethers.parseEther("0.01");
            const largePledge = ethers.parseEther("0.5");
            
            // Create entries with different pledge amounts
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, hash1, bob.address, { value: smallPledge }
            );
            
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, hash2, bob.address, { value: largePledge }
            );
            
            // Calculate pids
            const pid1 = await createPidForTest(alice.address, bob.address, hash1);
            const pid2 = await createPidForTest(alice.address, bob.address, hash2);
            
            // Check entries
            const entry1 = await sixthProtocol.GetEntry(pid1);
            const entry2 = await sixthProtocol.GetEntry(pid2);
            
            expect(entry1.pledgeAmount).to.equal(smallPledge);
            expect(entry2.pledgeAmount).to.equal(largePledge);
        });
    });

    describe("SetSignature with Pledge Release", function () {
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
            
            // Create an entry with pledge
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testTao);
        });
        
        it("should allow setting a signature and release pledge to sender", async function () {
            // Create the data hash that Bob will sign
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Bob signs the data hash
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Get balances before signature
            const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
            const contractBalanceBefore = await sixthProtocol.getContractBalance();
            
            // Alice sets the signature - this should release the pledge back to Alice
            const tx = await sixthProtocol.connect(alice).SetSignature(signature, pid);
            const receipt = await tx.wait();
            const txFee = receipt ? receipt.gasUsed * receipt.gasPrice : BigInt(0);
            
            console.log(`Gas used for SetSignature with pledge release: ${receipt?.gasUsed.toString()}`);
            
            // Get balances after signature
            const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
            const contractBalanceAfter = await sixthProtocol.getContractBalance();
            
            // Verify the signature was set
            const entry = await sixthProtocol.GetEntry(pid);
            expect(entry.sig).to.equal(signature);
            expect(entry.pledgeReleased).to.be.true;
            
            // Verify Alice got her pledge back (minus gas costs)
            expect(aliceBalanceAfter).to.be.closeTo(
                aliceBalanceBefore + pledgeAmount - txFee,
                ethers.parseEther("0.0001") // Allow small rounding difference
            );
            
            // Verify contract balance decreased
            expect(contractBalanceBefore - contractBalanceAfter).to.equal(pledgeAmount);
        });
        
        it("should release pledge to sender after validating signature", async function() {
            // Advance time to after t2 should not matter since we're validating with signature
            await time.increaseTo(t2 + 100);
            
            // Create the data hash that Bob will sign
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Bob signs the data hash
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Get balances before signature
            const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
            
            // Alice sets the signature - this should release the pledge back to Alice
            const tx = await sixthProtocol.connect(alice).SetSignature(signature, pid);
            const receipt = await tx.wait();
            const txFee = receipt ? receipt.gasUsed * receipt.gasPrice : BigInt(0);
            
            // Get balances after signature
            const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
            
            // Verify Alice got her pledge back (minus gas costs)
            expect(aliceBalanceAfter).to.be.closeTo(
                aliceBalanceBefore + pledgeAmount - txFee,
                ethers.parseEther("0.0001") // Allow small rounding difference
            );
        });
        
        it("should reject setting signature for non-existent entry", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            const signature = "0x123456"; // Dummy signature
            
            await expect(
                sixthProtocol.connect(alice).SetSignature(signature, fakePid)
            ).to.be.revertedWithCustomError(sixthProtocol, "EntryDoesNotExist");
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
            ).to.be.revertedWithCustomError(sixthProtocol, "OnlySenderCanSetSignature");
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
            ).to.be.revertedWithCustomError(sixthProtocol, "InvalidSignature");
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
            ).to.be.revertedWithCustomError(sixthProtocol, "InvalidSignature");
        });
        
        it("should reject setting signature twice and claiming pledge twice", async function() {
            // Create the data hash that Bob will sign
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            
            // Bob signs the data hash
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // First signature should succeed
            await sixthProtocol.connect(alice).SetSignature(signature, pid);
            
            // Second attempt should fail
            await expect(
                sixthProtocol.connect(alice).SetSignature(signature, pid)
            ).to.be.revertedWithCustomError(sixthProtocol, "PledgeAlreadyReleased");
        });
    });

    describe("Contract Events", function() {
        it("should emit TupleCreated event", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600));
            const t2 = uint48(currentTimestamp + BigInt(7200));
            
            // Calculate pid
            const pid = await createPidForTest(alice.address, bob.address, testTao);
            
            // Check for event emission
            await expect(
                sixthProtocol.connect(alice).SetTuple(
                    t1, t2, testTao, bob.address, { value: pledgeAmount }
                )
            ).to.emit(sixthProtocol, "TupleCreated")
              .withArgs(pid, alice.address, bob.address, pledgeAmount);
        });
        
        it("should emit PledgeReleased event", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Set up the parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600));
            const t2 = uint48(currentTimestamp + BigInt(7200));
            
            // Create tuple with pledge
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            // Calculate pid
            const pid = await createPidForTest(alice.address, bob.address, testTao);
            
            // Create signature
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Check for event emission
            await expect(
                sixthProtocol.connect(alice).SetSignature(signature, pid)
            ).to.emit(sixthProtocol, "PledgeReleased")
              .withArgs(pid, alice.address, pledgeAmount);
        });
    });

    describe("GetEntry with Pledge Data", function () {
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
            
            // Create an entry with pledge
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            // Calculate pid
            pid = await createPidForTest(alice.address, bob.address, testTao);
            
            // Create and set the signature
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            await sixthProtocol.connect(alice).SetSignature(signature, pid);
        });
        
        it("should return correct entry data including pledge information", async function () {
            // Estimate gas for GetEntry (view function)
            const gasEstimate = await sixthProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry (only costs gas when called from contracts): ${gasEstimate.toString()}`);
            
            const entry = await sixthProtocol.GetEntry(pid);
            expect(entry.sender).to.equal(alice.address);
            expect(entry.t1).to.equal(t1);
            expect(entry.t2).to.equal(t2);
            expect(entry.tao).to.equal(testTao);
            expect(entry.receiver).to.equal(bob.address);
            expect(entry.pledgeAmount).to.equal(pledgeAmount);
            expect(entry.pledgeReleased).to.be.true;
            // Verify signature exists (not empty)
            expect(entry.sig).to.not.equal("0x");
            expect(entry.sig.length).to.be.gt(0);
        });
        
        it("should reject retrieving non-existent entry", async function () {
            const fakePid = ethers.keccak256(ethers.toUtf8Bytes("fake pid"));
            
            await expect(
                sixthProtocol.GetEntry(fakePid)
            ).to.be.revertedWithCustomError(sixthProtocol, "EntryDoesNotExist");
        });
    });

    describe("GetContractBalance", function() {
        it("should track contract balance correctly", async function() {
            const alice = addr1;
            const bob = addr2;
            
            // Initial balance should be 0
            expect(await sixthProtocol.getContractBalance()).to.equal(0);
            
            // Set up parameters
            const currentTimestamp = await sixthProtocol.GetTimestamp();
            const t1 = uint48(currentTimestamp + BigInt(3600));
            const t2 = uint48(currentTimestamp + BigInt(7200));
            
            // Create tuple with pledge
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            
            // Balance should be equal to pledge
            expect(await sixthProtocol.getContractBalance()).to.equal(pledgeAmount);
            
            // Create second tuple with different pledge
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test data 2"));
            const pledgeAmount2 = ethers.parseEther("0.2");
            
            await sixthProtocol.connect(alice).SetTuple(
                t1, t2, hash2, bob.address, { value: pledgeAmount2 }
            );
            
            // Balance should be sum of both pledges
            expect(await sixthProtocol.getContractBalance()).to.equal(pledgeAmount + pledgeAmount2);
            
            // Release first pledge
            const pid1 = await createPidForTest(alice.address, bob.address, testTao);
            const dataHash1 = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid1]
            );
            const signature1 = await bob.signMessage(ethers.getBytes(dataHash1));
            await sixthProtocol.connect(alice).SetSignature(signature1, pid1);
            
            // Balance should be only second pledge now
            expect(await sixthProtocol.getContractBalance()).to.equal(pledgeAmount2);
        });
    });

    describe("Gas usage summary with pledges", function() {
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
                t1, t2, testTao, bob.address, { value: pledgeAmount }
            );
            const setTupleReceipt = await setTupleTx.wait();
            console.log(`Gas used for SetTuple with pledge in workflow: ${setTupleReceipt?.gasUsed.toString()}`);
            
            // Calculate pid
            const pid = await createPidForTest(alice.address, bob.address, testTao);
            
            // Create and set the signature
            const dataHash = ethers.solidityPackedKeccak256(
                ['address', 'uint48', 'uint48', 'bytes32', 'bytes32'],
                [alice.address, t1, t2, testTao, pid]
            );
            const signature = await bob.signMessage(ethers.getBytes(dataHash));
            
            // Measure SetSignature gas
            const setSigTx = await sixthProtocol.connect(alice).SetSignature(signature, pid);
            const setSigReceipt = await setSigTx.wait();
            console.log(`Gas used for SetSignature with pledge release in workflow: ${setSigReceipt?.gasUsed.toString()}`);
            
            // GetEntry gas estimate
            const getEntryEstimate = await sixthProtocol.GetEntry.estimateGas(pid);
            console.log(`Gas estimate for GetEntry in workflow: ${getEntryEstimate.toString()}`);
            
            // GetTimestamp gas estimate
            const getTimestampEstimate = await sixthProtocol.GetTimestamp.estimateGas();
            console.log(`Gas estimate for GetTimestamp: ${getTimestampEstimate.toString()}`);
            
            // GetContractBalance gas estimate
            const getBalanceEstimate = await sixthProtocol.getContractBalance.estimateGas();
            console.log(`Gas estimate for getContractBalance: ${getBalanceEstimate.toString()}`);
            
            // Compare ETH transfer costs vs. regular function calls
            console.log("\nETH transfer costs in contract functions:");
            
            // Create entries with different pledge amounts to compare
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("test data small pledge"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test data large pledge"));
            
            const smallPledge = ethers.parseEther("0.01");
            const largePledge = ethers.parseEther("0.5");
            
            // Small pledge
            const smallTx = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, hash1, bob.address, { value: smallPledge }
            );
            const smallReceipt = await smallTx.wait();
            
            // Large pledge
            const largeTx = await sixthProtocol.connect(alice).SetTuple(
                t1, t2, hash2, bob.address, { value: largePledge }
            );
            const largeReceipt = await largeTx.wait();
            
            console.log(`Gas for SetTuple with small pledge (${ethers.formatEther(smallPledge)} ETH): ${smallReceipt?.gasUsed.toString()}`);
            console.log(`Gas for SetTuple with large pledge (${ethers.formatEther(largePledge)} ETH): ${largeReceipt?.gasUsed.toString()}`);
            console.log(`Difference: ${((largeReceipt?.gasUsed || BigInt(0)) - (smallReceipt?.gasUsed || BigInt(0))).toString()}`);
            
            // Gas usage table
            console.log("\nGas usage summary table:");
            console.log("+-----------------------+------------------+");
            console.log("| Operation             | Gas Used         |");
            console.log("+-----------------------+------------------+");
            console.log(`| Deployment            | ${deployEstimate.toString().padStart(16)} |`);
            console.log(`| SetTuple with pledge  | ${setTupleReceipt?.gasUsed.toString().padStart(16)} |`);
            console.log(`| SetSignature + refund | ${setSigReceipt?.gasUsed.toString().padStart(16)} |`);
            console.log(`| GetEntry              | ${getEntryEstimate.toString().padStart(16)} |`);
            console.log(`| GetTimestamp          | ${getTimestampEstimate.toString().padStart(16)} |`);
            console.log(`| getContractBalance    | ${getBalanceEstimate.toString().padStart(16)} |`);
            console.log("+-----------------------+------------------+");
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