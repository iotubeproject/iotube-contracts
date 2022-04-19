// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./CrosschainERC20V2.sol";
import "./CrosschainERC20V2Wrapper.sol";

contract CrosschainERC20FactoryV2 is Ownable {
    using Address for address;

    event NewCrosschainERC20(
        address indexed token,
        string name,
        string symbol,
        uint8 decimals
    );
    event NewCrosschainERC20Wrapper(
        address indexed token
    );

    address public tubeRegistry;

    constructor(address _tubeRegistry) {
        tubeRegistry = _tubeRegistry;
    }

    function setTubeRegistry(address _tubeRegistry) external onlyOwner {
        tubeRegistry = _tubeRegistry;
    }

    function createForeignToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner returns (address) {
        CrosschainERC20V2 cc = new CrosschainERC20V2(tubeRegistry, _name, _symbol, _decimals);
        emit NewCrosschainERC20(address(cc), _name, _symbol, _decimals);

        return address(cc);
    }

    function createLocalToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyOwner returns (address, address) {
        CrosschainERC20V2 cc = new CrosschainERC20V2(tubeRegistry, _name, _symbol, _decimals);
        emit NewCrosschainERC20(address(cc), _name, _symbol, _decimals);

        CrosschainERC20V2Wrapper wrapper = new CrosschainERC20V2Wrapper(address(cc));
        Ownable(address(wrapper)).transferOwnership(msg.sender);
        emit NewCrosschainERC20Wrapper(address(cc));

        return (address(cc), address(wrapper));
    }
}
