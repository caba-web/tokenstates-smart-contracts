//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

library Structs {
    struct ReferralLevelsAndPercentsStruct {
        uint32 level;
        uint32 percent;
    }
    struct ReferralChildData {
        address fatherReferral;
    }
    struct ReferralFatherData {
        address childReferral;
    }
    struct ReferralFatherDataInternal {
        bool isPresent;
        uint32 level;
        uint256 profit;
        uint256 earned;
        uint32 percentForAdmin;
    }
        struct AddNewChildReferralToFather {
        address childReferral;
        address fatherReferral;
    }
    struct UpdateLevelReferralFather {
        address fatherReferral;
        uint32 newLevel;
    }
}

contract ReferralsUpgradable is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    uint256 public constant STORAGE_ADD_REFERRAL_DATA = 1;
    uint32 public constant MAX_REFRRAL_PERCENT = 5_000;
    address public helperAccount;
    address public rootCaller;

    mapping(address => Structs.ReferralFatherDataInternal)
        public fatherReferralMapping;
    mapping(address => Structs.ReferralFatherData[]) public fatherReferralChildren;
    mapping(address => address) public fatherReferralByChild;
    mapping(uint32 => uint32) public referralLevelsAndPercents; 
    mapping(uint32 => bool) internal keyListReferralLevelsAndPercentsExists;
    uint32[] internal keyListReferralLevelsAndPercents;

    // Events
    event StorageReferralDeposit(address fatherReferral, uint32 newLevel);
    event AddNewChildReferralToFather(
        address fatherReferral,
        address childReferral
    );
    event UpdateLevelReferralFather(address fatherReferral, uint32 newLevel);
    event UpdatePercentReferralAdmin(address fatherReferral, uint32 newPercent);
    event NewReferralPayout(
        address fatherReferral,
        address childReferral,
        uint256 sentAmount,
        uint256 amount,
        uint256 indexed txIdentifier
    );
    event Payout(address to, uint256 amount);
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
    function initialize(
        Structs.ReferralLevelsAndPercentsStruct[]
            memory _referralLevelsAndPercents,
        address _rootCaller,
        address _helperAccount
    ) public payable initializer {
        prepareAndUpdateReferralLevelsAndPercents(
            _referralLevelsAndPercents
        );
        __Ownable_init();
        __ReentrancyGuard_init();
        rootCaller = _rootCaller;
        helperAccount = _helperAccount;
    }

    ///@dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function storageReferralDeposit() public payable nonReentrant {
        require(
            msg.value >= STORAGE_ADD_REFERRAL_DATA,
            string(
                abi.encodePacked(
                    "Requires minimum deposit of ",
                    StringsUpgradeable.toString(STORAGE_ADD_REFERRAL_DATA)
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
    ) public payable onlyOwnerOrHelperAccount {
        assertOneYocto();
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
            emit AddNewChildReferralToFather(
                fatherReferral,
                childReferral
            );
        }
    }

    function storageReferralDepositAdmin(address[] memory _data)
        public
        payable
        onlyOwnerOrHelperAccount
    {
        assertOneYocto();
        for (uint256 i = 0; i < _data.length; i++) {
            address fatherReferral = _data[i];
            require(
                !fatherReferralMapping[fatherReferral].isPresent,
                "Father Referral already exists"
            );
            fatherReferralMapping[fatherReferral].isPresent = true;
            uint32 smallest = 100000;
            for (
                uint256 ii = 0;
                ii < keyListReferralLevelsAndPercents.length;
                ii++
            ) {
                if (keyListReferralLevelsAndPercents[ii] < smallest) {
                    smallest = keyListReferralLevelsAndPercents[ii];
                }
            }
            uint32 referralLevel = smallest;
            fatherReferralMapping[fatherReferral].level = referralLevel;
            emit StorageReferralDeposit(fatherReferral, referralLevel);
        }
    }

    function updateLevelReferralFather(
        Structs.UpdateLevelReferralFather[] memory _data
    ) public payable onlyOwnerOrHelperAccount {
        assertOneYocto();
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
            emit UpdateLevelReferralFather(fatherReferral, newLevel);
        }
    }

    function updatePercentReferralAdmin(
        address fatherReferral,
        uint32 newPercent
    ) public payable onlyOwnerOrHelperAccount {
        assertOneYocto();
        require(
            newPercent <= 10_000,
            "Percent could not be higher than 10_000"
        );
        require(
            fatherReferralMapping[fatherReferral].isPresent,
            "Father referral does not exist"
        );
        fatherReferralMapping[fatherReferral].percentForAdmin = newPercent;
        emit UpdatePercentReferralAdmin(fatherReferral, newPercent);
    }

    function addCalculatedFatherFee(address _childReferral, uint256 _amount, uint256 _txIdentifier)
        public
        payable
        onlyOwnerOrProxyRouterAccount
    {
        address fatherReferral = fatherReferralByChild[_childReferral];
        require(fatherReferral != address(0), "Father not found");
        fatherReferralMapping[fatherReferral].profit += msg.value;
        fatherReferralMapping[fatherReferral].earned += msg.value;
        emit NewReferralPayout(fatherReferral, _childReferral, _amount, msg.value, _txIdentifier);
    }

    function withdrawReferralFather(uint256 _amount) public payable nonReentrant {
        uint256 _newAmount = fatherReferralMapping[msg.sender].profit;
        (bool _bool, ) = SafeMathUpgradeable.trySub(_newAmount, _amount);
        require(_bool, "Amount to withdraw is bigger than account balance");
        fatherReferralMapping[msg.sender].profit -= _amount;
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
        emit Payout(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) public payable onlyOwner {
        uint256 balance = address(this).balance;

        require(_amount <= balance, "amount should be less than balance");

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed.");

        emit Payout(msg.sender, _amount);
    }

    function setNewRootCaller(address _newRootCaller)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        rootCaller = _newRootCaller;
    }

    function setNewHelperAccount(address _newHelperAccount)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        helperAccount = _newHelperAccount;
    }

    function calculateReferralFatherFee(
        uint256 _amount,
        address _childReferral
    ) public view returns (uint256) {
        address fatherReferral = fatherReferralByChild[_childReferral];
        if (fatherReferral == address(0)) {
            return 0;
        }
        uint32 fatherReferralLevel = fatherReferralMapping[fatherReferral].level;
        uint32 levelPercent = referralLevelsAndPercents[fatherReferralLevel];
        uint32 levelPercent2 = fatherReferralMapping[fatherReferral].percentForAdmin;
        uint32 newLevelPercent;
        if (levelPercent > levelPercent2) {
            newLevelPercent = levelPercent;
        } else {
            newLevelPercent = levelPercent2;
        }
        uint256 newAmount = (_amount * newLevelPercent) / 10_000;
        return newAmount;
    }

    function prepareAndUpdateReferralLevelsAndPercents(
        Structs.ReferralLevelsAndPercentsStruct[]
            memory newReferralLevelsAndPercents
    ) internal {
        // Check if percents in new levels not higher fixed
        for (uint256 i = 0; i < newReferralLevelsAndPercents.length; i++) {
            require(
                newReferralLevelsAndPercents[i].percent <= MAX_REFRRAL_PERCENT,
                string(
                    abi.encodePacked(
                        "Requires maximum referral percent of ",
                        StringsUpgradeable.toString(MAX_REFRRAL_PERCENT)
                    )
                )
            );
        }
        // Update new referral levels and percents
        for (uint256 i = 0; i < newReferralLevelsAndPercents.length; i++) {
            referralLevelsAndPercents[
                newReferralLevelsAndPercents[i].level
            ] = newReferralLevelsAndPercents[i].percent;
            if (
                !keyListReferralLevelsAndPercentsExists[
                    newReferralLevelsAndPercents[i].level
                ]
            ) {
                keyListReferralLevelsAndPercentsExists[
                    newReferralLevelsAndPercents[i].level
                ] = true;
                keyListReferralLevelsAndPercents.push(
                    newReferralLevelsAndPercents[i].level
                );
            }
        }
    }

    function assertOneYocto() internal {
        require(msg.value == 1, "Requires attached deposit of exactly 1 yocto");
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
