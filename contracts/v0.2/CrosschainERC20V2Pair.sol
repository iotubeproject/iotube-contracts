// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "./EmergencyOperator.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Mintable {
    function mint(address recipient, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract CrosschainERC20V2Pair is EmergencyOperator {
    using SafeERC20 for IERC20;
    enum ScaleType{ SAME, UP, DOWN }

    IERC20Mintable public crosschainToken;
    IERC20 public token;
    uint256 public immutable scale;
    ScaleType public immutable scaleType;
    uint256 public totalTokenAmount;

    constructor(address _crosschainToken, uint8 _crosschainTokenDecimals, address _token, uint8 _tokenDecimals, address _operator) {
        crosschainToken = IERC20Mintable(_crosschainToken);
        token = IERC20(_token);
        ScaleType st = ScaleType.SAME;
        uint256 s = 1;
        if (_tokenDecimals > _crosschainTokenDecimals) {
            st = ScaleType.DOWN;
            s = 10 ** (_tokenDecimals - _crosschainTokenDecimals);
        } 
        if (_crosschainTokenDecimals > _tokenDecimals) {
            st = ScaleType.UP;
            s = 10 ** (_crosschainTokenDecimals - _tokenDecimals);
        }
        scaleType = st;
        scale = s;
        _setEmergencyOperator(_operator);
    }

    function calculateDepositValues(uint256 _amount) public view returns (uint256, uint256) {
        uint256 mintAmount = _amount;
        if (scaleType == ScaleType.UP) {
            mintAmount = _amount * scale;
        } else if (scaleType == ScaleType.DOWN) {
            mintAmount = _amount / scale;
            _amount = mintAmount * scale;
        }
        return (_amount, mintAmount);
    }

    function calculateWithdrawValues(uint256 _amount) public view returns (uint256, uint256) {
        uint256 transferAmount = _amount;
        if (scaleType == ScaleType.UP) {
            transferAmount = _amount / scale;
            _amount = transferAmount * scale;
        } else if (scaleType == ScaleType.DOWN) {
            transferAmount = _amount * scale;
        }
        return (_amount, transferAmount);
    }

    function _deposit(address _sender, uint256 _depositAmount, address _recipient, uint256 _mintAmount) internal {
        require(_depositAmount != 0 && _mintAmount != 0, "invalid amount");
        token.safeTransferFrom(_sender, address(this), _depositAmount);
        totalTokenAmount += _depositAmount;
        crosschainToken.mint(_recipient, _mintAmount);
    }

    function deposit(uint256 _amount) external returns (uint256 inAmount_, uint256 outAmount_) {
        return depositTo(msg.sender, _amount);
    }

    function depositTo(address _to, uint256 _amount) public returns (uint256 inAmount_, uint256 outAmount_)  {
        (inAmount_, outAmount_) = calculateDepositValues(_amount);
        _deposit(msg.sender, inAmount_, _to, outAmount_);
    }

    function depositNoRounding(uint256 _amount) external returns (uint256 inAmount_, uint256 outAmount_) {
        return depositToNoRounding(msg.sender, _amount);
    }

    function depositToNoRounding(address _to, uint256 _amount) public returns (uint256 inAmount_, uint256 outAmount_) {
        (inAmount_, outAmount_) = calculateDepositValues(_amount);
        require(inAmount_ == _amount, "no rounding");
        _deposit(msg.sender, inAmount_, _to, outAmount_);
    }

    function _withdraw(address _sender, uint256 _burnAmount, address _recipient, uint256 _transferAmount) internal {
        require(_burnAmount != 0 && _transferAmount != 0, "invalid amount");
        crosschainToken.burnFrom(_sender, _burnAmount);
        token.safeTransfer(_recipient, _transferAmount);
        totalTokenAmount -= _transferAmount;
    }

    function withdraw(uint256 _amount) external returns (uint256 inAmount_, uint256 outAmount_)  {
        return withdrawTo(msg.sender, _amount);
    }

    function withdrawTo(address _to, uint256 _amount) public returns (uint256 inAmount_, uint256 outAmount_) {
        (inAmount_, outAmount_) = calculateWithdrawValues(_amount);
        _withdraw(msg.sender, inAmount_, _to, outAmount_);
    }

    function withdrawNoRounding(uint256 _amount) external returns (uint256 inAmount_, uint256 outAmount_) {
        return withdrawToNoRounding(msg.sender, _amount);
    }

    function withdrawToNoRounding(address _to, uint256 _amount) public returns (uint256 inAmount_, uint256 outAmount_) {
        (inAmount_, outAmount_) = calculateWithdrawValues(_amount);
        require(inAmount_ == _amount, "no rounding");
        _withdraw(msg.sender, inAmount_, _to, outAmount_);
    }

    function adhocWithdraw(address _token, uint256 _amount) external onlyEmergencyOperator {
        require(_token != address(token) || _amount == token.balanceOf(address(this)) - totalTokenAmount, "invalid amount");
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}
