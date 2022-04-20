// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface ICrosschainERC20V2Wrapper {
    function crosschainToken() external view returns (address);
}

contract TubeRegistry is OwnableUpgradeable {
    event NewLord(address indexed lord);
    event RegisterCrosschainERC20Wrapper(address indexed wrapper);

    address public lord;
    mapping(address => address) wrappers;

    function initialize(address _lord) public initializer {
        __Ownable_init();
        lord = _lord;
        emit NewLord(_lord);
    }

    function registerCrosschainERC20Wrapper(address _wrapper) external onlyOwner {
        wrappers[ICrosschainERC20V2Wrapper(_wrapper).crosschainToken()] = _wrapper;
        emit RegisterCrosschainERC20Wrapper(_wrapper);
    }

    function canMintCrosschainERC20(address token, address account) external view returns (bool) {
        return account == lord || wrappers[token] == account;
    }
}
