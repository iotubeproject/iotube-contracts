// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CrosschainERC20V2 is ERC20BurnableUpgradeable {
    using SafeERC20 for IERC20;

    modifier onlyMinter() {
        require(minter == msg.sender, "not the minter");
        _;
    }

    IERC20 public coToken;
    address public minter;
    uint8 private decimals_;

    function initialize(
        IERC20 _coToken,
        address _minter,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external initializer {
        __ERC20_init(_name, _symbol);
        coToken = _coToken;
        minter = _minter;
        decimals_  = _decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return decimals_;
    }

    function deposit(uint256 _amount) public {
        depositTo(msg.sender, _amount);
    }

    function depositTo(address _to, uint256 _amount) public {
        require(address(coToken) != address(0), "no co-token");
        coToken.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(_to, _amount);
    }

    function withdraw(uint256 _amount) public {
        withdrawTo(msg.sender, _amount);
    }

    function withdrawTo(address _to, uint256 _amount) public {
        require(address(coToken) != address(0), "no co-token");
        require(_amount != 0, "amount is 0");
        _burn(msg.sender, _amount);
        coToken.safeTransfer(_to, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyMinter returns (bool) {
        require(_amount != 0, "amount is 0");
        _mint(_to, _amount);
        return true;
    }
}
