//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC20/utils/SafeERC20.sol";

library Structs {
    struct ReferralLevelsAndPercentsStruct {
        uint32 level;
        uint32 percent;
    }
    struct ReferralFatherData {
        address childReferral;
    }
    struct ReferralFatherDataInternal {
        bool isPresent;
        uint32 level;
        uint256 availableForClaim;
        uint256 totalProfit;
    }
    struct AddNewChildReferralToFather {
        address fatherReferral;
        address childReferral;
    }
    struct UpdateLevelReferralFather {
        address fatherReferral;
        uint32 newLevel;
    }
    struct StorageReferralDeposit{
        address fatherReferral;
        uint32 newLevel;
    }
}

contract Referrals is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token; // tokenstates token.

    uint256 public constant STORAGE_ADD_REFERRAL_DATA = 1;
    uint32 public constant MAX_REFERRAL_PERCENT = 5_000;
    uint256 public constant REFERRAL_MULTIPLIER = 500;

    address public helperAccount;
    address public rootCaller;

    mapping(address => Structs.ReferralFatherDataInternal)
        public fatherReferralMapping;
    mapping(address => Structs.ReferralFatherData[])
        public fatherReferralChildren;
    mapping(address => address) public fatherReferralByChild;
    mapping(uint32 => uint32) public referralLevelsAndPercents;
    mapping(uint32 => bool) internal keyListReferralLevelsAndPercentsExists;
    uint32[] internal keyListReferralLevelsAndPercents;

    // Events
    event StorageReferralDeposit(address indexed fatherReferral, uint32 newLevel);
    event AddNewChildReferralToFather(Structs.AddNewChildReferralToFather[]);
    event UpdateLevelReferralFather(Structs.UpdateLevelReferralFather[]);
    event NewReferralPayout(
        address fatherReferral,
        address childReferral,
        uint256 amount
    );

    event Payout(address to, uint256 amount);
    event PayoutERC20(address tokenAddress, address to, uint256 amount);
    event Credited(address user, uint256 amount);

    modifier onlyOwnerOrHelperAccount() {
        require(
            owner() == _msgSender() || _msgSender() == helperAccount,
            "Ownable: caller is not the owner or helper"
        );
        _;
    }

    modifier onlyOwnerOrProxyRouterAccount() {
        require(
            owner() == _msgSender() || _msgSender() == rootCaller,
            "Ownable: caller is not the owner or proxyRouter"
        );
        _;
    }

    /** @dev Creates a contract.
     */
    constructor(
        IERC20 _token, 
        Structs.ReferralLevelsAndPercentsStruct[]
            memory _referralLevelsAndPercents,
        address _rootCaller,
        address _helperAccount
    ) {
        token = _token;
        _prepareAndUpdateReferralLevelsAndPercents(_referralLevelsAndPercents);
        rootCaller = _rootCaller;
        helperAccount = _helperAccount;
    }

    function storageReferralDeposit() public payable nonReentrant {
        require(
            msg.value >= STORAGE_ADD_REFERRAL_DATA,
            string(
                abi.encodePacked(
                    "Requires minimum deposit of ",
                    Strings.toString(STORAGE_ADD_REFERRAL_DATA)
                )
            )
        );
        address fatherReferral = msg.sender;
        require(
            !fatherReferralMapping[fatherReferral].isPresent,
            "Father Referral already exists"
        );
        fatherReferralMapping[fatherReferral].isPresent = true;
        uint32 smallest = 100000;
        for (uint256 i = 0; i < keyListReferralLevelsAndPercents.length; i++) {
            if (keyListReferralLevelsAndPercents[i] < smallest) {
                smallest = keyListReferralLevelsAndPercents[i];
            }
        }
        uint32 referralLevel = smallest;
        fatherReferralMapping[fatherReferral].level = referralLevel;
        emit StorageReferralDeposit(msg.sender, referralLevel);
    }

    function addNewChildReferralToFather(
        Structs.AddNewChildReferralToFather[] memory _data
    ) public onlyOwnerOrHelperAccount {
        Structs.AddNewChildReferralToFather[] memory _returnData = new Structs.AddNewChildReferralToFather[]( _data.length);
        for (uint256 i = 0; i < _data.length; i++) {
            address childReferral = _data[i].childReferral;
            address fatherReferral = _data[i].fatherReferral;
            require(
                fatherReferralByChild[childReferral] == address(0),
                "Child Referral already exists"
            );
            require(
                fatherReferralMapping[fatherReferral].isPresent,
                "Father Referral does not exists"
            );
            fatherReferralChildren[fatherReferral].push(
                Structs.ReferralFatherData(childReferral)
            );
            fatherReferralByChild[childReferral] = fatherReferral;
            _returnData[i] = Structs.AddNewChildReferralToFather(fatherReferral, childReferral);
        }
        emit AddNewChildReferralToFather(_returnData);
    }

    function updateLevelReferralFather(
        Structs.UpdateLevelReferralFather[] memory _data
    ) public onlyOwnerOrHelperAccount {
        Structs.UpdateLevelReferralFather[] memory _returnData = new Structs.UpdateLevelReferralFather[]( _data.length);
        for (uint256 i = 0; i < _data.length; i++) {
            bool isPresent = false;
            address fatherReferral = _data[i].fatherReferral;
            uint32 newLevel = _data[i].newLevel;
            require(
                fatherReferralMapping[fatherReferral].isPresent,
                "Father referral does not exist"
            );
            for (
                uint256 ii = 0;
                ii < keyListReferralLevelsAndPercents.length;
                ii++
            ) {
                if (keyListReferralLevelsAndPercents[ii] == newLevel) {
                    isPresent = true;
                    break;
                }
            }
            require(isPresent, "Level does not exist");
            fatherReferralMapping[fatherReferral].level = newLevel;
            _returnData[i] = Structs.UpdateLevelReferralFather(fatherReferral, newLevel);
        }
        emit UpdateLevelReferralFather(_returnData);
    }

    function addReferralFatherFee(
        address _childReferral,
        uint256 _amount
    ) public onlyOwnerOrProxyRouterAccount {
        address fatherReferral = fatherReferralByChild[_childReferral];
        require(fatherReferral != address(0), "Father not found");
        token.safeTransfer(fatherReferral, _amount);
        emit NewReferralPayout(
            fatherReferral,
            _childReferral,
            _amount
        );
    }

    function withdraw(uint256 _amount) public onlyOwner {
        uint256 balance = address(this).balance;

        require(_amount <= balance, "amount should be less than balance");

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed.");

        emit Payout(msg.sender, _amount);
    }

    /** @dev withdraws value from contract.
     * @param _tokenAddress *
     * @param _amount *
     */
    function withdrawERC20(address _tokenAddress, uint256 _amount)
        public
        onlyOwner
    {
        IERC20 _token = IERC20(_tokenAddress);
        _token.safeTransfer(msg.sender, _amount);
        emit PayoutERC20(_tokenAddress, msg.sender, _amount);
    }

    function setNewRootCaller(address _newRootCaller) public onlyOwner {
        rootCaller = _newRootCaller;
    }

    function setNewHelperAccount(address _newHelperAccount)
        public
        onlyOwner
    {
        helperAccount = _newHelperAccount;
    }

    function calculateReferralFatherFee(uint256 _amount, address _childReferral)
        public
        view
        returns (uint256)
    {
        address fatherReferral = fatherReferralByChild[_childReferral];
        if (fatherReferral == address(0)) {
            return 0;
        }
        uint32 fatherReferralLevel = fatherReferralMapping[fatherReferral]
            .level;
        uint32 levelPercent = referralLevelsAndPercents[fatherReferralLevel];
        uint256 newAmount = (_amount * levelPercent * REFERRAL_MULTIPLIER) / 1_000_000;
        return newAmount;
    }

    function _prepareAndUpdateReferralLevelsAndPercents(
        Structs.ReferralLevelsAndPercentsStruct[]
            memory _newReferralLevelsAndPercents
    ) internal {
        // Check if percents in new levels not higher fixed
        for (uint256 i = 0; i < _newReferralLevelsAndPercents.length; i++) {
            require(
                _newReferralLevelsAndPercents[i].percent <= MAX_REFERRAL_PERCENT,
                string(
                    abi.encodePacked(
                        "Requires maximum referral percent of ",
                        Strings.toString(MAX_REFERRAL_PERCENT)
                    )
                )
            );
        }
        // Update new referral levels and percents
        for (uint256 i = 0; i < _newReferralLevelsAndPercents.length; i++) {
            referralLevelsAndPercents[
                _newReferralLevelsAndPercents[i].level
            ] = _newReferralLevelsAndPercents[i].percent;
            if (
                !keyListReferralLevelsAndPercentsExists[
                    _newReferralLevelsAndPercents[i].level
                ]
            ) {
                keyListReferralLevelsAndPercentsExists[
                    _newReferralLevelsAndPercents[i].level
                ] = true;
                keyListReferralLevelsAndPercents.push(
                    _newReferralLevelsAndPercents[i].level
                );
            }
        }
    }
    
    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}