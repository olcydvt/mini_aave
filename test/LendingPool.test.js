const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  let lendingPool, weth, usdc, owner, user;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped Ether", "WETH");
    usdc = await MockERC20.deploy("USD Coin", "USDC");

    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy();

    await weth.transfer(user.address, ethers.utils.parseEther("100"));
    await usdc.transfer(user.address, ethers.utils.parseEther("1000"));
  });

  it("Should deposit and mint aTokens", async () => {
    await weth.connect(user).approve(lendingPool.address, ethers.utils.parseEther("10"));
    await lendingPool.connect(user).deposit(weth.address, ethers.utils.parseEther("10"));
    expect(await lendingPool.deposits(user.address)).to.equal(ethers.utils.parseEther("10"));
  });
});