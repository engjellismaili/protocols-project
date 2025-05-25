import { ethers } from "hardhat";

async function main() {
  const FirstProtocol = await ethers.getContractFactory("FirstProtocol");
  const fp = await FirstProtocol.deploy();
  await fp.waitForDeployment();

  console.log("FirstProtocol deployed to:", await fp.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});