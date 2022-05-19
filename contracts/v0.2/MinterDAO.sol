// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MinterDAO is OwnableUpgradeable, Pausable {
    event NewLord(address indexed lord);
    event MinterAdded(address indexed minter, address indexed token);
    event MinterRemoved(address indexed minter, address indexed token);

    address public lord;
    address public emergencyOperator;
    mapping(address => mapping(address => bool)) private minters;

    modifier onlyEmergencyOperator() {
        require(emergencyOperator == _msgSender(), "caller is not emergency operator");
        _;
    }

    function initialize(address _lord, address _emergencyOperator) public initializer {
        __Ownable_init();
        lord = _lord;
        emergencyOperator = _emergencyOperator;
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

    function setEmergencyOperator(address _emergencyOperator) external onlyOwner {
        emergencyOperator = _emergencyOperator;
    }

    function isMinter(address _account, address _token) external view whenNotPaused returns (bool) {
        return _account == lord || minters[_account][_token];
    }

    function pause() external onlyEmergencyOperator {
        _pause();
    }

    function unpause() external onlyEmergencyOperator {
        _unpause();
    }

    function _msgSender() internal view override(Context, ContextUpgradeable) returns (address) {
        return msg.sender;
    }

    function _msgData() internal pure override(Context, ContextUpgradeable) returns (bytes calldata) {
        return msg.data;
    }
}
