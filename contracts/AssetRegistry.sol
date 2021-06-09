// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AssetRegistry is Ownable {
    event AssetRegistered(uint256 indexed sourceTubeID, address indexed sourceAsset, address indexed asset);
    event AssetDeregistered(uint256 indexed sourceTubeID, address indexed sourceAsset, address indexed asset);
    event OperatorGranted(address indexed operator);
    event OperatorRevoked(address indexed operator);

    struct Source {
        uint256 tubeID;
        address asset;
    }

    mapping(address => Source) public sources;
    mapping(uint256 => mapping(address => address)) public assets;

    mapping(address => bool) public operators;

    modifier onlyOperator() {
        require(operators[msg.sender], "no permission");
        _;
    }

    function register(
        uint256 _sourceTubeID,
        address _sourceAsset,
        address _asset
    ) public onlyOperator {
        require(assets[_sourceTubeID][_sourceAsset] == address(0), "registered");
        assets[_sourceTubeID][_sourceAsset] = _asset;
        sources[_asset] = Source(_sourceTubeID, _sourceAsset);
        emit AssetRegistered(_sourceTubeID, _sourceAsset, _asset);
    }

    function deregister(uint256 _sourceTubeID, address _sourceAsset) public onlyOperator {
        address asset = assets[_sourceTubeID][_sourceAsset];
        require(asset != address(0), "not registered");
        delete sources[assets[_sourceTubeID][_sourceAsset]];
        assets[_sourceTubeID][_sourceAsset] = address(0);
        emit AssetDeregistered(_sourceTubeID, _sourceAsset, asset);
    }

    function getSource(address _asset) public view returns (uint256, address) {
        Source storage src = sources[_asset];
        return (src.tubeID, src.asset);
    }

    function getAsset(uint256 _srcTubeID, address _srcAsset) public view returns (address) {
        return assets[_srcTubeID][_srcAsset];
    }

    function grant(address _account) public onlyOwner {
        if (!operators[_account]) {
            operators[_account] = true;
            emit OperatorGranted(_account);
        }
    }

    function revoke(address _account) public onlyOwner {
        if (operators[_account]) {
            operators[_account] = false;
            emit OperatorRevoked(_account);
        }
    }
}
