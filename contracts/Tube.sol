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

interface IVerifier {
    function verify(bytes32 _key, bytes memory _signatures)
        external
        view
        returns (bool isValid_, address[] memory validators_);
}

contract Tube is Ownable, Pausable {
    using SafeERC20 for IERC20;

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

    event NFTReceipt(
        uint256 indexed tubeID,
        address indexed token,
        uint256 indexed tokenID,
        uint256 txIdx,
        address sender,
        address recipient,
        bytes data,
        uint256 fee
    );

    uint256 public tubeID;
    Ledger public ledger;
    Lord public lord;
    IVerifier public verifier;
    IERC20 public tubeToken;
    address public safe;
    mapping(uint256 => mapping(address => uint256)) public counts;
    mapping(uint256 => uint256) public fees;

    constructor(
        uint256 _tubeID,
        Ledger _ledger,
        Lord _lord,
        IVerifier _verifier,
        IERC20 _tubeToken,
        address _safe
    ) public {
        tubeID = _tubeID;
        ledger = _ledger;
        lord = _lord;
        verifier = _verifier;
        tubeToken = _tubeToken;
        safe = _safe;
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
            tubeToken.safeTransferFrom(msg.sender, safe, fee);
        }
        // TODO: let lord handle it
        IToken(_token).burnFrom(msg.sender, _amount);
        uint256 txIdx = ++counts[_tubeID][_token];
        emit Receipt(_tubeID, _token, txIdx, msg.sender, _to, _amount, _data, fee);
    }

    function depositNFTTo(
        uint256 _tubeID,
        address _token,
        uint256 _tokenID,
        address _to,
        bytes memory _data
    ) public whenNotPaused {
        require(_to != address(0), "invalid recipient");
        uint256 fee = fees[_tubeID];
        if (fee > 0) {
            tubeToken.safeTransferFrom(msg.sender, safe, fee);
        }
        // TODO: send token to lord
        uint256 txIdx = ++counts[_tubeID][_token];
        emit NFTReceipt(_tubeID, _token, _tokenID, txIdx, msg.sender, _to, _data, fee);
    }

    function deposit(
        uint256 _tubeID,
        address _token,
        uint256 _amount,
        bytes memory _data
    ) public {
        depositTo(_tubeID, _token, msg.sender, _amount, _data);
    }

    function depositNFT(
        uint256 _tubeID,
        address _token,
        uint256 _tokenID,
        bytes memory _data
    ) public {
        depositNFTTo(_tubeID, _token, _tokenID, msg.sender, _data);
    }

    function genKey(
        uint256 _srcTubeID,
        uint256 _txIdx,
        address _token,
        address _recipient,
        uint256 _amount,
        bytes memory _data
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_srcTubeID, _txIdx, tubeID, _token, _recipient, _amount, _data));
    }

    function concatKeys(bytes32[] memory keys) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keys));
    }

    function isSettled(bytes32 key) public view returns (bool) {
        return ledger.get(key) != 0;
    }

    function withdraw(
        uint256 _srcTubeID,
        uint256 _txIdx,
        address _token,
        address _recipient,
        uint256 _amount,
        bytes memory _data,
        bytes memory _signatures
    ) public whenNotPaused {
        require(_amount != 0, "amount is 0");
        require(_recipient != address(0), "invalid recipient");
        require(_signatures.length % 65 == 0, "invalid signature length");
        bytes32 key = genKey(_srcTubeID, _txIdx, _token, _recipient, _amount, _data);
        ledger.record(key);
        (bool isValid, address[] memory signers) = verifier.verify(key, _signatures);
        require(isValid, "insufficient validators");
        bool success = true;
        if (_data.length > 0) {
            lord.mint(_token, address(this), _amount);
            IERC20(_token).safeApprove(_recipient, _amount);
            (success, ) = _recipient.call(_data);
            if (!success) {
                IERC20(_token).safeDecreaseAllowance(_recipient, _amount);
            }
        } else {
            lord.mint(_token, _recipient, _amount);
        }
        emit Settled(key, signers, success);
    }

    function withdrawInBatch(
        uint256[] memory _srcTubeIDs,
        uint256[] memory _txIdxs,
        address[] memory _tokens,
        address[] memory _recipients,
        uint256[] memory _amounts,
        bytes memory _signatures
    ) public whenNotPaused {
        uint256 cnt = _amounts.length;
        require(cnt > 0, "invalid array length");
        require(_signatures.length % 65 == 0, "invalid signature length");
        require(
            _srcTubeIDs.length == cnt && _txIdxs.length == cnt && _tokens.length == cnt && _recipients.length == cnt,
            "invalid parameters"
        );

        bytes32[] memory keys = new bytes32[](cnt);
        for (uint256 i = 0; i < cnt; i++) {
            require(_amounts[i] != 0, "amount is 0");
            require(_recipients[i] != address(0), "invalid recipient");
            keys[i] = genKey(_srcTubeIDs[i], _txIdxs[i], _tokens[i], _recipients[i], _amounts[i], "");
            ledger.record(keys[i]);
        }
        (bool isValid, address[] memory signers) = verifier.verify(concatKeys(keys), _signatures);
        require(isValid, "insufficient validators");
        for (uint256 i = 0; i < cnt; i++) {
            lord.mint(_tokens[i], _recipients[i], _amounts[i]);
            emit Settled(keys[i], signers, true);
        }
    }

    function withdrawCoin(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    function withdrawToken(address _to, IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        if (balance > 0) {
            _token.safeTransfer(_to, balance);
        }
    }
}
