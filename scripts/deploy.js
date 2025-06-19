// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const { deploy } = hre.deployments;
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy Mock WETH (with explicit tags)
  const weth = await deploy("MockERC20", {
    from: deployer.address,
    args: ["Wrapped Ether", "WETH"],
    log: true,
    tags: ["tokens", "all"], // Tagged for token group
  });

  // 2. Deploy Mock USDC
  const usdc = await deploy("MockERC20", {
    from: deployer.address,
    args: ["USD Coin", "USDC"],
    log: true,
    tags: ["tokens", "all"], 
  });

  // 3. Deploy LendingPool (with token addresses if needed)
  const lendingPool = await deploy("LendingPool", {
    from: deployer.address,
    args: [], // Add [weth.address, usdc.address] if constructor requires
    log: true,
    waitConfirmations: 2, // Wait for 2 confirmations on live nets
    tags: ["lending", "all"], // Tagged for lending group
  });

  console.log("\nDeployment Summary:");
  console.log("WETH deployed to:", weth.address);
  console.log("USDC deployed to:", usdc.address);
  console.log("LendingPool deployed to:", lendingPool.address);

  // 4. Optional: Verify on Etherscan
  if (hre.network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: lendingPool.address,
        constructorArguments: [],
      });
    } catch (e) {
      console.log("Verification failed (might already be verified):", e.message);
    }
  }
}

// Global tags (for backward compatibility)
main.tags = ["all"];

module.exports = main;

//yarn hardhat deploy --tags tokens --network sepolia
//yarn hardhat deploy --tags lending --network sepolia