// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITubeRegistry {
    function canMintCrosschainERC20(address token, address account) external view returns (bool);

    function registerCrosschainERC20Wrapper(address _wrapper) external;
}

contract CrosschainERC20V2 is ERC20Burnable {
    using SafeERC20 for IERC20;

    modifier onlyMinter() {
        require(tubeRegistry.canMintCrosschainERC20(address(this), msg.sender), "not the minter");
        _;
    }

    uint8 private decimals_;
    ITubeRegistry public tubeRegistry;

    constructor(
        address _tubeRegistry,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        tubeRegistry = ITubeRegistry(_tubeRegistry);
        decimals_  = _decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return decimals_;
    }

    function mint(address _to, uint256 _amount) public onlyMinter returns (bool) {
        require(_amount != 0, "amount is 0");
        _mint(_to, _amount);
        return true;
    }
}
