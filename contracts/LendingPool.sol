// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./tokens/AToken.sol";
import "./InterestRateModel.sol";

contract LendingPool is ReentrancyGuard {
    struct UserBorrow {
        uint amount;
        uint interestIndex;
    }

    // Token-specific storage
    mapping(address => mapping(address => uint)) public deposits; // user => token => amount
    mapping(address => uint) public totalDepositsPerToken;       // token => total supply
    mapping(address => AToken) public aTokens;
    mapping(address => uint) public reserveFactor;
    mapping(address => uint) public totalBorrowsPerToken;
    mapping(address => mapping(address => UserBorrow)) public borrows; // user => token => borrow
    mapping(address => uint) public totalLiquidity;              // token => total liquidity
    
    InterestRateModel public interestRateModel;
    uint public lastUpdateTimestamp;
    uint public constant LTV = 50;
    uint public constant SECONDS_PER_YEAR = 31536000;

    event Deposited(address indexed user, address token, uint amount);
    event Withdrawn(address indexed user, address token, uint amount);
    event Borrowed(address indexed user, address token, uint amount);
    event Repaid(address indexed user, address token, uint amount);
    event InterestAccrued(address indexed token, uint amount);

    constructor(address _interestRateModel) {
        interestRateModel = InterestRateModel(_interestRateModel);
        lastUpdateTimestamp = block.timestamp;
    }

    function deposit(address token, uint amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        _accrueInterest(token);
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        if (address(aTokens[token]) == address(0)) {
            aTokens[token] = new AToken(token);
            reserveFactor[token] = 10;
        }
        
        uint exchangeRate = _getExchangeRate(token);
        uint aTokenAmount = (amount * 1e18) / exchangeRate;
        
        aTokens[token].mint(msg.sender, aTokenAmount);
        deposits[msg.sender][token] += amount;
        totalDepositsPerToken[token] += amount;
        totalLiquidity[token] += amount;
        
        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        _accrueInterest(token);
        
        uint userDeposit = deposits[msg.sender][token];
        require(userDeposit >= amount, "Insufficient balance");
        
        if (borrows[msg.sender][token].amount > 0) {
            uint remainingCollateral = userDeposit - amount;
            uint requiredCollateral = (borrows[msg.sender][token].amount * 100) / LTV;
            require(remainingCollateral >= requiredCollateral, "Insufficient collateral");
        }
        
        uint exchangeRate = _getExchangeRate(token);
        uint aTokenAmount = (amount * 1e18) / exchangeRate;
        
        aTokens[token].burn(msg.sender, aTokenAmount);
        IERC20(token).transfer(msg.sender, amount);
        
        deposits[msg.sender][token] -= amount;
        totalDepositsPerToken[token] -= amount;
        totalLiquidity[token] -= amount;
        
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        _accrueInterest(token);
        
        uint borrowableAmount = getBorrowableAmount(msg.sender, token);
        require(amount <= borrowableAmount, "Exceeds borrow limit");
        
        uint borrowIndex = _getBorrowIndex(token);
        UserBorrow storage userBorrow = borrows[msg.sender][token];
        userBorrow.amount += amount;
        userBorrow.interestIndex = borrowIndex;
        
        totalBorrowsPerToken[token] += amount;
        IERC20(token).transfer(msg.sender, amount);
        
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        _accrueInterest(token);
        
        uint borrowIndex = _getBorrowIndex(token);
        uint principal = (amount * 1e18) / borrowIndex;
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        UserBorrow storage userBorrow = borrows[msg.sender][token];
        require(userBorrow.amount >= principal, "Repayment exceeds borrow");
        userBorrow.amount -= principal;
        userBorrow.interestIndex = borrowIndex;
        
        totalBorrowsPerToken[token] -= principal;
        
        emit Repaid(msg.sender, token, amount);
    }

    function _accrueInterest(address token) internal {
        uint currentTimestamp = block.timestamp;
        uint deltaTime = currentTimestamp - lastUpdateTimestamp;
        
        if (deltaTime > 0 && totalBorrowsPerToken[token] > 0) {
            uint utilizationRate = (totalBorrowsPerToken[token] * 1e18) / totalLiquidity[token];
            uint borrowRate = interestRateModel.getBorrowRateExternal(utilizationRate);
            uint interest = (totalBorrowsPerToken[token] * borrowRate * deltaTime) / (SECONDS_PER_YEAR * 1e18);
            
            uint reserves = (interest * reserveFactor[token]) / 100;
            uint lendersInterest = interest - reserves;
            
            totalBorrowsPerToken[token] += interest;
            totalLiquidity[token] += lendersInterest;
                   
            lastUpdateTimestamp = currentTimestamp;
            emit InterestAccrued(token, interest);
        }
    }

    function _getExchangeRate(address token) internal view returns (uint) {
        if (totalLiquidity[token] == 0 || aTokens[token].totalSupply() == 0) return 1e18;
        return (totalLiquidity[token] * 1e18) / aTokens[token].totalSupply();
    }

    function _getBorrowIndex(address token) internal view returns (uint) {
        if (totalBorrowsPerToken[token] == 0 || aTokens[token].totalSupply() == 0) return 1e18;
        return (totalBorrowsPerToken[token] * 1e18) / aTokens[token].totalSupply();
    }

    function getBorrowableAmount(address user, address token) public view returns (uint) {
        return (deposits[user][token] * LTV) / 100;
    }
}