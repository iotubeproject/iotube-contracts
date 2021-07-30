// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./CCERC20.sol";

interface WrappedCoin {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract CCCoinRouter {
    using SafeERC20 for ERC20;

    WrappedCoin public wrappedCoin;
    CCERC20 public ccCoin;

    constructor(CCERC20 _ccCoin) public {
        ERC20 ct = _ccCoin.coToken();
        ccCoin = _ccCoin;
        ct.safeApprove(address(ccCoin), uint256(-1));
        wrappedCoin = WrappedCoin(address(ct));
    }

    fallback() external payable {}

    function resetAllowance() public {
        ERC20 wc = ERC20(address(wrappedCoin));
        uint256 allowance = wc.allowance(address(this), address(ccCoin));
        if (allowance != uint256(-1)) {
            wc.safeIncreaseAllowance(address(ccCoin), uint256(-1) - allowance);
        }
    }

    function swapCoinForCCCoin(uint256 _amount) public payable {
        wrappedCoin.deposit{value: _amount}();
        ccCoin.depositTo(msg.sender, _amount);
    }

    function swapCCCoinForCoin(uint256 _amount) public {
        ERC20(ccCoin).safeTransferFrom(msg.sender, address(this), _amount);
        ccCoin.withdraw(_amount);
        wrappedCoin.withdraw(_amount);
        msg.sender.transfer(_amount);
    }

    function swapWrappedCoinForCCCoin(uint256 _amount) public {
        ERC20(address(wrappedCoin)).safeTransferFrom(msg.sender, address(this), _amount);
        ccCoin.depositTo(msg.sender, _amount);
    }

    function swapCCCoinForWrappedCoin(uint256 _amount) public {
        ERC20(ccCoin).safeTransferFrom(msg.sender, address(this), _amount);
        ccCoin.withdrawTo(msg.sender, _amount);
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
