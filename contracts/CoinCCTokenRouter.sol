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

    fallback() external payable {}

    function resetAllowance() public {
        ERC20 wc = ERC20(address(wrappedCoin));
        uint256 allowance = wc.allowance(address(this), address(coinCCToken));
        if (allowance != uint256(-1)) {
            wc.safeIncreaseAllowance(address(coinCCToken), uint256(-1) - allowance);
        }
    }

    function swapCoinForCCToken(uint256 _amount) public payable {
        wrappedCoin.deposit{value: _amount}();
        coinCCToken.depositTo(msg.sender, _amount);
    }

    function swapCCTokenForCoin(uint256 _amount) public {
        ERC20(coinCCToken).safeTransferFrom(msg.sender, address(this), _amount);
        coinCCToken.withdraw(_amount);
        wrappedCoin.withdraw(_amount);
        msg.sender.transfer(_amount);
    }

    function swapWrappedCoinForCCToken(uint256 _amount) public {
        ERC20(address(wrappedCoin)).safeTransferFrom(msg.sender, address(this), _amount);
        coinCCToken.depositTo(msg.sender, _amount);
    }

    function swapCCTokenForWrappedCoin(uint256 _amount) public {
        ERC20(coinCCToken).safeTransferFrom(msg.sender, address(this), _amount);
        coinCCToken.withdrawTo(msg.sender, _amount);
    }

    function swapCoinForWrappedCoin(uint256 _amount) public payable {
        wrappedCoin.deposit{value: _amount}();
        ERC20(address(wrappedCoin)).safeTransfer(msg.sender, _amount);
    }

    function swapWrappedCoinForCoin(uint256 _amount) public {
        ERC20(address(wrappedCoin)).safeTransferFrom(msg.sender, address(this), _amount);
        wrappedCoin.withdraw(_amount);
        msg.sender.transfer(_amount);
    }
}
