//SPDX-License-Identifier: Unlicense
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
        PayoutBonds[] payoutBonds;
        mapping(uint256 => Structs.UsedDates) usedDates;
        mapping(uint256 => bool) passedDates;
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

interface ProxyRouterContractInterface {
    function tokens(address _tokenAddress) external view;
}

contract Validator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using BokkyPooBahsDateTimeLibrary for uint256;

    IERC20 public immutable token; // usdt token.

    ProxyRouterContractInterface internal proxyRouterContract;

    address public proxyRouterContractAddress;

    uint256 public constant AMOUNT_OF_MONTHS_TO_UNLOCK = 6;

    mapping(address => Structs.Token) public tokens;
    mapping(address => mapping(address => Structs.LockedTokens))
        public userTokens;
    mapping(address => Structs.EarnedAndToClaim) public userEarned;

    // Events
    event TokensLocked(
        address indexed tokenAddress,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    event TokenAdded(address tokenAddress);
    event TokenUpdated(address tokenAddress, bool isPaused);
    event TokenDeleted(address tokenAddress);
    event UpdateProxyRouterContractAddress(address proxyRouterContractAddress);

    event Locked(
        address tokenAddress,
        address user,
        uint256 amount,
        uint256 timestamp
    );
    event Unlocked(
        address tokenAddress,
        address user,
        uint256 amount,
        uint256 timestamp
    );
    event Claimed(
        address tokenAddress,
        address user,
        uint256 amount,
        uint256 timestamp
    );

    event Payout(address to, uint256 amount);
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

    modifier onlyProxyRouterAccount() {
        require(
            _msgSender() == proxyRouterContractAddress,
            "Ownable: caller is not the proxyRouter"
        );
        _;
    }

    modifier onlyOwnerOrProxyRouterAccount() {
        require(
            _msgSender() == owner() ||
                _msgSender() == proxyRouterContractAddress,
            "Ownable: caller is not the proxyRouter"
        );
        _;
    }

    /** @dev Initializes contract
     */
    constructor(IERC20 _token, address _proxyRouterContractAddress) {
        token = _token;
        proxyRouterContract = ProxyRouterContractInterface(
            _proxyRouterContractAddress
        );
        proxyRouterContractAddress = _proxyRouterContractAddress;
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
        calculateEarnings(_tokenAddress, msg.sender);
        recalculateMonths(_tokenAddress, msg.sender);
        unlock(_tokenAddress, msg.sender, _amount);
        IERC20 _lockedToken = IERC20(_tokenAddress);
        _lockedToken.safeTransfer(msg.sender, _amount);
        emit Unlocked(_tokenAddress, msg.sender, _amount, block.timestamp);
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
        calculateEarnings(_tokenAddress, msg.sender);
        recalculateMonths(_tokenAddress, msg.sender);
        userEarned[msg.sender].toClaim -= _amount;
        token.transfer(msg.sender, _amount);
        emit Claimed(_tokenAddress, msg.sender, _amount, block.timestamp);
    }

    /** @dev Creates token. Called only by proxyrouter
     * @param _tokenAddress address of the contract.
     */
    function createToken(address _tokenAddress)
        public
        isTokenPresent(_tokenAddress, false)
        onlyProxyRouterAccount
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
        onlyOwnerOrProxyRouterAccount
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
        onlyProxyRouterAccount
    {
        Structs.Token storage _token = tokens[_tokenAddress];
        require(
            _token.wasSomethingLocked,
            "Something was locked already. Cannot delete token"
        );
        for (uint256 i = 0; i < _token.payoutBonds.length; i++) {
            delete _token.usedDates[_token.payoutBonds[i].timestamp];
            delete _token.passedDates[_token.payoutBonds[i].timestamp];
        }
        delete tokens[_tokenAddress];
        emit TokenDeleted(_tokenAddress);
    }

    /** @dev Updates referrals contractAddress
     * @param _proxyRouterContractAddress address of new contract.
     */
    function updateProxyRouterContractAddress(
        address _proxyRouterContractAddress
    ) public onlyOwner {
        proxyRouterContract = ProxyRouterContractInterface(
            _proxyRouterContractAddress
        );
        proxyRouterContractAddress = _proxyRouterContractAddress;
        emit UpdateProxyRouterContractAddress(_proxyRouterContractAddress);
    }

    /** @dev Adds tokens payout bonds
     * @param _tokenAddress address of the contract.
     * @param _data Structs.PayoutBonds[] objects array {timestamp, percentForPrevMonths}.
     */
    function addTokensPayoutBonds(
        address _tokenAddress,
        Structs.PayoutBonds[] memory _data
    ) public isTokenPresent(_tokenAddress, true) onlyOwner {
        Structs.Token storage _token = tokens[_tokenAddress];

        uint256 _prevTimestamp;

        for (uint256 i = 0; i < _token.payoutBonds.length; i++) {
            if (_token.payoutBonds[i].timestamp < block.timestamp) {
                tokens[_tokenAddress].passedDates[
                    _token.payoutBonds[i].timestamp
                ] = true;
            } else {
                break;
            }
        }

        Structs.Token storage _tokenSecondary = tokens[_tokenAddress];

        // array is unlimitted
        // если дата присутствует то ее можно изменить только если ее таймштамп еще не прошел
        for (uint256 i = 0; i < _data.length; i++) {
            if (
                _data[i].timestamp < _prevTimestamp ||
                (_tokenSecondary.passedDates[_data[i].timestamp] && //Дата прошла true && percent != newPercent => err
                    _tokenSecondary.usedDates[_data[i].timestamp].percent !=
                    _data[i].percent)
            ) {
                revert Errors.InvalidBondData();
            }
            _prevTimestamp = _data[i].timestamp;
        }

        for (uint256 i = 0; i < _token.payoutBonds.length; i++) {
            delete tokens[_tokenAddress].passedDates[
                _token.payoutBonds[i].timestamp
            ];
            delete tokens[_tokenAddress].usedDates[
                _token.payoutBonds[i].timestamp
            ];
        }

        for (uint256 i = 0; i < _data.length; i++) {
            tokens[_tokenAddress].usedDates[_data[i].timestamp] = Structs
                .UsedDates(true, _data[i].percent);
        }
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

    function getWRequest(address _tokenAddress, address _user, uint256 _index) public view returns (Structs.LockedTokensSecondary memory) {
        return userTokens[_tokenAddress][_user].otherTokens[_index];
    }

    function _lock(
        address _tokenAddress,
        address _from,
        uint256 _amount
    ) internal isTokenActive(_tokenAddress) {
        recalculateMonths(_tokenAddress, _from);
        IERC20 _lockingToken = IERC20(_tokenAddress);
        _lockingToken.safeTransferFrom(_from, address(this), _amount);

        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _from
        ];
        if (_userTokens.initLocked == uint256(0)) {
            userTokens[_tokenAddress][_from].initLocked = _amount;
            userTokens[_tokenAddress][_from].initTimeCreate = newDate(
                block.timestamp
            );
            userTokens[_tokenAddress][_from].lastCalculationTimestamp = newDate(
                block.timestamp
            );
        } else if (_userTokens.initTimeCreate == newDate(block.timestamp)) {
            userTokens[_tokenAddress][_from].initLocked += _amount;
        } else {
            addOtherTokens(_tokenAddress, _from, _amount);
        }
        tokens[_tokenAddress].wasSomethingLocked = true;
        emit Locked(_tokenAddress, _from, _amount, block.timestamp);
    }

    function addOtherTokens(
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

        uint256 _newTimestamp = newDate(block.timestamp);
        userTokens[_tokenAddress][_user].otherTokens.push(
            Structs.LockedTokensSecondary(_newTimestamp, _amount)
        );
    }

    function calculateEarnings(address _tokenAddress, address _user) internal {
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
            for (uint256 i = 0; i < _token.payoutBonds.length; i++) {
                if (
                    _token.payoutBonds[i].timestamp >
                    _userTokens.lastCalculationTimestamp
                ) {
                    uint256 _initEarnings = (_userTokens.initLocked *
                        _token.payoutBonds[i].percent) / 10_000;
                    _earnings += _initEarnings;

                    for (
                        uint256 ii = 0;
                        ii < _userTokens.otherTokens.length;
                        ii++
                    ) {
                        if (
                            _userTokens.otherTokens[ii].timestamp >
                            block.timestamp
                        ) {
                            break;
                        }
                        uint256 _monthsOtherTokensDiff = BokkyPooBahsDateTimeLibrary
                                .diffMonths(
                                    _userTokens.otherTokens[ii].timestamp,
                                    block.timestamp
                                );

                        uint256 _othetTokensEarnings = (_userTokens
                            .otherTokens[ii]
                            .amount *
                            _monthsOtherTokensDiff *
                            _token.payoutBonds[i].percent) /
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
                                    i
                                ] = _userTokens.otherTokens[
                                _userTokens.otherTokens.length - 1 - _deleted
                            ];
                            userTokens[_tokenAddress][_user].otherTokens.pop();

                            // update initLocked
                            userTokens[_tokenAddress][_user]
                                .initLocked += _userTokens
                                .otherTokens[ii]
                                .amount;

                            _userTokens.initLocked += _userTokens
                                .otherTokens[ii]
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

    function recalculateMonths(address _tokenAddress, address _user) internal {
        // push other tokens to init if month > 6

        uint256 _deleted;

        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _user
        ];

        // array is limited to 6 elems
        for (uint256 i = 0; i < _userTokens.otherTokens.length; i++) {
            if (_userTokens.otherTokens[i].timestamp > block.timestamp) {
                break;
            }
            uint256 _months = BokkyPooBahsDateTimeLibrary.diffMonths(
                _userTokens.otherTokens[i].timestamp,
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

    function unlock(
        address _tokenAddress,
        address _user,
        uint256 _amount
    ) internal {
        Structs.LockedTokens memory _userTokens = userTokens[_tokenAddress][
            _user
        ];

        uint256 _deleted;

        // array is limited to 6 elems
        for (uint256 i = _userTokens.otherTokens.length; i > 0; i--) {
            (bool _success, ) = SafeMath.trySub(
                _userTokens.otherTokens[i - 1].amount,
                _amount
            );
            if (_success) {
                userTokens[_tokenAddress][_user]
                    .otherTokens[i - 1]
                    .amount -= _amount;
                return;
            }
            userTokens[_tokenAddress][_user].otherTokens[i - 1] = _userTokens
                .otherTokens[_userTokens.otherTokens.length - 1 - _deleted];
            userTokens[_tokenAddress][_user].otherTokens.pop();
            _amount -= _userTokens.otherTokens[i - 1].amount;
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

    function newDate(uint256 _timestamp) internal pure returns (uint256) {
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
