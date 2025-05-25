import { ethers } from "hardhat";

async function main() {
  const SecondProtocol = await ethers.getContractFactory("SecondProtocol");
  const fp = await SecondProtocol.deploy();
  await fp.waitForDeployment();

  console.log("FirstProtocol deployed to:", await fp.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});