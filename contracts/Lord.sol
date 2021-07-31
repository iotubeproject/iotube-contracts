// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMintableToken {
    function mint(address, uint256) external returns (bool);
}

interface IAllowlist {
    function isAllowed(address) external view returns (bool);
}

contract Lord is Ownable {
    event HostedLordAdded(address tokenList, address lord);
    event HostedLordRemoved(address tokenList, address lord);

    Lord[] public hostedLords;
    IAllowlist[] public tokenLists;

    function addHostedLord(IAllowlist _tokenList, Lord _lord) public onlyOwner {
        for (uint256 i = 0; i < tokenLists.length; i++) {
            require(_tokenList != tokenLists[i], "dup token list");
        }
        hostedLords.push(_lord);
        tokenLists.push(_tokenList);
        emit HostedLordAdded(address(_tokenList), address(_lord));
    }

    function removeMinter(IAllowlist _tokenList) public onlyOwner {
        uint256 len = tokenLists.length;
        for (uint256 i = 0; i < len; i++) {
            if (_tokenList == tokenLists[i]) {
                tokenLists[i] = tokenLists[len - 1];
                tokenLists.pop();
                Lord lord = hostedLords[i];
                hostedLords[i] = hostedLords[len - 1];
                hostedLords.pop();
                if (lord.owner() == address(this)) {
                    lord.transferOwnership(msg.sender);
                }
                emit HostedLordRemoved(address(_tokenList), address(lord));
            }
        }
    }

    function mint(
        address _token,
        address _recipient,
        uint256 _amount
    ) public onlyOwner returns (bool) {
        for (uint256 i = 0; i < tokenLists.length; i++) {
            if (tokenLists[i].isAllowed(_token)) {
                require(hostedLords[i].mint(_token, _recipient, _amount), "hosted lord failed to mint");
                return true;
            }
        }
        (bool success, bytes memory retval) =
            _token.call(abi.encodeWithSelector(IMintableToken(_token).mint.selector, _recipient, _amount));
        require(success, "low-level mint call failed");
        if (retval.length > 0) {
            // solhint-disable-next-line max-line-length
            require(abi.decode(retval, (bool)), "mint operation did not succeed");
        }
        return true;
    }
}
