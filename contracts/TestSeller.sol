//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC20/utils/SafeERC20.sol";


contract TestSeller is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token; // test token.
    address public tokenAddress;

    // Events
    event Receive(address indexed user, uint256 amount);

    event Credited(address from, uint256 amount);

    /** @dev Initializes contract
     */
    constructor(address _token) {
        token = IERC20(_token);
        tokenAddress = _token;
    }

    /** @dev Receive tokens
     * @param _amount amount of test.
     */
    function receiveTest(uint256 _amount)
        public
        nonReentrant
    {
        token.safeTransferFrom(msg.sender, address(this), _amount);

        emit Receive(msg.sender, _amount);
    }

    function onTokenApproval(
        address _from,
        uint256 _amount,
        bytes calldata _extraData
    ) public nonReentrant {
        require(msg.sender == tokenAddress);
        require(_extraData.length == 32);

        IERC20(msg.sender).safeTransferFrom(_from, address(this), _amount);

        uint64 _functionId = abi.decode(_extraData, (uint64));

        if (_functionId == 1) {
            emit Receive(_from, _amount);
            return;
        }

        emit Credited(_from, _amount);
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
