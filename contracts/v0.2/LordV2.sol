// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "../Owned.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IToken {
    function mint(address recipient, uint256 amount) external;

    function burn(uint256 amount) external;

    function burnFrom(address owner, uint256 amount) external;

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
}

interface IAllowlist {
    function isAllowed(address) external view returns (bool);
}

interface IMinter {
    function mint(
        address _token,
        address _recipient,
        uint256 _amount
    ) external returns (bool);

    function transferOwnership(address newOwner) external;

    function owner() external view returns (address);
}

contract LordV2 is Owned {
    using Address for address;

    IAllowlist public proxyTokenList;
    IMinter public minterPool;

    constructor(
        IAllowlist _proxyTokenList,
        IMinter _minterPool
    ) public {
        proxyTokenList = _proxyTokenList;
        minterPool = _minterPool;
    }

    function burn(
        address _token,
        address _sender,
        uint256 _amount
    ) public onlyOwner {
        if (address(proxyTokenList) != address(0) && proxyTokenList.isAllowed(_token)) {
            _callOptionalReturn(
                _token,
                abi.encodeWithSelector(IToken(_token).transferFrom.selector, _sender, address(this), _amount)
            );
            _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).burn.selector, _amount));
            return;
        }
        _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).burnFrom.selector, _sender, _amount));
    }

    function mint(
        address _token,
        address _recipient,
        uint256 _amount
    ) public onlyOwner {
        if (address(proxyTokenList) != address(0) && proxyTokenList.isAllowed(_token)) {
            require(minterPool.mint(_token, _recipient, _amount), "proxy token mint failed");
        }
        _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).mint.selector, _recipient, _amount));
    }

    function upgrade(address _newLord) public onlyOwner {
        if (minterPool.owner() == address(this)) {
            _callOptionalReturn(
                address(minterPool),
                abi.encodeWithSelector(minterPool.transferOwnership.selector, _newLord)
            );
        }
    }

    function _callOptionalReturn(address addr, bytes memory data) private {
        bytes memory returndata = addr.functionCall(data, "low-level call failed");
        if (returndata.length > 0) {
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "operation did not succeed");
        }
    }
}
