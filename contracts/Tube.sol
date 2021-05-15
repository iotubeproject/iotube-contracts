// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Ledger.sol";

interface IToken {
    function mint(address account, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

contract Tube is Ownable, Pausable {
    using SafeERC20 for IERC20;

    event WitnessAdded(address indexed witness);
    event WitnessRemoved(address indexed witness);
    event Settled(bytes32 indexed key, address[] witnesses);

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
    IERC20 public tubeToken;
    address[] public witnesses;
    mapping(address => uint256) private witnessIndexes; 
    mapping(uint256 => mapping(address => uint256)) counts;
    mapping(uint256 => uint256) public relayerFees;
    mapping(uint256 => uint256) public tubeFees;

    constructor(uint256 _tubeID, Ledger _ledger, IERC20 _tubeToken) public {
        tubeID = _tubeID;
        ledger = _ledger;
        tubeToken = _tubeToken;
    }

    function upgrade(address _newTube) public onlyOwner {
        ledger.transferOwnership(_newTube);
        // TODO: transfer minter ownership
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

    function numOfWitnesses() public view returns (uint256) {
        return witnesses.length;
    }

    function addWitness(address _witness) public onlyOwner {
        if (witnessIndexes[_witness] != 0) {
            return;
        }
        witnesses.push(_witness);
        witnessIndexes[_witness] = witnesses.length;
        emit WitnessAdded(_witness);
    }

    function removeWitness(address _witness) public onlyOwner {
        uint256 index = witnessIndexes[_witness];
        if (index == 0) {
            return;
        }
        witnesses[index - 1] = witnesses[witnesses.length - 1];
        witnesses.pop();
        delete witnessIndexes[_witness];
        emit WitnessRemoved(_witness);
    }

    function setFees(uint256 _tubeID, uint256 _tubeFee, uint256 _relayerFee) public onlyOwner {
        tubeFees[_tubeID] = _tubeFee;
        relayerFees[_tubeID] = _relayerFee;
    }

    function depositTo(uint256 _tubeID, address _token, address _to, uint256 _amount) public whenNotPaused payable {
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

    function deposit(uint256 _tubeID, address _token, uint256 _amount) public payable {
        depositTo(_tubeID, _token, msg.sender, _amount);
    }

    function genKey(
        uint256 _srcTubeID,
        address _token,
        uint256 _txIdx,
        address _recipient,
        uint256 _amount
    ) public view returns(bytes32) {
        return keccak256(abi.encodePacked(_srcTubeID, tubeID, _token, _txIdx, _recipient, _amount));
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
        uint256 numOfSignatures = _signatures.length / 65;
        address[] memory ws = new address[](numOfSignatures);
        for (uint256 i = 0; i < numOfSignatures; i++) {
            address witness = recover(key, _signatures, i * 65);
            require(witnessIndexes[witness] != 0, "invalid witness");
            for (uint256 j = 0; j < i; j++) {
                require(witness != ws[j], "duplicate witness");
            }
            ws[i] = witness;
        }
        require(numOfSignatures * 3 > witnesses.length * 2, "insufficient witnesses");
        // TODO: mint with minter
        IToken(_token).mint(_recipient, _amount);
        emit Settled(key, ws);
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

    /**
    * @dev Recover signer address from a message by using their signature
    * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
    * @param signature bytes signature, the signature is generated using web3.eth.sign()
    */
    function recover(bytes32 hash, bytes memory signature, uint256 offset)
        internal
        pure
        returns (address)
    {
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