// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

contract TestimonyDAO {
    event Testimony(address indexed validator, bytes32 indexed key, bytes testimony);

    // mapping(address => mapping(bytes32 => bytes)) public testimonies;

    function addTestimony(bytes32 key, bytes calldata value) public {
        // require(testimonies[msg.sender][key].length == 0, "testimony exists");
        // testimonies[msg.sender][key] = value;
        emit Testimony(msg.sender, key, value);
    }

    // function getTestimony(address validator, bytes32 key) public view returns (bytes memory) {
    //     return testimonies[msg.sender][key];
    // }
}
