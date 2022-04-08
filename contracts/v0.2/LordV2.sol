// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20Mintable {
    function mint(address recipient, uint256 amount) external;
}

contract LordV2 is Ownable {
    event MinterAdded(address indexed minter, uint256 effectiveBlock);
    event MinterRemoved(address indexed minter);

    mapping(address => uint256) public minters;
    mapping(bytes32 => uint256) public records;

    uint256 immutable public waitingBlocks;

    constructor(uint256 _waitingBlocks) {
        waitingBlocks = _waitingBlocks;
    }

    function addMinter(address _minter) public onlyOwner {
        if (minters[_minter] == 0) {
            minters[_minter] = block.number + waitingBlocks;
            emit MinterAdded(_minter, block.number + waitingBlocks);
        }
    }

    function removeMinter(address _minter) public onlyOwner {
        if (minters[_minter] > 0) {
            minters[_minter] = 0;
            emit MinterRemoved(_minter);
        }
    }

    function mint(
        IERC20Mintable _token,
        address _recipient,
        uint256 _amount
    ) public {
        require(minters[msg.sender] >= block.number, "invalid minter");
        _token.mint(_recipient, _amount);
    }
}
