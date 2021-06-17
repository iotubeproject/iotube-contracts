// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Ledger.sol";
import "./Lord.sol";

interface IToken {
    function mint(address account, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

interface IAssetRegistry {
    function getAsset(uint256 _srcTubeID, address _srcAsset) external view returns (address);
}

contract Tube is Ownable, Pausable {
    using SafeERC20 for IERC20;

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event Settled(bytes32 indexed key, address[] validators, bool success);

    event Receipt(
        uint256 indexed tubeID,
        address indexed token,
        uint256 indexed txIdx,
        address sender,
        address recipient,
        uint256 amount,
        bytes data,
        uint256 fee
    );

    uint256 public tubeID;
    Ledger public ledger;
    Lord public lord;
    IAssetRegistry public assetRegistry;
    IERC20 public tubeToken;
    address[] public validators;
    mapping(address => uint256) private validatorIndexes;
    mapping(uint256 => mapping(address => uint256)) public counts;
    mapping(uint256 => uint256) public fees;

    constructor(
        uint256 _tubeID,
        Ledger _ledger,
        Lord _lord,
        IERC20 _tubeToken,
        IAssetRegistry _assetRegistry
    ) public {
        tubeID = _tubeID;
        ledger = _ledger;
        lord = _lord;
        tubeToken = _tubeToken;
        assetRegistry = _assetRegistry;
    }

    function upgrade(address _newTube) public onlyOwner {
        if (ledger.owner() == address(this)) {
            ledger.transferOwnership(_newTube);
        }
        if (lord.owner() == address(this)) {
            lord.transferOwnership(_newTube);
        }
    }

    function count(uint256 _tubeID, address _token) public view returns (uint256) {
        return counts[_tubeID][_token];
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function getValidators(uint256 offset, uint8 limit)
        public
        view
        returns (uint256 count_, address[] memory validators_)
    {
        count_ = validators.length;
        validators_ = new address[](limit);
        for (uint256 i = 0; i < limit; i++) {
            if (offset + i >= validators.length) {
                break;
            }
            validators_[i] = validators[offset + i];
        }
    }

    function addValidator(address _validator) public onlyOwner whenPaused {
        require(_validator != address(0), "invalid validator");
        if (validatorIndexes[_validator] != 0) {
            return;
        }
        validators.push(_validator);
        validatorIndexes[_validator] = validators.length;
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) public onlyOwner whenPaused {
        uint256 index = validatorIndexes[_validator];
        if (index == 0) {
            return;
        }
        address last = validators[validators.length - 1];
        validators[index - 1] = last;
        validatorIndexes[last] = index;
        validators.pop();
        delete validatorIndexes[_validator];
        emit ValidatorRemoved(_validator);
    }

    function setFee(uint256 _tubeID, uint256 _fee) public onlyOwner {
        fees[_tubeID] = _fee;
    }

    function depositTo(
        uint256 _tubeID,
        address _token,
        address _to,
        uint256 _amount,
        bytes memory _data
    ) public whenNotPaused {
        require(_to != address(0), "invalid recipient");
        require(_amount > 0, "invalid amount");
        uint256 fee = fees[_tubeID];
        if (fee > 0) {
            tubeToken.safeTransferFrom(msg.sender, address(this), fee);
        }
        IToken(_token).burnFrom(msg.sender, _amount);
        uint256 txIdx = counts[_tubeID][_token]++;
        emit Receipt(_tubeID, _token, txIdx, msg.sender, _to, _amount, _data, fee);
    }

    function deposit(
        uint256 _tubeID,
        address _token,
        uint256 _amount,
        bytes memory _data
    ) public {
        depositTo(_tubeID, _token, msg.sender, _amount, _data);
    }

    function genKey(
        uint256 _srcTubeID,
        address _token,
        uint256 _txIdx,
        address _recipient,
        uint256 _amount,
        bytes memory _data
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_srcTubeID, tubeID, _token, _txIdx, _recipient, _amount, _data));
    }

    function concatKeys(bytes32[] memory keys) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keys));
    }

    function isSettled(bytes32 key) public view returns (bool) {
        return ledger.get(key) != 0;
    }

    function withdraw(
        uint256 _srcTubeID,
        address _srcToken,
        uint256 _txIdx,
        address _recipient,
        uint256 _amount,
        bytes memory _data,
        bytes memory _signatures
    ) public whenNotPaused {
        require(_amount != 0, "amount is 0");
        require(_recipient != address(0), "invalid recipient");
        require(_signatures.length % 65 == 0, "invalid signature length");
        address dstToken = assetRegistry.getAsset(_srcTubeID, _srcToken);
        require(dstToken != address(0), "invalid tubeId and token");
        bytes32 key = genKey(_srcTubeID, _srcToken, _txIdx, _recipient, _amount, _data);
        ledger.record(key);
        address[] memory signers = extractValidators(key, _signatures);
        require(signers.length * 3 > validators.length * 2, "insufficient validators");
        bool success = true;
        if (_data.length > 0) {
            lord.mint(dstToken, address(this), _amount);
            IERC20(dstToken).safeApprove(_recipient, _amount);
            (success, ) = _recipient.call(_data);
            if (!success) {
                IERC20(dstToken).safeDecreaseAllowance(_recipient, _amount);
            }
        } else {
            lord.mint(dstToken, _recipient, _amount);
        }
        emit Settled(key, signers, success);
    }

    function withdrawInBatch(
        uint256[] memory _srcTubeIDs,
        address[] memory _srcTokens,
        uint256[] memory _txIdxs,
        address[] memory _recipients,
        uint256[] memory _amounts,
        bytes memory _signatures
    ) public whenNotPaused {
        uint256 cnt = _amounts.length;
        require(cnt > 0, "invalid array length");
        require(_signatures.length % 65 == 0, "invalid signature length");
        require(
            _srcTubeIDs.length == cnt && _srcTokens.length == cnt && _txIdxs.length == cnt && _recipients.length == cnt,
            "invalid parameters"
        );

        address[] memory dstTokens = new address[](cnt);
        for (uint256 i = 0; i < cnt; i++) {
            dstTokens[i] = assetRegistry.getAsset(_srcTubeIDs[i], _srcTokens[i]);
            require(dstTokens[i] != address(0), "invalid tubeId and token");
        }
        bytes32[] memory keys = new bytes32[](cnt);
        for (uint256 i = 0; i < cnt; i++) {
            require(_amounts[i] != 0, "amount is 0");
            require(_recipients[i] != address(0), "invalid recipient");
            keys[i] = genKey(_srcTubeIDs[i], _srcTokens[i], _txIdxs[i], _recipients[i], _amounts[i], "");
            ledger.record(keys[i]);
        }
        address[] memory signers = extractValidators(concatKeys(keys), _signatures);
        require(signers.length * 3 > validators.length * 2, "insufficient validators");
        for (uint256 i = 0; i < cnt; i++) {
            lord.mint(dstTokens[i], _recipients[i], _amounts[i]);
            emit Settled(keys[i], signers, true);
        }
    }

    function extractValidators(bytes32 _key, bytes memory _signatures)
        public
        view
        returns (address[] memory validators_)
    {
        uint256 numOfSignatures = _signatures.length / 65;
        validators_ = new address[](numOfSignatures);
        for (uint256 i = 0; i < numOfSignatures; i++) {
            address validator = recover(_key, _signatures, i * 65);
            require(validatorIndexes[validator] != 0, "invalid validator");
            for (uint256 j = 0; j < i; j++) {
                require(validator != validators_[j], "duplicate validator");
            }
            validators_[i] = validator;
        }
    }

    function withdrawRelayerFee(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    function withdrawToken(address _to, IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        if (balance > 0) {
            _token.safeTransfer(_to, balance);
        }
    }

    function recover(
        bytes32 hash,
        bytes memory signature,
        uint256 offset
    ) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        // Divide the signature in r, s and v variables with inline assembly.

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, add(offset, 0x20)))
            s := mload(add(signature, add(offset, 0x40)))
            v := byte(0, mload(add(signature, add(offset, 0x60))))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return (address(0));
        }
        // solium-disable-next-line arg-overflow
        return ecrecover(hash, v, r, s);
    }
}
