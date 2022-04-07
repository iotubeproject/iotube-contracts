// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ILedger {
    function owner() external view returns (address);
    function transferOwnership(address _newOwner) external;
    function acceptOwnership() external;
    function get(bytes32 _key) external view returns (uint256);
    function record(bytes32 _key) external;
}

interface ILord {
    function owner() external view returns (address);
    function transferOwnership(address _newOwner) external;
    function acceptOwnership() external;
    function burn(address _token, address _owner, uint256 _amount) external;
    function mint(address _token, address _recipient, uint256 _amount) external;
}

interface IBurnableERC20 {
    function burnFrom(address _owner, uint256 _amount) external;
}

interface IVerifier {
    function verify(bytes32 _key, bytes memory _signatures)
        external
        view
        returns (bool isValid_, address[] memory validators_);
}

contract ERC20Tube is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event FeeUpdated(uint256 tubeID, uint256 fee);
    event TaxRateUpdated(uint256 rate);
    event Settled(bytes32 indexed key, address[] validators);
    event Receipt(
        uint256 indexed nonce,
        address sender,
        address indexed token,
        uint256 amount,
        uint256 indexed targetTubeID,
        address recipient,
        uint256 fee
    );

    uint256 public tubeID;
    ILedger public ledger;
    ILord public lord;
    IVerifier public verifier;
    IERC20 public tubeToken;
    address public safe;
    uint256 public nonce;
    uint256 public taxRate;
    mapping(uint256 => uint256) public fees;

    constructor(
        uint256 _tubeID,
        ILedger _ledger,
        ILord _lord,
        IVerifier _verifier,
        IERC20 _tubeToken,
        address _safe,
        uint256 _initNonce
    ) ReentrancyGuard() {
        tubeID = _tubeID;
        ledger = _ledger;
        lord = _lord;
        verifier = _verifier;
        tubeToken = _tubeToken;
        safe = _safe;
        nonce = _initNonce;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setFee(uint256 _tubeID, uint256 _fee) public whenPaused onlyOwner {
        fees[_tubeID] = _fee;
        emit FeeUpdated(_tubeID, _fee);
    }

    function setTaxRate(uint16 _taxRate) public whenPaused onlyOwner {
        require(_taxRate <= 10000, "invalid tax rate");
        taxRate = _taxRate;
        emit TaxRateUpdated(_taxRate);
    }

    function depositTo(
        address _token,
        uint256 _amount,
        uint256 _targetTubeID,
        address _to
    ) public nonReentrant whenNotPaused {
        require(_to != address(0), "invalid recipient");
        require(_amount > 0, "invalid amount");
        // TODO: a whitelist of token?
        uint256 fee = fees[_targetTubeID];
        if (fee > 0) {
            tubeToken.safeTransferFrom(msg.sender, safe, fee);
        }
        if (taxRate > 0) {
            _amount -= _amount * taxRate / 10000;
        }
        IBurnableERC20(_token).burnFrom(msg.sender, _amount);
        emit Receipt(nonce++, msg.sender, _token, _amount, _targetTubeID, _to, fee);
    }

    function deposit(
        address _token,
        uint256 _amount,
        uint256 _targetTubeID
    ) public {
        depositTo(_token, _amount, _targetTubeID, msg.sender);
    }

    function genKey(
        uint256 _srcTubeID,
        uint256 _nonce,
        address _token,
        address _recipient,
        uint256 _amount
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_srcTubeID, _nonce, tubeID, _token, _recipient, _amount));
    }

    function concatKeys(bytes32[] memory keys) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keys));
    }

    function isSettled(bytes32 key) public view returns (bool) {
        return ledger.get(key) != 0;
    }

    function withdraw(
        uint256 _srcTubeID,
        uint256 _nonce,
        address _token,
        address _recipient,
        uint256 _amount,
        bytes memory _signatures
    ) public nonReentrant whenNotPaused {
        require(_amount != 0, "amount is 0");
        require(_recipient != address(0), "invalid recipient");
        require(_signatures.length % 65 == 0, "invalid signature length");
        bytes32 key = genKey(_srcTubeID, _nonce, _token, _recipient, _amount);
        ledger.record(key);
        (bool isValid, address[] memory signers) = verifier.verify(key, _signatures);
        require(isValid, "insufficient validators");
        lord.mint(_token, _recipient, _amount);
        emit Settled(key, signers);
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
