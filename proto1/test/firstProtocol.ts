import { expect } from "chai";
import { ethers } from "hardhat";
import { FirstProtocol } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("FirstProtocol", function () {
    let firstProtocol: FirstProtocol;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2] = await ethers.getSigners();
        
        // Deploy the contract
        const FirstProtocolFactory = await ethers.getContractFactory("FirstProtocol");
        firstProtocol = await FirstProtocolFactory.deploy();
    });

    describe("Deployment", function () {
        it("should deploy successfully", async function () {
            expect(await firstProtocol.getAddress()).to.be.properAddress;
        });
    });

    describe("SetT", function () {
        it("should allow setting a future deadline", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            const tx = await firstProtocol.connect(addr1).SetT(futureDeadline);
            const receipt = await tx.wait();
            console.log(`Gas used for SetT: ${receipt?.gasUsed.toString()}`);
            
            await expect(tx)
                .to.emit(firstProtocol, "HaveBeenSet")
                .withArgs(1, addr1.address, futureDeadline);
            
            const entry = await firstProtocol.GetEntry(1);
            expect(entry.sender).to.equal(addr1.address);
            expect(entry.t2).to.equal(futureDeadline);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        });

        it("should reject setting a past deadline", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const pastDeadline = currentTimestamp - BigInt(3600); // 1 hour in the past
            
            await expect(firstProtocol.connect(addr1).SetT(pastDeadline))
                .to.be.revertedWithCustomError(firstProtocol, "DeadlineMustBeFuture");
        });
    });

    describe("SetK", function () {
        it("should allow setting a key before deadline and measure gas", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            await firstProtocol.connect(addr1).SetT(futureDeadline);
            
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            const tx = await firstProtocol.connect(addr1).SetK(1, testKey);
            const receipt = await tx.wait();
            console.log(`Gas used for SetK: ${receipt?.gasUsed.toString()}`);
            
            await expect(tx)
                .to.emit(firstProtocol, "KeySet")
                .withArgs(1, testKey);
            
            const entry = await firstProtocol.connect(addr2).GetEntry(1);
            expect(entry.k).to.equal(testKey);
        });

        it("should revert with UnknownPid for non-existent pid", async function () {
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            await expect(firstProtocol.connect(addr1).SetK(999, testKey))
                .to.be.revertedWithCustomError(firstProtocol, "UnknownPid")
                .withArgs(999);
        });

        it("should revert with NotAllowed for different sender", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            await firstProtocol.connect(addr1).SetT(futureDeadline);
            
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            await expect(firstProtocol.connect(addr2).SetK(1, testKey))
                .to.be.revertedWithCustomError(firstProtocol, "NotAllowed")
                .withArgs(1);
            
            await expect(firstProtocol.connect(owner).SetK(1, testKey))
                .to.be.revertedWithCustomError(firstProtocol, "NotAllowed")
                .withArgs(1);
        });

        it("should revert with DeadlinePassed when trying to set key after deadline", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            await firstProtocol.connect(addr1).SetT(futureDeadline);
            
            // Increase time to after the deadline
            await time.increase(3601);
            
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            
            await expect(firstProtocol.connect(addr1).SetK(1, testKey))
                .to.be.revertedWithCustomError(firstProtocol, "DeadlinePassed");
        });

        it("should revert with KeyAlreadySet when trying to set key twice", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            await firstProtocol.connect(addr1).SetT(futureDeadline);
            
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            await firstProtocol.connect(addr1).SetK(1, testKey);
            
            const newKey = ethers.keccak256(ethers.toUtf8Bytes("new key"));
            await expect(firstProtocol.connect(addr1).SetK(1, newKey))
                .to.be.revertedWithCustomError(firstProtocol, "KeyAlreadySet")
                .withArgs(1);
        });
        
        it("should revert with KeyCannotBeZero when trying to set zero key", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            await firstProtocol.connect(addr1).SetT(futureDeadline);
            
            const zeroKey = ethers.ZeroHash; // 0x0000...0000
            
            await expect(firstProtocol.connect(addr1).SetK(1, zeroKey))
                .to.be.revertedWithCustomError(firstProtocol, "KeyCannotBeZero");
        });
    });

    describe("GetEntry", function () {
        it("should return correct entry data and measure gas for GetEntry", async function () {
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600); // 1 hour in the future
            
            const tx1 = await firstProtocol.connect(addr1).SetT(futureDeadline);
            const receipt1 = await tx1.wait();
            console.log(`Gas used for SetT: ${receipt1?.gasUsed.toString()}`);
            
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            const tx2 = await firstProtocol.connect(addr1).SetK(1, testKey);
            const receipt2 = await tx2.wait();
            console.log(`Gas used for SetK: ${receipt2?.gasUsed.toString()}`);
            
            // Measure gas for GetEntry - this is a view function so it doesn't cost gas on-chain
            // but we can estimate it
            const gasEstimate = await firstProtocol.GetEntry.estimateGas(1);
            console.log(`Gas estimate for GetEntry (only costs gas when called from contracts): ${gasEstimate.toString()}`);
            
            const entry = await firstProtocol.connect(addr2).GetEntry(1);
            expect(entry.sender).to.equal(addr1.address);
            expect(entry.t2).to.equal(futureDeadline);
            expect(entry.k).to.equal(testKey);
        });

        it("should return empty entry for non-existent pid", async function () {
            const entry = await firstProtocol.GetEntry(999);
            expect(entry.sender).to.equal(ethers.ZeroAddress);
            expect(entry.t2).to.equal(0);
            expect(entry.k).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        });
    });

    describe("Gas usage summary", function() {
        it("should provide a complete gas usage report", async function() {
            // Deploy cost
            const FirstProtocolFactory = await ethers.getContractFactory("FirstProtocol");
            const deployTx = await FirstProtocolFactory.getDeployTransaction();
            const deployEstimate = await ethers.provider.estimateGas(deployTx);
            console.log(`Estimated gas for deployment: ${deployEstimate.toString()}`);
            
            // Test a full workflow and record gas usage at each step
            const currentTimestamp = await firstProtocol.getTimestamp();
            const futureDeadline = currentTimestamp + BigInt(3600);
            
            // SetT transaction
            const setTTx = await firstProtocol.connect(addr1).SetT(futureDeadline);
            const setTReceipt = await setTTx.wait();
            console.log(`Gas used for SetT in workflow: ${setTReceipt?.gasUsed.toString()}`);
            
            // SetK transaction
            const testKey = ethers.keccak256(ethers.toUtf8Bytes("test key"));
            const setKTx = await firstProtocol.connect(addr1).SetK(1, testKey);
            const setKReceipt = await setKTx.wait();
            console.log(`Gas used for SetK in workflow: ${setKReceipt?.gasUsed.toString()}`);
            
            // GetEntry gas estimate
            const getEntryEstimate = await firstProtocol.GetEntry.estimateGas(1);
            console.log(`Gas estimate for GetEntry in workflow: ${getEntryEstimate.toString()}`);
            
            console.log("\nComparing gas usage between functions:");
            console.log(`SetT gas usage: ${setTReceipt?.gasUsed.toString()}`);
            console.log(`SetK gas usage: ${setKReceipt?.gasUsed.toString()}`);
        });
    });
});