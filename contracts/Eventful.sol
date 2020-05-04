pragma solidity >=0.4.21 <0.7.0;

interface Eventful {

    event Updated(
        bytes32  indexed  id
    );

    event ParamChange(
        bytes32 indexed param,
        uint256 indexed value
    );
}