// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITube {
    function depositTo(
        address _token,
        uint256 _amount,
        uint256 _targetTubeID,
        address _to
    ) external;

    function fees(uint256 _tubeID) external view returns (uint256);

    function tubeToken() external view returns (IERC20);
}

interface ICrosschainToken {
    function deposit(uint256 _amount) external;
    function coToken() external view returns (IERC20);
}

contract ERC20TubeRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    event RelayFeeReceipt(address indexed user, address indexed token, uint256 indexed targetTubeID, uint256 amount);

    mapping(uint256 => uint256) private relayFees;
    address public feeToken;
    ITube public tube;

    constructor(ITube _tube) {
        tube = _tube;
    }

    function setRelayFee(uint256 _tubeID, uint256 _fee) external onlyOwner {
        relayFees[_tubeID] = _fee;
    }

    function setFeeToken(address _feeToken) external onlyOwner {
        feeToken = _feeToken;
    }

    function relayFee(uint256 _tubeID) public view returns (uint256) {
        return relayFees[_tubeID];
    }

    function depositToWithToken(
        address _crosschainToken,
        uint256 _amount,
        uint256 _tubeID,
        address _recipient
    ) external payable nonReentrant {
        uint256 fee = relayFee(_tubeID);
        require(fee > 0, "unset relay fee");
        if (feeToken == address(0)) {
            require(msg.value >= fee, "insufficient relay fee");
        } else {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fee);
        }

        IERC20 token = ICrosschainToken(_crosschainToken).coToken();
        require(address(token) != address(0), "invalid token");
        token.safeTransferFrom(msg.sender, address(this), _amount);
        token.safeApprove(_crosschainToken, _amount);
        ICrosschainToken(_crosschainToken).deposit(_amount);

        uint256 tubeFee = tube.fees(_tubeID);
        if (tubeFee > 0) {
            IERC20 tubeToken = tube.tubeToken();
            tubeToken.safeTransferFrom(msg.sender, address(this), tubeFee);
            tubeToken.safeApprove(address(tube), _amount);
        }
        IERC20(_crosschainToken).safeApprove(address(tube), _amount);
        tube.depositTo(_crosschainToken, _amount, _tubeID, _recipient);
        emit RelayFeeReceipt(msg.sender, _crosschainToken, _tubeID, fee);
    }

    function depositTo(
        address _crosschainToken,
        uint256 _amount,
        uint256 _tubeID,
        address _recipient
    ) external payable nonReentrant {
        uint256 fee = relayFee(_tubeID);
        require(fee > 0, "unset relay fee");
        if (feeToken == address(0)) {
            require(msg.value >= fee, "insufficient relay fee");
        } else {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fee);
        }

        uint256 tubeFee = tube.fees(_tubeID);
        if (tubeFee > 0) {
            IERC20 tubeToken = tube.tubeToken();
            tubeToken.safeTransferFrom(msg.sender, address(this), tubeFee);
            tubeToken.safeApprove(address(tube), _amount);
        }
        IERC20(_crosschainToken).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_crosschainToken).safeApprove(address(tube), _amount);
        tube.depositTo(_crosschainToken, _amount, _tubeID, _recipient);
        emit RelayFeeReceipt(msg.sender, _crosschainToken, _tubeID, fee);
    }

    function withdrawCoin(address payable _to) external onlyOwner {
        Address.sendValue(_to, address(this).balance);
    }

    function withdrawToken(address _to, IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        if (balance > 0) {
            _token.safeTransfer(_to, balance);
        }
    }
}
