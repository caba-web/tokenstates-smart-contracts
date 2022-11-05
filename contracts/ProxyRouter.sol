//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC20/utils/SafeERC20.sol";

library Structs {
    struct Token {
        uint256 price; // price for the token. Used for buy bond, return bond, return bond after bad collecting
        uint claimTimestamp; // timestamp when the bond will be available for return, is changable if more lastCallTimestamp
        uint claimTimestampLimit; // timestamp when the bond will be not available for return anymore
        uint256 available; // shows how much tokens are left for sale
        uint256 sold; // shows how many tokens have been sold
        uint lastCallTimestamp; // timestamp when project must sell all the tokens
        uint createdTimestamp; // shows if project is real
        uint closedTimestamp; // timestamp whe project is closed either by admin or automaticly
        bool isActive; // shows if project is active, can be false if project did not collect all the money by set time
        bool isPaused; // shows if token selling is still active
        bool isCollected; // shows if project has collected all money, can be set by admin. Allowed to sell even after true
    }
}

library Errors {
    error InvalidTokenData();
}

interface ReferralsContractInterface {
    function rootCaller() external view returns (address);

    function calculateReferralFatherFee(uint256 _amount, address _childReferral)
        external
        view
        returns (uint256);

    function addReferralFatherFee(uint256 _amount, address _childReferral)
        external;
}

interface ValidatorContractInterface {
    function createToken(address _tokenAddress) external;

    function updateTokenPaused(address _tokenAddress, bool _isPaused) external;

    function deleteToken(address _tokenAddress) external;
}

interface TSCoinContract {
    function notPausable() external;
}

