// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AToken is ERC20 {
    address public underlyingAsset;
    constructor(address _asset) ERC20("aToken", "aTKN") {
        underlyingAsset = _asset;
    }

    function mint(address user, uint amount) external {
        _mint(user, amount);
    }

    function burn(address user, uint amount) external {
        _burn(user, amount);
    }
}