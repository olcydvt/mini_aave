const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const MockToken = await hre.ethers.getContractFactory("MockERC20");
  const mockToken = await MockToken.deploy("MockERC20", "MockERC20");
  await mockToken.waitForDeployment();
  console.log("MockERC20 deployed to:", await mockToken.getAddress());

  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await interestRateModel.getAddress());

  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await interestRateModel.getAddress());
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());

  const addresses = {
    MockERC20: await mockToken.getAddress(),
    InterestRateModel: await interestRateModel.getAddress(),
    LendingPool: await lendingPool.getAddress(),
  };
  console.log("Deployed addresses:", JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// ### Usage
//   yarn hardhat node
//   yarn hardhat run scripts/deploy.js --network hardhat
