// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMintableToken {
    function mint(address recipient, uint256 amount) external;
}

contract Lord is Ownable {
    function mint(
        address _token,
        address _recipient,
        uint256 _amount
    ) public onlyOwner {
        IMintableToken(_token).mint(_recipient, _amount);
    }
}
