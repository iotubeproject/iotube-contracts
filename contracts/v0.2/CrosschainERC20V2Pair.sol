// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Mintable {
    function mint(address recipient, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract CrosschainERC20V2Pair {
    using SafeERC20 for IERC20;
    enum ScaleType{ SAME, UP, DOWN }

    IERC20Mintable public crosschainToken;
    IERC20 public token;
    uint256 public immutable scale;
    ScaleType public immutable scaleType;

    constructor(address _crosschainToken, uint8 _crosschainTokenDecimals, address _token, uint8 _tokenDecimals) {
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
    }

    function deposit(uint256 _amount) external {
        depositTo(msg.sender, _amount);
    }

    function depositTo(address _to, uint256 _amount) public {
        uint256 mintAmount = _amount;
        if (scaleType == ScaleType.UP) {
            mintAmount = mintAmount * scale;
        } else if (scaleType == ScaleType.DOWN) {
            mintAmount = mintAmount / scale;
        }
        require(_amount != 0 && mintAmount != 0, "invalid amount");
        token.safeTransferFrom(msg.sender, address(this), _amount);
        crosschainToken.mint(_to, mintAmount);
    }


    function depositNoRounding(uint256 _amount) external {
        depositToNoRounding(msg.sender, _amount);
    }

    function depositToNoRounding(address _to, uint256 _amount) public {
        uint256 mintAmount = _amount;
        if (scaleType == ScaleType.UP) {
            mintAmount = mintAmount * scale;
        } else if (scaleType == ScaleType.DOWN) {
            require((mintAmount % scale) == 0, "no rounding");
            mintAmount = mintAmount / scale;
        }
        require(_amount != 0 && mintAmount != 0, "invalid amount");
        token.safeTransferFrom(msg.sender, address(this), _amount);
        crosschainToken.mint(_to, mintAmount);
    }

    function withdraw(uint256 _amount) external {
        withdrawTo(msg.sender, _amount);
    }

    function withdrawTo(address _to, uint256 _amount) public {
        uint256 transferAmount = _amount;
        if (scaleType == ScaleType.UP) {
            transferAmount = transferAmount / scale;
        } else if (scaleType == ScaleType.DOWN) {
            transferAmount = transferAmount * scale;
        }
        require(_amount != 0 && transferAmount != 0, "invalid amount");
        crosschainToken.burnFrom(msg.sender, _amount);
        token.safeTransfer(_to, transferAmount);
    }


    function withdrawNoRounding(uint256 _amount) external {
        withdrawToNoRounding(msg.sender, _amount);
    }

    function withdrawToNoRounding(address _to, uint256 _amount) public {
        uint256 transferAmount = _amount;
        if (scaleType == ScaleType.UP) {
            require((transferAmount % scale) == 0, "no rounding");
            transferAmount = transferAmount / scale;
        } else if (scaleType == ScaleType.DOWN) {
            transferAmount = transferAmount * scale;
        }
        require(_amount != 0 && transferAmount != 0, "invalid amount");
        crosschainToken.burnFrom(msg.sender, _amount);
        token.safeTransfer(_to, transferAmount);
    }
}