contract ProxyRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token; // usdt token.

    ReferralsContractInterface internal referralsContract;
    ValidatorContractInterface internal validatorContract;

    address public referralsContractAddress;
    address public validatorContractAddress;

    mapping(address => Structs.Token) public tokens;

    // Events
    event TokenAdded(Structs.Token tokenObj);
    event TokenUpdated(Structs.Token tokenObj);
    event TokenDeleted(address tokenAddress);
    event TokenClosed(address tokenAddress);
    event UpdateReferralContractAddress(address referralsContractAddress);

    event Buy(address indexed tokenAddress, address indexed user, uint256 amount, uint256 price);
    event Refund(address indexed tokenAddress, address indexed user, uint256 amount, uint256 price);
    event Claim(address indexed tokenAddress, address indexed user, uint256 amount, uint256 price);

    event Payout(address to, uint256 amount);
    event Credited(address from, uint256 amount);

    modifier isTokenPresent(address _tokenAddress, bool _bool) {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(_token.createdTimestamp != (_bool ? 1 : 0) && _token.isActive);
        _;
    }

    modifier isTokenActive(address _tokenAddress, bool _bool) {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(_token.createdTimestamp != 0 && _token.isActive == _bool && !_token.isPaused);
        _;
    }

    /** @dev Initializes contract
     */
    constructor(IERC20 _token, address _referralsContractAddress, address _validatorContractAddress) {
        token = _token;

        referralsContract = ReferralsContractInterface(
            _referralsContractAddress
        );
        referralsContractAddress = _referralsContractAddress;

        validatorContract = ValidatorContractInterface(
            _validatorContractAddress
        );
        validatorContractAddress = _validatorContractAddress;
    }

    /** @dev Buy tokens
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of usdt.
     */
    function buy(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress, true)
        nonReentrant
    {
        // check for isActive without reverting changed data
        (bool _success, bytes memory _result) = address(this).call(abi.encodeWithSignature("function checkTokenAreCollected(address)", _tokenAddress));
        require(_success, "Could not make low level call");
        (bool _resultAbi) = abi.decode(_result, (bool));
        require(_resultAbi, "Tokens not collected so project is closed");

        Structs.Token memory _token = tokens[_tokenAddress];

        uint256 _amountToBuy = _token.price * _amount;

        token.safeTransferFrom(msg.sender, address(this), _amount);

        IERC20 _purchasingToken = IERC20(_tokenAddress);
        tokens[_tokenAddress].available -= _amountToBuy;
        tokens[_tokenAddress].sold += _amountToBuy;
        _purchasingToken.safeTransfer(msg.sender, _amountToBuy);

        sendReferrals(_amount, msg.sender);
        checkTokensAreCollected(_tokenAddress);

        emit Buy(_tokenAddress, msg.sender, _amount, _token.price);

        // send referrals, check for collected
    }

    /** @dev Refund tokens if amount not collected
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of usdt.
     */
    function refund(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress, false)
        nonReentrant
    {
        Structs.Token memory _token = tokens[_tokenAddress];

        uint256 _amountToReturn = _amount / _token.price;

        // tokens burn
        IERC20 _returningToken = IERC20(_tokenAddress);
        _returningToken.safeBurnFrom(msg.sender, _amount);

        tokens[_tokenAddress].available += _amountToReturn;
        tokens[_tokenAddress].sold -= _amountToReturn;
        token.safeTransfer(msg.sender, _amountToReturn);


        emit Refund(_tokenAddress, msg.sender, _amount, _token.price);
    }

    /** @dev Claim tokens
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of usdt.
     */
    function claim(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress, true)
        nonReentrant
    {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(_token.claimTimestamp > block.timestamp, "Tokens are not available for claim yet");
        require(_token.claimTimestampLimit < block.timestamp, "Tokens are not available for claim anymore");

        uint256 _amountToReturn = _amount / _token.price;

        // tokens burn
        IERC20 _returningToken = IERC20(_tokenAddress);
        _returningToken.safeBurnFrom(msg.sender, _amount);

        tokens[_tokenAddress].available += _amountToReturn;
        tokens[_tokenAddress].sold -= _amountToReturn;
        token.safeTransfer(msg.sender, _amountToReturn);

        emit Claim(_tokenAddress, msg.sender, _amount, _token.price);
    }

    /** @dev Create token
     * @param _token Token object.
     * @param _tokenAddress address of the creaiting token.
     */
    function createToken(address _tokenAddress, Structs.Token memory _token)
        public
        isTokenPresent(_tokenAddress, false)
        onlyOwner
    {
        if (
            _token.price == uint256(0) ||
            _token.claimTimestamp < block.timestamp ||
            _token.available == uint256(0) ||
            IERC20(_tokenAddress).totalSupply() != _token.available + _token.sold ||
            _token.lastCallTimestamp < block.timestamp ||
            _token.claimTimestamp < _token.lastCallTimestamp ||
            _token.claimTimestampLimit < _token.claimTimestamp
        ) {
            revert Errors.InvalidTokenData();
        }
        Structs.Token memory _tokenFinal = Structs.Token(
            _token.price,
            _token.claimTimestamp,
            _token.claimTimestampLimit,
            _token.available,
            _token.sold,
            _token.lastCallTimestamp,
            block.timestamp,
            uint256(0),
            true,
            _token.isPaused,
            _token.isCollected
        );
        if (_token.isCollected) {
            TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
            _tokenContract.notPausable();
        }
        validatorContract.createToken(_tokenAddress);
        tokens[_tokenAddress] = _tokenFinal;
        emit TokenAdded(_tokenFinal);
    }

    /** @dev Updates some token info
     * @param _token Token object.
     * @param _tokenAddress address of the creaiting token.
     */
    function updateToken(address _tokenAddress, Structs.Token memory _token)
        public
        isTokenPresent(_tokenAddress, true)
        onlyOwner
    {
        Structs.Token memory _updatingToken = tokens[_tokenAddress];

        if (
            _token.price == uint256(0) ||
            (_token.claimTimestamp != _updatingToken.claimTimestamp &&
                _token.claimTimestamp < block.timestamp) ||
            _token.available == uint256(0) ||
            IERC20(_tokenAddress).totalSupply() != _token.available + _token.sold ||
            (_token.lastCallTimestamp != _updatingToken.lastCallTimestamp &&
                _token.lastCallTimestamp < block.timestamp) ||
            _token.claimTimestamp < _token.lastCallTimestamp ||
            !(!_token.isCollected ||
                _token.isCollected == _updatingToken.isCollected) ||
            (_token.claimTimestampLimit != _updatingToken.claimTimestampLimit &&
                _token.claimTimestampLimit < block.timestamp) ||
            _token.claimTimestampLimit < _token.claimTimestamp

        ) {
            revert Errors.InvalidTokenData();
        }
        Structs.Token memory _tokenFinal = Structs.Token(
            _token.price,
            _token.claimTimestamp,
            _token.claimTimestampLimit,
            _token.available,
            _token.sold,
            _token.lastCallTimestamp,
            _updatingToken.createdTimestamp,
            _updatingToken.closedTimestamp,
            _updatingToken.isActive,
            _token.isPaused,
            _token.isCollected
        );
        if (_token.isCollected) {
            TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
            _tokenContract.notPausable();
        }
        validatorContract.updateTokenPaused(_tokenAddress, _token.isPaused);
        tokens[_tokenAddress] = _tokenFinal;
        emit TokenUpdated(_tokenFinal);
    }

    /** @dev Deletes token
     * @param _tokenAddress address of the deleting token.
     */
    function deleteToken(address _tokenAddress)
        public
        isTokenPresent(_tokenAddress, true)
        onlyOwner
    {
        Structs.Token memory _token = tokens[_tokenAddress];

        require(
            _token.sold == uint256(0),
            "Some of tokens are already sold. Cannot be deleted"
        );

        validatorContract.deleteToken(_tokenAddress);
        delete tokens[_tokenAddress];
        emit TokenDeleted(_tokenAddress);
    }

    /** @dev Deletes token
     * @param _tokenAddress address of the deleting token.
     */
    function closeToken(address _tokenAddress)
        public
        isTokenPresent(_tokenAddress, true)
        onlyOwner
    {
        Structs.Token memory _token = tokens[_tokenAddress];

        require(
            _token.sold != uint256(0),
            "Tokens are not sold. Should be deleted"
        );

        tokens[_tokenAddress].isActive = false;
        tokens[_tokenAddress].closedTimestamp = block.timestamp;

        TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
        _tokenContract.notPausable();

        emit TokenClosed(_tokenAddress);
    }

    /** @dev Updates referrals contractAddress
     * @param _referralsContractAddress address of new contract.
     */
    function updateReferralContractAddress(address _referralsContractAddress)
        public
        onlyOwner
    {
        require(
            ReferralsContractInterface(_referralsContractAddress)
                .rootCaller() == address(this),
            "Root caller of that contract is different"
        );
        referralsContract = ReferralsContractInterface(
            _referralsContractAddress
        );
        referralsContractAddress = _referralsContractAddress;
        emit UpdateReferralContractAddress(_referralsContractAddress);
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

    function sendReferrals(uint256 _usdAmount, address _caller) internal {
        uint256 _referralFeeAmount = referralsContract
            .calculateReferralFatherFee(_usdAmount, _caller);
        if (_referralFeeAmount != uint256(0)) {
            referralsContract.addReferralFatherFee(
                _referralFeeAmount,
                _caller
            );
        }
    }

    function checkTokensAreCollected(address _tokenAddress) internal {
        if (tokens[_tokenAddress].available == uint256(0)) {
            tokens[_tokenAddress].isCollected = true;
            TSCoinContract _token = TSCoinContract(_tokenAddress);
            _token.notPausable();
        }
    }

    function checkTokenAreCollected(address _tokenAddress) internal returns(bool) {
        Structs.Token memory _token = tokens[_tokenAddress];
        // If token either collected, or not collected and lastCallTimestamp not passed
        // Token not collected and lastCallTimestamp passed
        if (!_token.isCollected && _token.lastCallTimestamp < block.timestamp) {

            tokens[_tokenAddress].isActive = false;
            tokens[_tokenAddress].closedTimestamp = block.timestamp;

            TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
            _tokenContract.notPausable();

            emit TokenClosed(_tokenAddress);

            return false;
        }
        return true;
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
