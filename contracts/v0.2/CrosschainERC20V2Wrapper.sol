// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Mintable {
    function mint(address recipient, uint256 amount) external;

    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract CrosschainERC20V2Wrapper is Ownable {
    using SafeERC20 for IERC20;

    event AddCoToken( address indexed coToken);
    event RemoveCoToken(address indexed coToken);

    IERC20Mintable public crosschainToken;
    uint256 public coTokenCount;
    mapping(address => bool) public coTokens;

    constructor(address _crosschainToken) {
        crosschainToken = IERC20Mintable(_crosschainToken);
    }

    function addCoToken(address _coToken) external onlyOwner {
        if(!coTokens[_coToken]) {
            coTokens[_coToken] = true;
            coTokenCount++;
            emit AddCoToken(_coToken);
        }
    }

    function removeCoToken(address _coToken) external onlyOwner {
        if(coTokens[_coToken]) {
            coTokens[_coToken] = false;
            coTokenCount--;
            emit RemoveCoToken(_coToken);
        }
    }

    function deposit(address _coToken, uint256 _amount) external {
        depositTo(_coToken, msg.sender, _amount);
    }

    function depositTo(address _coToken, address _to, uint256 _amount) public {
        require(coTokens[_coToken], "no co-token");
        IERC20(_coToken).safeTransferFrom(msg.sender, address(this), _amount);
        crosschainToken.mint(_to, _amount);
    }

    function withdraw(address _coToken, uint256 _amount) external {
        withdrawTo(_coToken, msg.sender, _amount);
    }

    function withdrawTo(address _coToken, address _to, uint256 _amount) public {
        require(coTokens[_coToken], "no co-token");
        require(_amount != 0, "amount is 0");
        crosschainToken.burnFrom(msg.sender, _amount);
        IERC20(_coToken).safeTransfer(_to, _amount);
    }
}
