// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

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

contract TubeRouterV2 is Ownable {
    using SafeERC20 for IERC20;
    event RelayFeeReceipt(address user, uint256 amount);

    mapping(uint256 => uint256) private relayFees;
    ITube public tube;

    constructor(ITube _tube) {
        tube = _tube;
    }

    function setRelayFee(uint256 _tubeID, uint256 _fee) public onlyOwner {
        relayFees[_tubeID] = _fee;
    }

    function relayFee(uint256 _tubeID) public view returns (uint256) {
        return relayFees[_tubeID];
    }

    function depositTo(
        address _token,
        uint256 _amount,
        uint256 _tubeID,
        address _recipient
    ) public payable {
        uint256 fee = relayFee(_tubeID);
        require(fee > 0 && msg.value >= fee, "insufficient relay fee");
        uint256 tubeFee = tube.fees(_tubeID);
        if (tubeFee > 0) {
            IERC20 tubeToken = tube.tubeToken();
            tubeToken.safeTransferFrom(msg.sender, address(this), tubeFee);
            tubeToken.safeApprove(address(tube), _amount);
        }
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeApprove(address(tube), _amount);
        tube.depositTo(_token, _amount, _tubeID, _recipient);
        emit RelayFeeReceipt(msg.sender, msg.value);
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
