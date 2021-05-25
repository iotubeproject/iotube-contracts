// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

contract ValidatorRegistry {
    struct File {
        address validator;
        uint256 genre;
        string uri;
    }
    mapping(address => File) public files;

    function register(uint256 genre, string calldata uri) public {
        files[msg.sender] = File(msg.sender, genre, uri);
    }

    function getFile(address _validator) public view returns (uint256, string memory) {
        File storage r = files[_validator];
        return (r.genre, r.uri);
    }
}
