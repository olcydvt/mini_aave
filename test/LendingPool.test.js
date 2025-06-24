const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  let lendingPool, mockToken, interestRateModel, aToken, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // MockERC20 sözleşmesini deploy eder
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("MockERC20", "MockERC20");
    await mockToken.waitForDeployment();

    // InterestRateModel sözleşmesini deploy eder
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();

    // LendingPool sözleşmesini deploy eder
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(await interestRateModel.getAddress());
    await lendingPool.waitForDeployment();

    // Kullanıcılara token dağıt
    await mockToken.transfer(user1.address, ethers.parseEther("1000"));
    await mockToken.transfer(user2.address, ethers.parseEther("1000"));
  });

  it("Should allow deposit and mint aTokens", async function () {
    const depositAmount = ethers.parseEther("100");
    await mockToken.connect(user1).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount);

    const aTokenAddress = await lendingPool.aTokens(await mockToken.getAddress());
    aToken = await ethers.getContractAt("AToken", aTokenAddress);
    expect(await aToken.balanceOf(user1.address)).to.equal(depositAmount);
    expect(await lendingPool.deposits(user1.address, await mockToken.getAddress())).to.equal(depositAmount);
  });

  it("Should allow borrowing within LTV", async function () {
    const depositAmount = ethers.parseEther("200");
    const borrowAmount = ethers.parseEther("100");

    await mockToken.connect(user1).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount);

    await mockToken.connect(user2).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user2).deposit(await mockToken.getAddress(), depositAmount);
    await lendingPool.connect(user2).borrow(await mockToken.getAddress(), borrowAmount);

    const userBorrow = await lendingPool.borrows(user2.address, await mockToken.getAddress());
    expect(userBorrow.amount).to.equal(borrowAmount);
  });

  it("Should return correct pool snapshot with accrued interest", async function () {
    const depositAmount = ethers.parseEther("1000");
    await mockToken.connect(user1).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount);

    await mockToken.connect(user2).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user2).deposit(await mockToken.getAddress(), depositAmount);
    await lendingPool.connect(user2).borrow(await mockToken.getAddress(), ethers.parseEther("500"));

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine");

    const snapshot = await lendingPool.getPoolSnapshot(await mockToken.getAddress());
    expect(snapshot.totalLiquidity).to.be.above(depositAmount);
    expect(snapshot.exchangeRate).to.be.above(ethers.parseEther("1"));
    expect(snapshot.accruedInterest).to.be.above(0);
    expect(snapshot.totalBorrows).to.be.above(ethers.parseEther("500"));
    expect(snapshot.borrowRate).to.be.above(0);
    expect(snapshot.borrowIndex).to.be.above(0);
  });

  it("Should allow withdrawal", async function () {
    const depositAmount = ethers.parseEther("100");
    await mockToken.connect(user1).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount);

    await lendingPool.connect(user1).withdraw(await mockToken.getAddress(), depositAmount);
    const deposit = await lendingPool.deposits(user1.address, await mockToken.getAddress())
    console.log("aToken balance after withdraw:", deposit);
    expect(Number(deposit)).to.eq(0);
    expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
  });

  it("Should allow repayment", async function () {
    const depositAmount = ethers.parseEther("200");
    const borrowAmount = ethers.parseEther("100");

    await mockToken.connect(user1).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount);

    await mockToken.connect(user2).approve(await lendingPool.getAddress(), depositAmount);
    await lendingPool.connect(user2).deposit(await mockToken.getAddress(), depositAmount);
    await lendingPool.connect(user2).borrow(await mockToken.getAddress(), borrowAmount);

    await mockToken.connect(user2).approve(await lendingPool.getAddress(), borrowAmount);
    await lendingPool.connect(user2).repay(await mockToken.getAddress(), borrowAmount);

    const userBorrow = await lendingPool.borrows(user2.address, await mockToken.getAddress());
    expect(userBorrow.amount).to.equal(0);
  });
});

// ### Usage
//   yarn hardhat test
