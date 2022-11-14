//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./ERC20/utils/SafeERC20.sol";
import "./utils/datetime/BokkyPooBahsDateTimeLibrary.sol";
import "hardhat/console.sol";

library Structs {
    struct PayoutBonds {
        uint256 timestamp;
        uint256 percent;
    }
    struct UsedDates {
        bool isPresent;
        uint256 percent;
    }
    struct Token { 
        mapping(uint256 => uint256) timestampToPercent;
        uint256[] usedTimestamps;
        uint256 lastTimestamp;
        bool wasSomethingLocked;
        bool isPresent;
        bool isPaused;
        bool isLockedActive;
    }
    struct LockedTokensSecondary {
        uint256 timestamp;
        uint256 amount;
    }
    struct LockedTokens {
        uint256 initLocked;
        uint256 initTimeCreate;
        uint256 lastCalculationTimestamp;
        LockedTokensSecondary[] otherTokens;
    }
    struct EarnedAndToClaim {
        uint256 earned;
        uint256 toClaim;
    }
}

library Errors {
    error InvalidBondData();
    error UnknownFunctionId();
}

contract Validator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using BokkyPooBahsDateTimeLibrary for uint256;

    IERC20 public immutable token; // usdt token.

    uint256 public constant AMOUNT_OF_MONTHS_TO_UNLOCK = 6;

    mapping(address => Structs.Token) public tokens;
    mapping(address => mapping(address => Structs.LockedTokens))
        public userTokens;
    mapping(address => Structs.EarnedAndToClaim) public userEarned;

    // Events
    event TokenAdded(address tokenAddress);
    event TokenUpdated(address tokenAddress, bool isPaused);
    event TokenDeleted(address tokenAddress);

    event AddedNewTokenPayoutBond(address indexed tokenAddress, uint256 timestamp, uint256 percent);
    event EditTokenPayoutBond(address indexed tokenAddress, uint256 timestamp, uint256 percent);
    event DeletedTokenPayoutBond(address indexed tokenAddress, uint256 timestamp);

    event Locked(
        address tokenAddress,
        address user,
        uint256 amount
    );
    event Unlocked(
        address tokenAddress,
        address user,
        uint256 amount
    );
    event Claimed(
        address tokenAddress,
        address user,
        uint256 amount
    );

    event Payout(address to, uint256 amount);
    event PayoutERC20(address tokenAddress, address to, uint256 amount);
    event Credited(address from, uint256 amount);

    modifier isTokenPresent(address _tokenAddress, bool _bool) {
        Structs.Token storage _token = tokens[_tokenAddress];
        require(_token.isPresent == _bool);
        _;
    }

    modifier isTokenActive(address _tokenAddress) {
        Structs.Token storage _token = tokens[_tokenAddress];
        require(_token.isPresent && !_token.isPaused && _token.isLockedActive);
        _;
    }

    /** @dev Initializes contract
     */
    constructor(IERC20 _token) {
        token = _token;
    }

    /** @dev Locks tokens. Receives earnings
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of tokens.
     */
    function lock(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress)
        nonReentrant
    {
        _lock(_tokenAddress, msg.sender, _amount);
    }

    /** @dev Withdraws locked tokens. Calculates earnings and writing them for claim
     * @param _tokenAddress address of the contract.
     * @param _amount amount to withdraw. Deletes object if full
     */
    function unlock(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress)
        nonReentrant
    {
        _calculateEarnings(_tokenAddress, msg.sender);
        _recalculateMonths(_tokenAddress, msg.sender);
        _unlock(_tokenAddress, msg.sender, _amount);
        IERC20 _lockedToken = IERC20(_tokenAddress);
        _lockedToken.safeTransfer(msg.sender, _amount);
        emit Unlocked(_tokenAddress, msg.sender, _amount);
    }

    /** @dev Claims earnings from locked token.
     * @param _tokenAddress address of the contract.
     * @param _amount amount to claim.
     */
    function claim(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress)
        nonReentrant
    {
        _calculateEarnings(_tokenAddress, msg.sender);
        _recalculateMonths(_tokenAddress, msg.sender);
        userEarned[msg.sender].toClaim -= _amount;
        token.transfer(msg.sender, _amount);
        emit Claimed(_tokenAddress, msg.sender, _amount);
    }

    /** @dev Creates token. Called only by proxyrouter
     * @param _tokenAddress address of the contract.
     */
    function createToken(address _tokenAddress)
        public
        isTokenPresent(_tokenAddress, false)
        onlyOwner
    {
        tokens[_tokenAddress].isPresent = true;
        tokens[_tokenAddress].isPaused = false;
        tokens[_tokenAddress].isLockedActive = true;

        emit TokenAdded(_tokenAddress);
    }

    /** @dev Updates token _isPaused from that contract. Called only by owner or proxyrouter
     * @param _tokenAddress address of the contract.
     * @param _isPaused looks or unlocks txs.
     */
    function updateTokenPaused(address _tokenAddress, bool _isPaused)
        public
        isTokenPresent(_tokenAddress, true)
        onlyOwner
    {
        tokens[_tokenAddress].isPaused = _isPaused;
        emit TokenUpdated(_tokenAddress, _isPaused);
    }

    /** @dev Deletes token from that contract. Called only by proxyRouter
     * @param _tokenAddress address of the contract.
     */
    function deleteToken(address _tokenAddress)
        public
        isTokenPresent(_tokenAddress, true)
        onlyOwner
    {
        Structs.Token storage _token = tokens[_tokenAddress];
        require(
            !_token.wasSomethingLocked,
            "Something was locked already. Cannot delete token"
        );
        for (uint256 i = 0; i < _token.usedTimestamps.length; i++) {
            delete tokens[_tokenAddress].timestampToPercent[ _token.usedTimestamps[i]];
        }
        delete tokens[_tokenAddress];
        emit TokenDeleted(_tokenAddress);
    }

    /** @dev Adds tokens payout bonds
     * @param _tokenAddress address of the contract.
     * @param _timestamp unix timestamp of the bond payment.
     * @param _percent percent of the bond payment.
     */
    function addTokensPayoutBonds(
        address _tokenAddress,
        uint256 _timestamp,
        uint256 _percent
    ) public isTokenPresent(_tokenAddress, true) onlyOwner {
        if (
            _timestamp <= block.timestamp || 
            _timestamp <= tokens[_tokenAddress].lastTimestamp ||
            _percent == uint256(0) ||
            _percent > uint256(10_000) ||
            tokens[_tokenAddress].timestampToPercent[_timestamp] != uint256(0)
            ) {
            revert Errors.InvalidBondData();
        }

        tokens[_tokenAddress].timestampToPercent[_timestamp] = _percent;
        tokens[_tokenAddress].usedTimestamps.push(_timestamp);
        tokens[_tokenAddress].lastTimestamp = _timestamp;   

        emit AddedNewTokenPayoutBond(_tokenAddress, _timestamp, _percent);
    }

    /** @dev Adds tokens payout bonds
     * @param _tokenAddress address of the contract.
     * @param _timestamp unix timestamp of the bond payment.
     * @param _percent percent of the bond payment.
     */
    function editTokensPayoutBonds(
        address _tokenAddress,
        uint256 _timestamp,
        uint256 _percent
    ) public isTokenPresent(_tokenAddress, true) onlyOwner {
        if (
            _timestamp <= block.timestamp || 
            _percent == uint256(0) ||
            _percent > uint256(10_000) ||
            tokens[_tokenAddress].timestampToPercent[_timestamp] == uint256(0)
            ) {
            revert Errors.InvalidBondData();
        }

        tokens[_tokenAddress].timestampToPercent[_timestamp] = _percent;

        emit EditTokenPayoutBond(_tokenAddress, _timestamp, _percent);
    }

    /** @dev Adds tokens payout bonds
     * @param _tokenAddress address of the contract.
     * @param _timestamp unix timestamp of the bond payment.
     */
    function deleteTokensPayoutBonds(
        address _tokenAddress,
        uint256 _timestamp
    ) public isTokenPresent(_tokenAddress, true) onlyOwner {
        if (
            _timestamp <= block.timestamp || 
            tokens[_tokenAddress].timestampToPercent[_timestamp] == uint256(0)
            ) {
            revert Errors.InvalidBondData();
        }

        Structs.Token storage _token = tokens[_tokenAddress];

        delete tokens[_tokenAddress].timestampToPercent[_timestamp];

        for (uint256 i = 0; i < _token.usedTimestamps.length; i++) {
            if (_token.usedTimestamps[i] == _timestamp) {
                tokens[_tokenAddress].usedTimestamps[i] = _token
                    .usedTimestamps[_token.usedTimestamps.length - 1];
                tokens[_tokenAddress].usedTimestamps.pop();
                break;
            }
        }

        if (_token.usedTimestamps.length == 0) {
            tokens[_tokenAddress].lastTimestamp = uint256(0);   
        } else if (_timestamp == _token.lastTimestamp) {
            tokens[_tokenAddress].lastTimestamp = _token.usedTimestamps[_token.usedTimestamps.length - 1];
        }

        emit DeletedTokenPayoutBond(_tokenAddress, _timestamp);
    }


    /** @dev withdraws value from contract.
     * @param _amount *
     */
    function withdraw(uint256 _amount) public payable onlyOwner {
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

    function onTokenTransfer(
        address _from,
        uint256 _amount,
        bytes calldata _extraData
    ) public nonReentrant {
        require(_extraData.length == 32);

        uint64 _functionId = abi.decode(_extraData, (uint64));

        if (_functionId == 1) {
            _lock(msg.sender, _from, _amount);
        } else {
            revert Errors.UnknownFunctionId();
        }
    }

    function getOtherTokensLength(address _tokenAddress, address _user) public view returns (uint256) {
        return userTokens[_tokenAddress][_user].otherTokens.length;
    }

    function getTokensUsedTimestampsLength(address _tokenAddress) public view returns (uint256) {
        return tokens[_tokenAddress].usedTimestamps.length;
    }

    function getOtherTokensByIndex(address _tokenAddress, address _user, uint256 _index) public view returns (Structs.LockedTokensSecondary memory) {
        return userTokens[_tokenAddress][_user].otherTokens[_index];
    }

    function getTokensUsedTimestampsByIndex(address _tokenAddress, uint256 _index) public view returns (uint256) {
        return tokens[_tokenAddress].usedTimestamps[_index];
    }

    function getTokensTimestampToPercent(address _tokenAddress, uint256 _timestamp) public view returns (uint256) {
        return tokens[_tokenAddress].timestampToPercent[_timestamp];
    }

    function _lock(
        address _tokenAddress,
        address _from,
        uint256 _amount
    ) internal isTokenActive(_tokenAddress) {
        _calculateEarnings(_tokenAddress, _from);
        _recalculateMonths(_tokenAddress, _from);
        IERC20 _lockingToken = IERC20(_tokenAddress);
        _lockingToken.safeTransferFrom(_from, address(this), _amount);

        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _from
        ];
        if (_userTokens.initLocked == uint256(0)) {
            userTokens[_tokenAddress][_from].initLocked = _amount;
            userTokens[_tokenAddress][_from].initTimeCreate = _newDate(
                block.timestamp
            );
            userTokens[_tokenAddress][_from].lastCalculationTimestamp = _newDate(
                block.timestamp
            );
        } else if (_userTokens.initTimeCreate == _newDate(block.timestamp)) {
            userTokens[_tokenAddress][_from].initLocked += _amount;
        } else {
            _addOtherTokens(_tokenAddress, _from, _amount);
        }
        tokens[_tokenAddress].wasSomethingLocked = true;
        emit Locked(_tokenAddress, _from, _amount);
    }

    function _addOtherTokens(
        address _tokenAddress,
        address _user,
        uint256 _amount
    ) internal {
        // push other tokens to existing month or make a new one

        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _user
        ];
        (
            uint256 _todayYear,
            uint256 _todayMonth,

        ) = BokkyPooBahsDateTimeLibrary.timestampToDate(block.timestamp);

        // array is limited to 6 elems
        for (uint256 i = 0; i < _userTokens.otherTokens.length; i++) {
            // Today is September. Check if day < 15 then add to 01.10 else 01.11
            (uint256 _year, uint256 _month, ) = BokkyPooBahsDateTimeLibrary
                .timestampToDate(_userTokens.otherTokens[i].timestamp);
            if (_todayYear == _year && _todayMonth == _month) {
                userTokens[_tokenAddress][_user]
                    .otherTokens[i]
                    .amount += _amount;
                return;
            }
        }

        uint256 _newTimestamp = _newDate(block.timestamp);
        userTokens[_tokenAddress][_user].otherTokens.push(
            Structs.LockedTokensSecondary(_newTimestamp, _amount)
        );
    }

    function _calculateEarnings(address _tokenAddress, address _user) internal {
        Structs.LockedTokens memory _userTokens;
        _userTokens = userTokens[_tokenAddress][_user];
        Structs.Token storage _token = tokens[_tokenAddress];

        uint256 _deleted;

        if (_userTokens.lastCalculationTimestamp < block.timestamp) {
            return;
        }

        uint256 _months = BokkyPooBahsDateTimeLibrary.diffMonths(
            _userTokens.lastCalculationTimestamp,
            block.timestamp
        );
        uint256 _monthsInit = BokkyPooBahsDateTimeLibrary.diffMonths(
            _userTokens.initTimeCreate,
            block.timestamp
        );
        uint256 _earnings;
        if (_monthsInit > AMOUNT_OF_MONTHS_TO_UNLOCK && _months != 0) {
            for (uint256 i = 0; i < _token.usedTimestamps.length; i++) {
                if (
                    _userTokens.initTimeCreate < _token.usedTimestamps[i] &&
                    _userTokens.lastCalculationTimestamp < _token.usedTimestamps[i]
                ) {
                    uint256 _initEarnings = (_userTokens.initLocked *
                        _token.timestampToPercent[_token.usedTimestamps[i]]) / 10_000;
                    _earnings += _initEarnings;

                    for (
                        uint256 ii = 0;
                        ii < _userTokens.otherTokens.length + _deleted;
                        ii++
                    ) {
                        if (
                            _userTokens.otherTokens[ii - _deleted].timestamp >
                            block.timestamp
                        ) {
                            break;
                        }
                        uint256 _monthsOtherTokensDiff = BokkyPooBahsDateTimeLibrary
                                .diffMonths(
                                    _userTokens.otherTokens[ii - _deleted].timestamp,
                                    block.timestamp
                                );

                        uint256 _othetTokensEarnings = (_userTokens
                            .otherTokens[ii - _deleted]
                            .amount *
                            _monthsOtherTokensDiff *
                             _token.timestampToPercent[_token.usedTimestamps[i]]) /
                            (10_000 * AMOUNT_OF_MONTHS_TO_UNLOCK);
                        _earnings += (
                            _othetTokensEarnings <= _initEarnings
                                ? _othetTokensEarnings
                                : _initEarnings
                        );
                        if (
                            _monthsOtherTokensDiff >= AMOUNT_OF_MONTHS_TO_UNLOCK
                        ) {
                            // reset months
                            userTokens[_tokenAddress][_user].otherTokens[
                                    ii - _deleted
                                ] = _userTokens.otherTokens[
                                _userTokens.otherTokens.length - 1 - _deleted
                            ];
                            userTokens[_tokenAddress][_user].otherTokens.pop();

                            // update initLocked
                            userTokens[_tokenAddress][_user]
                                .initLocked += _userTokens
                                .otherTokens[ii - _deleted]
                                .amount;

                            _userTokens.initLocked += _userTokens
                                .otherTokens[ii - _deleted]
                                .amount;

                            _deleted++;
                        }
                    }
                }
            }

            uint256 newTimestampWithMonths = BokkyPooBahsDateTimeLibrary
                .addMonths(block.timestamp, 1);
            (
                uint256 _todayYearWithMonths,
                uint256 _todayMonthWithMonths,

            ) = BokkyPooBahsDateTimeLibrary.timestampToDate(
                    newTimestampWithMonths
                );
            uint256 _newTimestamp = BokkyPooBahsDateTimeLibrary
                .timestampFromDate(
                    _todayYearWithMonths,
                    _todayMonthWithMonths,
                    1
                );

            userTokens[_tokenAddress][_user]
                .lastCalculationTimestamp = _newTimestamp;
            userEarned[_user].earned += _earnings;
            userEarned[_user].toClaim += _earnings;
        }
    }

    function _recalculateMonths(address _tokenAddress, address _user) internal {
        // push other tokens to init if month > 6

        uint256 _deleted;

        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _user
        ];

        // array is limited to 6 elems
        for (uint256 i = 0; i < _userTokens.otherTokens.length + _deleted; i++) {
            if (_userTokens.otherTokens[i - _deleted].timestamp > block.timestamp) {
                break;
            }
            uint256 _months = BokkyPooBahsDateTimeLibrary.diffMonths(
                _userTokens.otherTokens[i - _deleted].timestamp,
                block.timestamp
            );
            if (_months >= AMOUNT_OF_MONTHS_TO_UNLOCK) {
                userTokens[_tokenAddress][_user].otherTokens[i] = _userTokens
                    .otherTokens[_userTokens.otherTokens.length - 1 - _deleted];
                userTokens[_tokenAddress][_user].otherTokens.pop();
                _deleted++;
            }
        }
    }

    function _unlock(
        address _tokenAddress,
        address _user,
        uint256 _amount
    ) internal {
        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _user
        ];

        uint256 _deleted;

        // array is limited to 6 elems
        for (uint256 i = _userTokens.otherTokens.length; i > 0 + _deleted; i--) {
            (bool _success, ) = SafeMath.trySub(
                _userTokens.otherTokens[i - 1 - _deleted].amount,
                _amount
            );
            if (_success) {
                userTokens[_tokenAddress][_user]
                    .otherTokens[i - 1 - _deleted]
                    .amount -= _amount;
                return;
            }
            userTokens[_tokenAddress][_user].otherTokens[i - 1 - _deleted] = _userTokens
                .otherTokens[_userTokens.otherTokens.length - 1 - _deleted];
            userTokens[_tokenAddress][_user].otherTokens.pop();
            _amount -= _userTokens.otherTokens[i - 1 - _deleted].amount;
            _deleted++;
        }

        (bool __success, uint256 _newAmount) = SafeMath.trySub(
            _userTokens.initLocked,
            _amount
        );
        require(__success, "Amount is too big");

        userTokens[_tokenAddress][_user].initLocked = _newAmount;

        if (_newAmount == uint256(0)) {
            userTokens[_tokenAddress][_user].initTimeCreate = 0;
            userTokens[_tokenAddress][_user].lastCalculationTimestamp = 0;
        }
        return;
    }

    function _newDate(uint256 _timestamp) internal pure returns (uint256) {
        (, , uint256 _todayDay) = BokkyPooBahsDateTimeLibrary.timestampToDate(
            _timestamp
        );
        uint256 _newTimestamp;
        if (_todayDay < 15) {
            uint256 newTimestampWithMonths = BokkyPooBahsDateTimeLibrary
                .addMonths(_timestamp, 1);
            (
                uint256 _todayYearWithMonths,
                uint256 _todayMonthWithMonths,

            ) = BokkyPooBahsDateTimeLibrary.timestampToDate(
                    newTimestampWithMonths
                );
            _newTimestamp = BokkyPooBahsDateTimeLibrary.timestampFromDate(
                _todayYearWithMonths,
                _todayMonthWithMonths,
                1
            );
        } else {
            uint256 newTimestampWithMonths = BokkyPooBahsDateTimeLibrary
                .addMonths(_timestamp, 2);
            (
                uint256 _todayYearWithMonths,
                uint256 _todayMonthWithMonths,

            ) = BokkyPooBahsDateTimeLibrary.timestampToDate(
                    newTimestampWithMonths
                );
            _newTimestamp = BokkyPooBahsDateTimeLibrary.timestampFromDate(
                _todayYearWithMonths,
                _todayMonthWithMonths,
                1
            );
        }
        return _newTimestamp;
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
