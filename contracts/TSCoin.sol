//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "./ERC20/extensions/IERC20.sol";
import "./ERC20/extensions/ERC20Burnable.sol";

// abstract contract ERC20 is Context, IERC20, IERC20Metadata {
//     mapping(address => uint256) private _balances;

//     mapping(address => mapping(address => uint256)) private _allowances;

//     uint256 public override totalSupply;

//     string public override name;
//     string public override symbol;
//     uint8 public override decimals;

//     constructor(
//         string memory name_,
//         string memory symbol_,
//         uint8 decimals_
//     ) {
//         name = name_;
//         symbol = symbol_;
//         decimals = decimals_;
//     }

//     function balanceOf(address account)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _balances[account];
//     }

//     function transfer(address to, uint256 amount)
//         public
//         virtual
//         override
//         returns (bool)
//     {
//         address owner = _msgSender();
//         _transfer(owner, to, amount);
//         return true;
//     }

//     function allowance(address owner, address spender)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _allowances[owner][spender];
//     }

//     function approve(address spender, uint256 amount)
//         public
//         virtual
//         override
//         returns (bool)
//     {
//         address owner = _msgSender();
//         _approve(owner, spender, amount);
//         return true;
//     }

//     function transferFrom(
//         address from,
//         address to,
//         uint256 amount
//     ) public virtual override returns (bool) {
//         address spender = _msgSender();
//         _spendAllowance(from, spender, amount);
//         _transfer(from, to, amount);
//         return true;
//     }

//     function increaseAllowance(address spender, uint256 addedValue)
//         public
//         virtual
//         returns (bool)
//     {
//         address owner = _msgSender();
//         _approve(owner, spender, allowance(owner, spender) + addedValue);
//         return true;
//     }

//     function decreaseAllowance(address spender, uint256 subtractedValue)
//         public
//         virtual
//         returns (bool)
//     {
//         address owner = _msgSender();
//         uint256 currentAllowance = allowance(owner, spender);
//         require(
//             currentAllowance >= subtractedValue,
//             "ERC20: decreased allowance below zero"
//         );
//         unchecked {
//             _approve(owner, spender, currentAllowance - subtractedValue);
//         }

//         return true;
//     }

//     function _transfer(
//         address from,
//         address to,
//         uint256 amount
//     ) internal virtual {
//         require(from != address(0), "ERC20: transfer from the zero address");
//         require(to != address(0), "ERC20: transfer to the zero address");

//         _beforeTokenTransfer(from, to, amount);

//         uint256 fromBalance = _balances[from];
//         require(
//             fromBalance >= amount,
//             "ERC20: transfer amount exceeds balance"
//         );
//         unchecked {
//             _balances[from] = fromBalance - amount;
//             // Overflow not possible: the sum of all balances is capped by totalSupply, and the sum is preserved by
//             // decrementing then incrementing.
//             _balances[to] += amount;
//         }

//         emit Transfer(from, to, amount);

//         _afterTokenTransfer(from, to, amount);
//     }

//     function _mint(address account, uint256 amount) internal virtual {
//         require(account != address(0), "ERC20: mint to the zero address");

//         _beforeTokenTransfer(address(0), account, amount);

//         totalSupply += amount;
//         unchecked {
//             // Overflow not possible: balance + amount is at most totalSupply + amount, which is checked above.
//             _balances[account] += amount;
//         }
//         emit Transfer(address(0), account, amount);

//         _afterTokenTransfer(address(0), account, amount);
//     }

//     function _burn(address account, uint256 amount) internal virtual {
//         require(account != address(0), "ERC20: burn from the zero address");

//         _beforeTokenTransfer(account, address(0), amount);

//         uint256 accountBalance = _balances[account];
//         require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
//         unchecked {
//             _balances[account] = accountBalance - amount;
//             // Overflow not possible: amount <= accountBalance <= totalSupply.
//             totalSupply -= amount;
//         }

//         emit Transfer(account, address(0), amount);

//         _afterTokenTransfer(account, address(0), amount);
//     }

//     function _approve(
//         address owner,
//         address spender,
//         uint256 amount
//     ) internal virtual {
//         _beforeTokenTransfer(owner, address(0), amount);
//         require(owner != address(0), "ERC20: approve from the zero address");
//         require(spender != address(0), "ERC20: approve to the zero address");

//         _allowances[owner][spender] = amount;
//         emit Approval(owner, spender, amount);
//     }

//     function _spendAllowance(
//         address owner,
//         address spender,
//         uint256 amount
//     ) internal virtual {
//         uint256 currentAllowance = allowance(owner, spender);
//         if (currentAllowance != type(uint256).max) {
//             require(
//                 currentAllowance >= amount,
//                 "ERC20: insufficient allowance"
//             );
//             unchecked {
//                 _approve(owner, spender, currentAllowance - amount);
//             }
//         }
//     }

//     function _beforeTokenTransfer(
//         address from,
//         address to,
//         uint256 amount
//     ) internal virtual {}

//     function _afterTokenTransfer(
//         address from,
//         address to,
//         uint256 amount
//     ) internal virtual {}
// }

// abstract contract ERC20Burnable is Context, ERC20 {
//     function burn(uint256 amount) public virtual {
//         _burn(_msgSender(), amount);
//     }

//     function burnFrom(address account, uint256 amount) public virtual {
//         _spendAllowance(account, _msgSender(), amount);
//         _burn(account, amount);
//     }
// }

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
     * @dev Checks if token either not paused or reciever and msgSender equals to approved addresses
     **/
    modifier whenNotPausedForTokenActions(address _reciever) {
        require(
            !paused ||
                _msgSender() == owner() ||
                approvedAddresses[_reciever].canCall ||
                approvedAddresses[_msgSender()].canCall
        );
        _;
    }

    modifier onlyOwnerOrApprovedAccount() {
        require(
            owner() == _msgSender() || approvedAddresses[_msgSender()].canUnpause,
            "Ownable: caller is not the owner or approved"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused || msg.sender == owner());
        _;
    }

    modifier whenPaused() {
        require(paused);
        _;
    }

    function pause() public onlyOwner whenNotPaused {
        require(canPause == true);
        paused = true;
        emit Pause();
    }

    function unpause() public onlyOwner whenPaused {
        require(paused == true);
        paused = false;
        emit Unpause();
    }

    function notPausable() public onlyOwnerOrApprovedAccount {
        paused = false;
        canPause = false;
        emit NotPausable();
    }
}

abstract contract ERC20PausableAndBurnable is ERC20Burnable, Pausable {
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPausedForTokenActions(address(0)) {
        super._beforeTokenTransfer(from, to, amount);
    }
}

abstract contract ApproveAndCallFallBack {
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata extraData
    ) external virtual;
}

contract TSCoin is ERC20PausableAndBurnable {
    constructor(
        address _recipient,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        address _initApproval
    ) ERC20(_name, _symbol, _decimals) {
        require(_initApproval != address(0));
        _mint(_recipient, _initialSupply * 10**_decimals);
        approvedAddresses[_initApproval] = ApprovedAddresses(true, true);
    }

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

    function addInitApproval(address _initApproval, bool _canUnpause) public onlyOwner {
        require(_initApproval != address(0));
        approvedAddresses[_initApproval] = ApprovedAddresses(true, _canUnpause);
    }

    function removeInitApproval(address _initApproval) public onlyOwner {
        require(_initApproval != address(0));
        approvedAddresses[_initApproval] = ApprovedAddresses(false, false);
    }
}
