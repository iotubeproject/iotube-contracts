// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract CCToken is ERC20Burnable, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    event MinterSet(address indexed minter);

    modifier onlyMinter() {
        require(minter == msg.sender, "not the minter");
        _;
    }

    ERC20 public coToken;
    address public minter;

    constructor(
        ERC20 _coToken,
        address _minter,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public ERC20(_name, _symbol) {
        coToken = _coToken;
        minter = _minter;
        _setupDecimals(_decimals);
        emit MinterSet(_minter);
    }

    function transferMintership(address _newMinter) public onlyMinter {
        minter = _newMinter;
        emit MinterSet(_newMinter);
    }

    function deposit(uint256 _amount) public whenNotPaused {
        coToken.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) public whenNotPaused {
        require(_amount != 0, "amount is 0");
        _burn(msg.sender, _amount);
        coToken.safeTransfer(msg.sender, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyMinter {
        require(_amount != 0, "amount is 0");
        _mint(_to, _amount);
    }
}
