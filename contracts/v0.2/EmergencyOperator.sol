pragma solidity ^0.8.0;

abstract contract EmergencyOperator {
    address private emergencyOperator;

    event EmergencyOperatorSet(address indexed operator);

    modifier onlyEmergencyOperator() {
        require(emergencyOperator == msg.sender, "caller is not emergency operator");
        _;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _setEmergencyOperator(address _newOperator) internal virtual {
        emergencyOperator = _newOperator;
        emit EmergencyOperatorSet(_newOperator);
    }
}
