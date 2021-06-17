// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockSafe {
    using SafeERC20 for IERC20;
    mapping(address => mapping(address => uint256)) public points;
    event DepositToSafe(address token, address recipient, uint256 amount);

    function deposit(IERC20 token, address recipient, uint256 amount) public {
        require(amount >= 1000, "invalid amount");
        token.safeTransferFrom(msg.sender, address(this), amount);
        points[address(token)][recipient] += amount;
        emit DepositToSafe(address(token), recipient, amount);
    }
}