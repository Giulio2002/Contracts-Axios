pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TokenMock is ERC20 {
    constructor () public payable ERC20("Test-DAI", "DAI") {
        _mint(msg.sender, uint256(-1));
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function transferInternal(address from, address to, uint256 value) public {
        _transfer(from, to, value);
    }

    function approveInternal(address owner, address spender, uint256 value) public {
        _approve(owner, spender, value);
    }
}