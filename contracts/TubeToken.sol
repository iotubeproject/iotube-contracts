// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TubeToken is ERC20 {
    constructor() public ERC20("Tube Token", "TT") {
        _mint(msg.sender, 10000000000000000000000000000);
    }
}
