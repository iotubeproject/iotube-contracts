// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./CCToken.sol";

interface WrappedCoin {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract CoinCCTokenRouter {
    using SafeERC20 for ERC20;

    WrappedCoin public wrappedCoin;
    CCToken public coinCCToken;

    constructor(CCToken _coinCCToken) public {
        ERC20 ct = _coinCCToken.coToken();
        coinCCToken = _coinCCToken;
        ct.safeApprove(address(coinCCToken), uint256(-1));
        wrappedCoin = WrappedCoin(address(ct));
    }

    function deposit(uint256 _amount) public payable {
        wrappedCoin.deposit{value: _amount}();
        coinCCToken.deposit(_amount);
        ERC20(coinCCToken).safeTransfer(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) public {
        coinCCToken.withdraw(_amount);
        wrappedCoin.withdraw(_amount);
        msg.sender.transfer(_amount);
    }
}
