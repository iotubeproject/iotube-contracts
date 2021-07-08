pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TubeToken is ERC20 {
    constructor() ERC20("Tube Token", "TT") public {
        _mint(msg.sender, 10000000000000000000000000000);
    }
}