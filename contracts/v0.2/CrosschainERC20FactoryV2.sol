// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./CrosschainERC20V2.sol";

contract CrosschainERC20FactoryV2 is Ownable {
    using Address for address;

    event NewCrosschainERC20(
        address indexed token,
        address indexed coToken,
        address lord,
        string name,
        string symbol,
        uint8 decimals
    );
    address public tokenInstance;
    address public lord;

    constructor(address _lord, address _tokenInstance) {
        require(_tokenInstance.isContract(), "token instance isn't contract");
        lord = _lord;
    }

    function setLord(address _lord) external onlyOwner {
        lord = _lord;
    }

    function createForeignToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner returns (address) {
        address cc = Clones.clone(tokenInstance);
        CrosschainERC20V2(cc).initialize(IERC20(address(0)), lord, _name, _symbol, _decimals);
        emit NewCrosschainERC20(cc, address(0), lord, _name, _symbol, _decimals);

        return cc;
    }

    function createLocalToken(
        IERC20 _coToken,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner returns (address) {
        require(address(_coToken) != address(0), "invalid paramter");
        address cc = Clones.clone(tokenInstance);
        CrosschainERC20V2(cc).initialize(_coToken, lord, _name, _symbol, _decimals);
        emit NewCrosschainERC20(cc, address(_coToken), lord, _name, _symbol, _decimals);

        return cc;
    }
}
