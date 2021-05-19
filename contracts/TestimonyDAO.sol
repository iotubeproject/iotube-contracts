// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

contract TestimonyDAO {
    event Testimony(address indexed, bytes32 indexed, bytes);

    // mapping(address => mapping(bytes32 => bytes)) public testimonies;

    function addTestimony(bytes32 key, bytes calldata value) public {
        // require(testimonies[msg.sender][key].length == 0, "testimony exists");
        // testimonies[msg.sender][key] = value;
        emit Testimony(msg.sender, key, value);
    }

    // function getTestimony(address witness, bytes32 key) public view returns (bytes memory) {
    //     return testimonies[msg.sender][key];
    // }
}
