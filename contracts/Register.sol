// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

contract Register {
    struct File {
        address witness;
        uint256 genre;
        string uri;
    }
    mapping(address => File) public files;

    function register(uint256 genre, string calldata uri) public {
        files[msg.sender] = File(msg.sender, genre, uri);
    }

    function getFile(address witness) public view returns (uint256, string memory) {
        File storage r = files[witness];
        return (r.genre, r.uri);
    }
}
