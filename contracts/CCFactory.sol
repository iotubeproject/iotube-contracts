// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CCToken.sol";

contract CCFactory is Ownable {

    address public lord;
    constructor(address _lord) {
        lord = _lord;
    }

    function createToken(
        ERC20 _coToken,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public returns (CCToken) {
        return new CCToken(_coToken, lord, _name, _symbol, _decimals);
    }
}