// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CCToken.sol";

contract CCFactory is Ownable {
    event NewCCToken(
        address indexed _ccToken,
        address indexed _coToken,
        address _lord,
        string _name,
        string _symbol,
        uint8 _decimals
    );
    address public lord;

    constructor(address _lord) public {
        lord = _lord;
    }

    function createForeignToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public onlyOwner returns (CCToken) {
        CCToken cc = new CCToken(ERC20(0), lord, _name, _symbol, _decimals, false);
        emit NewCCToken(address(cc), address(0), lord, _name, _symbol, _decimals);

        return cc;
    }

    function createLocalToken(
        ERC20 _coToken,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public onlyOwner returns (CCToken) {
        require(address(_coToken) != address(0), "invalid paramter");
        CCToken cc = new CCToken(_coToken, lord, _name, _symbol, _decimals, false);
        emit NewCCToken(address(cc), address(_coToken), lord, _name, _symbol, _decimals);
        return cc;
    }
}
