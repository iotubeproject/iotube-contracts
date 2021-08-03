// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IToken {
    function mint(address, uint256) external;
    function burn(address) external;
    function burnFrom(address, uint256) external;
    function transferFrom(address, address, uint256) external;
}

interface IERC721Mintable {
    function safeMint(address, uint256, bytes memory) external;
    function mint(address, uint256) external;
    function burn(uint256) external;
}

interface IAllowlist {
    function isAllowed(address) external view returns (bool);
}

interface IMinter {
    function mint(address, address, uint256) external returns (bool);
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
}

contract Lord is Ownable {
    using Address for address;

    IAllowlist public standardTokenList;
    IMinter public tokenSafe;
    IAllowlist public proxyTokenList;
    IMinter public minterPool;

    constructor(
        IAllowlist _standardTokenList,
        IMinter _tokenSafe,
        IAllowlist _proxyTokenList,
        IMinter _minterPool
    ) public {
        standardTokenList = _standardTokenList;
        tokenSafe = _tokenSafe;
        proxyTokenList = _proxyTokenList;
        minterPool = _minterPool;
    }

    function burn(address _token, address _sender, uint256 _amount) public onlyOwner {
        if (address(standardTokenList) != address(0)) {
            if (standardTokenList.isAllowed(_token)) {
                // transfer token to standardTokenList
                _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).transferFrom.selector, _sender, tokenSafe, _amount));
                return;
            }
        }
        if (address(proxyTokenList) != address(0)) {
            if (proxyTokenList.isAllowed(_token)) {
                _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).transferFrom.selector, _sender, address(this), _amount));
                _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).burn.selector, _amount));
                return;
            }
        }
        _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).burnFrom.selector, _sender, _amount));
    }

    function mint(
        address _token,
        address _recipient,
        uint256 _amount
    ) public onlyOwner {
        if (standardTokenList.isAllowed(_token)) {
            require(tokenSafe.mint(_token, _recipient, _amount), "token safe mint failed");
            return;
        }
        if (proxyTokenList.isAllowed(_token)) {
            require(minterPool.mint(_token, _recipient, _amount), "proxy token mint failed");
        }
        _callOptionalReturn(_token, abi.encodeWithSelector(IToken(_token).mint.selector, _recipient, _amount));
    }

    function mintNFT(
        address _token,
        uint256 _tokenID,
        address _recipient,
        bytes memory _data
    ) public onlyOwner {
        IERC721Mintable(_token).safeMint(_recipient, _tokenID, _data);
    }

    function upgrade(address _newLord) public onlyOwner {
        if (minterPool.owner() == address(this)) {
            _callOptionalReturn(address(tokenSafe), abi.encodeWithSelector(minterPool.transferOwnership.selector, _newLord));
        }
        if (tokenSafe.owner() == address(this)) {
            _callOptionalReturn(address(tokenSafe), abi.encodeWithSelector(tokenSafe.transferOwnership.selector, _newLord));
        }
    }

    function _callOptionalReturn(address addr, bytes memory data) private {
        bytes memory returndata = addr.functionCall(data, "SafeERC20: low-level call failed");
        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}
