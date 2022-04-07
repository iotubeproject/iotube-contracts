// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AssetUpperBound is Ownable {
    event UppserBoundSet(address indexed asset, uint256 upperBound);

    mapping(address => uint256) public upperBounds;

    function setUpperBound(address _asset, uint256 _upperBound) public onlyOwner {
        upperBounds[_asset] = _upperBound;
        emit UppserBoundSet(_asset, _upperBound);
    }
}
