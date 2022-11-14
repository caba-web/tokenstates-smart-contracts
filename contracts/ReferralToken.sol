//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC20/extensions/ERC20Burnable.sol";

abstract contract ApproveAndCallFallBack {
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata extraData
    ) external virtual;
}

contract ReferralToken is ERC20Burnable, Ownable {

    /**
     * @dev Initialize contract
     **/
    constructor(
        address _recipient,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) ERC20(_name, _symbol, _decimals) {
        _mint(_recipient, _initialSupply * 10 ** _decimals);
    }

    /**
     * @dev Approves amount of tokens and calls external functions
     **/
    function approveAndCall(
        address spender,
        uint256 amount,
        bytes memory extraData
    ) public returns (bool) {
        require(approve(spender, amount));

        ApproveAndCallFallBack(spender).receiveApproval(
            msg.sender,
            amount,
            address(this),
            extraData
        );

        return true;
    }

    function mint(address to, uint amount) public onlyOwner {
        _mint(to, amount);
    }
}
