import { ethers } from "hardhat";

async function main() {
  const ThirdProtocol = await ethers.getContractFactory("ThirdProtocol");
  const fp = await ThirdProtocol.deploy();
  await fp.waitForDeployment();

  console.log("ThirdProtocol deployed to:", await fp.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});