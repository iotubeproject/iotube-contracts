// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AssetRegistry.sol";
import "./CCToken.sol";

contract CCFactory is Ownable {
    event NewCCToken(
        address indexed _ccToken,
        address indexed _coToken,
        address _lord,
        string _name,
        string _symbol,
        uint8 _decimals
    );
    address public lord;
    AssetRegistry public ar;

    constructor(address _lord, AssetRegistry _ar) public {
        lord = _lord;
        ar = _ar;
    }

    function createForeignToken(
        uint256 _sourceTubeID,
        address _sourceAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public onlyOwner returns (CCToken) {
        require(_sourceTubeID != 0 && _sourceAsset != address(0), "invalid parameter");
        CCToken cc = new CCToken(ERC20(0), lord, _name, _symbol, _decimals);
        emit NewCCToken(address(cc), address(0), lord, _name, _symbol, _decimals);
        ar.register(_sourceTubeID, _sourceAsset, address(cc));

        return cc;
    }

    function createLocalToken(
        ERC20 _coToken,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public onlyOwner returns (CCToken) {
        require(address(_coToken) != address(0), "invalid paramter");
        CCToken cc = new CCToken(_coToken, lord, _name, _symbol, _decimals);
        emit NewCCToken(address(cc), address(_coToken), lord, _name, _symbol, _decimals);
        return cc;
    }
}
