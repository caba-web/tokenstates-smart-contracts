//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC20/extensions/ERC20Burnable.sol";

abstract contract Pausable is Ownable {
    event Pause();
    event Unpause();
    event NotPausable();

    struct ApprovedAddresses {
        bool canCall;
        bool canUnpause;
    }

    bool public paused = true;
    bool public canPause = true;
    mapping(address => ApprovedAddresses) public approvedAddresses;

    /**
     * @dev Checks if token either not paused or either reciever or msgSender equals to approved addresses
     **/
    modifier whenNotPausedForTokenActions(address _reciever) {
        require(
            !paused ||
                _msgSender() == owner() ||
                approvedAddresses[_reciever].canCall ||
                approvedAddresses[_msgSender()].canCall,
            "Ownable: caller is not the owner or approved"
        );
        _;
    }

    /**
     * @dev Checks if function is called only by approved
     **/
    modifier onlyOwnerOrApprovedAccount() {
        require(
            owner() == _msgSender() ||
                approvedAddresses[_msgSender()].canUnpause,
            "Ownable: caller is not the owner or approved"
        );
        _;
    }

    /**
     * @dev Checks if token is not paused
     **/
    modifier whenNotPaused() {
        require(!paused || msg.sender == owner());
        _;
    }

    /**
     * @dev Checks if token is paused
     **/
    modifier whenPaused() {
        require(paused);
        _;
    }

    /**
     * @dev Pauses all token activity except from approved
     **/
    function pause() public onlyOwner whenNotPaused {
        require(canPause == true);
        paused = true;
        emit Pause();
    }

    /**
     * @dev Unpauses any token activity
     **/
    function unpause() public onlyOwner whenPaused {
        require(paused == true);
        paused = false;
        emit Unpause();
    }

    /**
     * @dev Updates token to not pausable anymore
     **/
    function notPausable() public onlyOwnerOrApprovedAccount {
        paused = false;
        canPause = false;
        emit NotPausable();
    }
}

abstract contract ERC20PausableAndBurnable is ERC20Burnable, Pausable {
    /**
     * @dev Checks if token is not paused before transfer, mint, burn. Excepts approved
     **/
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPausedForTokenActions(to) {
        super._beforeTokenTransfer(from, to, amount);
    }
}

interface ApproveAndCallFallBack {
    function onTokenApproval(
        address from,
        uint256 amount,
        bytes calldata extraData
    ) external;
}

contract TSCoin is ERC20PausableAndBurnable {
    //Events
    event AddInitApproval(address user, bool canUnpause);
    event RemoveInitApproval(address user);

    uint256 public initTotalSupply;

    /**
     * @dev Initialize contract
     **/
    constructor(
        address _recipient,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        address _initApproval
    ) ERC20(_name, _symbol, _decimals) {
        require(_initApproval != address(0));
        _mint(_recipient, _initialSupply * 10 ** _decimals);
        initTotalSupply = _initialSupply * 10 ** _decimals;
        approvedAddresses[_initApproval] = ApprovedAddresses(true, true);
    }

    /**
     * @dev Approves amount of tokens and calls external functions
     **/
    function approveAndCall(
        address _to,
        uint256 _amount,
        bytes memory extraData
    ) public returns (bool) {
        require(approve(_to, _amount));

        if (isContract(_to)) {
            ApproveAndCallFallBack(_to).onTokenApproval(
                msg.sender,
                _amount,
                extraData
            );
        }

        return true;
    }

    /**
     * @dev Adds approved accounts. Only owner route
     **/
    function addInitApproval(address _initApproval, bool _canUnpause)
        public
        onlyOwner
    {
        require(_initApproval != address(0));
        approvedAddresses[_initApproval] = ApprovedAddresses(true, _canUnpause);
        emit AddInitApproval(_initApproval, _canUnpause);
    }

    /**
     * @dev Removes approved accounts. Only owner route
     **/
    function removeInitApproval(address _initApproval) public onlyOwner {
        require(_initApproval != address(0));
        approvedAddresses[_initApproval] = ApprovedAddresses(false, false);
        emit RemoveInitApproval(_initApproval);
    }

    function isContract(address _addr) private view returns (bool hasCode) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }
}
