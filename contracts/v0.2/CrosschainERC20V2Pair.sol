// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Mintable {
    function mint(address recipient, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract CrosschainERC20V2Pair is Ownable {
    using SafeERC20 for IERC20;

    address internal constant SENTINEL_TOKENS = address(0x1);

    IERC20Mintable public crosschainToken;
    IERC20 public token;

    constructor(address _crosschainToken, address _token) {
        crosschainToken = IERC20Mintable(_crosschainToken);
        token = IERC20(_token);
    }

    function deposit(uint256 _amount) external {
        depositTo(msg.sender, _amount);
    }

    function depositTo(address _to, uint256 _amount) public {
        token.safeTransferFrom(msg.sender, address(this), _amount);
        crosschainToken.mint(_to, _amount);
    }

    function withdraw(uint256 _amount) external {
        withdrawTo(msg.sender, _amount);
    }

    function withdrawTo(address _to, uint256 _amount) public {
        require(_amount != 0, "amount is 0");
        crosschainToken.burnFrom(msg.sender, _amount);
        token.safeTransfer(_to, _amount);
    }
}
