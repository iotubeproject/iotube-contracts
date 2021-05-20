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

contract Tube is Ownable, Pausable {
    using SafeERC20 for IERC20;

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event Settled(bytes32 indexed key, address[] validators);

    event Receipt(
        uint256 indexed tubeID,
        address indexed token,
        uint256 indexed txIdx,
        address sender,
        address recipient,
        uint256 amount,
        uint256 relayerFee,
        uint256 tubeFee
    );

    uint256 public tubeID;
    Ledger public ledger;
    Lord public lord;
    IERC20 public tubeToken;
    address[] public validators;
    mapping(address => uint256) private validatorIndexes;
    mapping(uint256 => mapping(address => uint256)) counts;
    mapping(uint256 => uint256) public relayerFees;
    mapping(uint256 => uint256) public tubeFees;

    constructor(
        uint256 _tubeID,
        Ledger _ledger,
        Lord _lord,
        IERC20 _tubeToken
    ) public {
        tubeID = _tubeID;
        ledger = _ledger;
        lord = _lord;
        tubeToken = _tubeToken;
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

    function numOfValidators() public view returns (uint256) {
        return validators.length;
    }

    function addValidator(address _validator) public onlyOwner whenPaused {
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
        validators[index - 1] = validators[validators.length - 1];
        validators.pop();
        delete validatorIndexes[_validator];
        emit ValidatorRemoved(_validator);
    }

    function setFees(
        uint256 _tubeID,
        uint256 _tubeFee,
        uint256 _relayerFee
    ) public onlyOwner {
        tubeFees[_tubeID] = _tubeFee;
        relayerFees[_tubeID] = _relayerFee;
    }

    function depositTo(
        uint256 _tubeID,
        address _token,
        address _to,
        uint256 _amount
    ) public payable whenNotPaused {
        require(_to != address(0), "invalid recipient");
        require(_amount > 0, "invalid amount");
        uint256 tubeFee = tubeFees[_tubeID];
        uint256 relayerFee = relayerFees[_tubeID];
        require(msg.value >= relayerFee, "insufficient relayer fee");
        if (tubeFee > 0) {
            tubeToken.safeTransferFrom(msg.sender, address(this), tubeFee);
        }
        IToken(_token).burnFrom(msg.sender, _amount);
        uint256 txIdx = counts[tubeID][_token]++;
        emit Receipt(_tubeID, _token, txIdx, msg.sender, _to, _amount, relayerFee, tubeFee);
    }

    function deposit(
        uint256 _tubeID,
        address _token,
        uint256 _amount
    ) public payable {
        depositTo(_tubeID, _token, msg.sender, _amount);
    }

    function genKey(
        uint256 _srcTubeID,
        address _token,
        uint256 _txIdx,
        address _recipient,
        uint256 _amount
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_srcTubeID, tubeID, _token, _txIdx, _recipient, _amount));
    }

    function concatKeys(bytes32[] memory keys) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keys));
    }

    function withdraw(
        uint256 _srcTubeID,
        address _token,
        uint256 _txIdx,
        address _recipient,
        uint256 _amount,
        bytes memory _signatures
    ) public whenNotPaused {
        require(_amount != 0, "amount is 0");
        require(_recipient != address(0), "invalid recipient");
        require(_signatures.length % 65 == 0, "invalid signature length");
        bytes32 key = genKey(_srcTubeID, _token, _txIdx, _recipient, _amount);
        ledger.record(key);
        address[] memory validators = extractValidators(key, _signatures);
        require(validators.length * 3 > validators.length * 2, "insufficient validators");
        lord.mint(_token, _recipient, _amount);
        emit Settled(key, validators);
    }

    function withdrawInBatch(
        uint256[] memory _srcTubeIDs,
        address[] memory _tokens,
        uint256[] memory _txIdxs,
        address[] memory _recipients,
        uint256[] memory _amounts,
        bytes memory _signatures
    ) public whenNotPaused {
        require(_signatures.length % 65 == 0, "invalid signature length");
        require(
            _srcTubeIDs.length == _tokens.length &&
                _tokens.length == _txIdxs.length &&
                _txIdxs.length == _recipients.length &&
                _recipients.length == _amounts.length,
            "invalid parameters"
        );
        bytes32[] memory keys = new bytes32[](_amounts.length);
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] != 0, "amount is 0");
            require(_recipients[i] != address(0), "invalid recipient");
            keys[i] = genKey(_srcTubeIDs[i], _tokens[i], _txIdxs[i], _recipients[i], _amounts[i]);
            ledger.record(keys[i]);
        }
        address[] memory validators = extractValidators(concatKeys(keys), _signatures);
        require(validators.length * 3 > validators.length * 2, "insufficient validators");
        for (uint256 i = 0; i < _amounts.length; i++) {
            lord.mint(_tokens[i], _recipients[i], _amounts[i]);
            emit Settled(keys[i], validators);
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
