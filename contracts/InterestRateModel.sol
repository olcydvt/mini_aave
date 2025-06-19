// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InterestRateModel {
    uint public constant BASE_RATE = 0.05e18; // 5%
    uint public constant SLOPE_1 = 0.20e18;   // 20%
    uint public constant OPTIMAL_UTILIZATION = 0.80e18; // 80%

    // Changed to internal since it's called within the contract
    function getBorrowRate(uint utilization) internal pure returns (uint) {
        if (utilization <= OPTIMAL_UTILIZATION) {
            return BASE_RATE + (utilization * SLOPE_1) / OPTIMAL_UTILIZATION;
        } else {
            uint excessUtil = utilization - OPTIMAL_UTILIZATION;
            return BASE_RATE + SLOPE_1 + (excessUtil * SLOPE_1) / (1e18 - OPTIMAL_UTILIZATION);
        }
    }

    // External wrapper for other contracts
    function getBorrowRateExternal(uint utilization) external pure returns (uint) {
        return getBorrowRate(utilization);
    }

    // Internal calculation for supply rate
    function getSupplyRate(uint utilization, uint reserveFactor) internal pure returns (uint) {
        uint borrowRate = getBorrowRate(utilization);
        return borrowRate * utilization * (1e18 - reserveFactor) / 1e36;
    }
}