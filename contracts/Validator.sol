// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Validator is Ownable {
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    address[] public validators;
    mapping(address => uint256) private validatorIndexes;

    function size() public view returns (uint256) {
        return validators.length;
    }

    function get(uint256 offset, uint8 limit)
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

    function add(address _validator) public onlyOwner {
        require(_validator != address(0), "invalid validator");
        if (validatorIndexes[_validator] != 0) {
            return;
        }
        validators.push(_validator);
        validatorIndexes[_validator] = validators.length;
        emit ValidatorAdded(_validator);
    }

    function remove(address _validator) public onlyOwner {
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

    function validate(bytes32 _key, bytes memory _signatures)
        public
        view
        returns (bool isValid_, address[] memory validators_)
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
        isValid_ = validators_.length * 3 > validators.length * 2;
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