// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MinterDAO is OwnableUpgradeable {
    event NewLord(address indexed lord);
    event MinterAdded(address indexed minter, address indexed token);
    event MinterRemoved(address indexed minter, address indexed token);

    address public lord;
    mapping(address => mapping(address => bool)) private minters;

    function initialize(address _lord) public initializer {
        __Ownable_init();
        lord = _lord;
        emit NewLord(_lord);
    }

    function addMinter(address _minter, address _token) external onlyOwner {
        minters[_minter][_token] = true;
        emit MinterAdded(_minter, _token);
    }

    function removeMinter(address _minter, address _token) external onlyOwner {
        minters[_minter][_token] = false;
        emit MinterRemoved(_minter, _token);
    }

    function isMinter(address _account, address _token) external view returns (bool) {
        return _account == lord || minters[_account][_token];
    }
}
