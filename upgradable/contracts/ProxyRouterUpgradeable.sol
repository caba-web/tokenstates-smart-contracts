//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

library Structs {
    struct Token {
        uint256 price; // price for the token. Used for buy bond, return bond, return bond after bad collecting
        uint256 claimTimestamp; // timestamp when the bond will be available for return, is changable if more lastCallTimestamp
        uint256 limitTimestamp; // timestamp when the bond will be not available for return anymore
        uint256 available; // shows how much tokens are left for sale
        uint256 sold; // shows how many tokens have been sold
        uint256 lastCallTimestamp; // timestamp when project must sell all the tokens
        uint256 createdTimestamp; // shows if project is real
        uint256 closedTimestamp; // timestamp whe project is closed either by admin or automaticly
        bool isActive; // shows if project is active, can be false if project did not collect all the money by set time
        bool isPaused; // shows if token selling is still active
        bool isCollected; // shows if project has collected all money, can be set by admin. Allowed to sell even after true
    }
}

library Errors {
    error InvalidTokenData();
    error UnknownFunctionId();
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
    function proxyRouterContractAddress() external view returns (address);

    function createToken(address _tokenAddress) external;

    function updateTokenPaused(address _tokenAddress, bool _isPaused) external;

    function deleteToken(address _tokenAddress) external;
}

interface TSCoinContract {
    function notPausable() external;
    function decimals() external view returns(uint8);
}

contract ProxyRouterUpgradeable is Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public token; // usdt token.

    uint public constant MINIMUM_AMOUNT_TO_BUY = 1;

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
    event UpdateValidatorContractAddress(address validatorContractAddress);
    event MainTokenChanged(address tokenAddress);


    event Buy(
        address indexed tokenAddress,
        address indexed user,
        bool success,
        uint256 amount,
        uint256 amountToBuy,
        uint256 price
    );
    event Refund(
        address indexed tokenAddress,
        address indexed user,
        uint256 amount,
        uint256 amountReturned,
        uint256 price
    );
    event Claim(
        address indexed tokenAddress,
        address indexed user,
        uint256 amount,
        uint256 amountReturned,
        uint256 price
    );

    event Payout(address to, uint256 amount);
    event PayoutERC20(address tokenAddress, address to, uint256 amount);
    event Credited(address from, uint256 amount);

    modifier isTokenPresent(address _tokenAddress, bool _bool) {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(
            (_bool && _token.createdTimestamp != 0) ||
                (!_bool && _token.createdTimestamp == 0)
        );
        _;
    }

    modifier isTokenActive(address _tokenAddress, bool _bool) {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(
            _token.createdTimestamp != 0 &&
                _token.isActive == _bool &&
                !_token.isPaused
        );
        _;
    }

    modifier onlyProxyRouter() {
        require(
            _msgSender() == address(this),
            "Ownable: caller is not the proxyRouter"
        );
        _;
    }

    /** @dev Initializes contract
     */
    function initialize(
        IERC20 _token,
        address _referralsContractAddress,
        address _validatorContractAddress
    ) public payable initializer {
        token = _token;

        referralsContract = ReferralsContractInterface(
            _referralsContractAddress
        );
        referralsContractAddress = _referralsContractAddress;

        validatorContract = ValidatorContractInterface(
            _validatorContractAddress
        );
        validatorContractAddress = _validatorContractAddress;
        __Ownable_init();
        __ReentrancyGuard_init();
    }
  
    ///@dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

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
        bool _success;
        _success = _checkTokensAreCollectedPre(_tokenAddress);
        if (_success) {
            (_success, ) = address(this).call(
                abi.encodeWithSignature(
                    "_buy(address,address,uint256)",
                    _tokenAddress,
                    msg.sender,
                    _amount
                )
            );
            if (!_success) {
                emit Buy(_tokenAddress, msg.sender, false, 0, 0, 0);    
            }
        } else {
            emit Buy(_tokenAddress, msg.sender, false, 0, 0, 0);    
        }
    }

    function _buy(
        address _tokenAddress,
        address _from,
        uint256 _amount
    ) public onlyProxyRouter {
        TSCoinContract __purchasingToken = TSCoinContract(_tokenAddress);
        Structs.Token memory _token = tokens[_tokenAddress];

        uint256 _amountToBuy = _amount / _token.price;

        require(_amountToBuy >= MINIMUM_AMOUNT_TO_BUY * 10 ** __purchasingToken.decimals());

        token.safeTransferFrom(_from, address(this), _amount);

        IERC20 _purchasingToken = IERC20(_tokenAddress);
        tokens[_tokenAddress].available -= _amountToBuy;
        tokens[_tokenAddress].sold += _amountToBuy;
        _purchasingToken.safeTransfer(_from, _amountToBuy);

        _sendReferrals(_amount, _from);
        _checkTokensAreCollectedAfter(_tokenAddress);

        emit Buy(_tokenAddress, _from, true, _amount, _amountToBuy, _token.price);

        // send referrals, check for collected
    }

    /** @dev Refund tokens if amount not collected
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of ts.
     */
    function refund(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress, false)
        nonReentrant
    {
        _refund(_tokenAddress, msg.sender, _amount);
    }

    /** @dev Claim tokens
     * @param _tokenAddress address of the buying token.
     * @param _amount amount of ts.
     */
    function claim(address _tokenAddress, uint256 _amount)
        public
        isTokenActive(_tokenAddress, true)
        nonReentrant
    {
        _claim(_tokenAddress, msg.sender, _amount);
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
            IERC20(_tokenAddress).totalSupply() !=
            _token.available + _token.sold ||
            _token.lastCallTimestamp < block.timestamp ||
            _token.claimTimestamp < _token.lastCallTimestamp ||
            _token.limitTimestamp < _token.claimTimestamp
        ) {
            revert Errors.InvalidTokenData();
        }
        Structs.Token memory _tokenFinal = Structs.Token(
            _token.price,
            _token.claimTimestamp,
            _token.limitTimestamp,
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
        // validatorContract.createToken(_tokenAddress);
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
            (_token.claimTimestamp != _updatingToken.claimTimestamp &&
                (_updatingToken.claimTimestamp < block.timestamp ||
                    _token.claimTimestamp < block.timestamp)) ||
            _token.available == uint256(0) ||
            IERC20(_tokenAddress).totalSupply() !=
            _token.available + _token.sold ||
            (_token.lastCallTimestamp != _updatingToken.lastCallTimestamp &&
                (_updatingToken.lastCallTimestamp < block.timestamp ||
                    _token.lastCallTimestamp < block.timestamp)) ||
            _token.claimTimestamp < _token.lastCallTimestamp ||
            (_token.limitTimestamp != _updatingToken.limitTimestamp &&
                (_updatingToken.limitTimestamp < block.timestamp ||
                    _token.limitTimestamp < block.timestamp)) ||
            (_updatingToken.isActive && _token.limitTimestamp < _token.claimTimestamp) ||
            (!_updatingToken.isActive && _token.limitTimestamp > _token.lastCallTimestamp)
        ) {
            revert Errors.InvalidTokenData();
        }
        Structs.Token memory _tokenFinal = Structs.Token(
            _updatingToken.price,
            _token.claimTimestamp,
            _token.limitTimestamp,
            _token.available,
            _token.sold,
            _token.lastCallTimestamp,
            _updatingToken.createdTimestamp,
            _updatingToken.closedTimestamp,
            _updatingToken.isActive,
            _token.isPaused,
            (_token.isCollected || _updatingToken.isCollected)
        );
        if (!_updatingToken.isCollected && _token.isCollected) {
            TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
            _tokenContract.notPausable();
        }
        // validatorContract.updateTokenPaused(_tokenAddress, _token.isPaused);
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

        // validatorContract.deleteToken(_tokenAddress);
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

        require(
            _token.claimTimestamp > block.timestamp,
            "Claim period has started"
        );

        tokens[_tokenAddress].isActive = false;
        tokens[_tokenAddress].closedTimestamp = block.timestamp;
        tokens[_tokenAddress].limitTimestamp = block.timestamp + 2_592_000;
        

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

    /** @dev Updates referrals contractAddress
     * @param _validatorContractAddress address of new contract.
     */
    function updateValidatorContractAddress(address _validatorContractAddress)
        public
        onlyOwner
    {
        require(
            ValidatorContractInterface(_validatorContractAddress)
                .proxyRouterContractAddress() == address(this),
            "Root caller of that contract is different"
        );
        validatorContract = ValidatorContractInterface(
            _validatorContractAddress
        );
        validatorContractAddress = _validatorContractAddress;
        emit UpdateValidatorContractAddress(_validatorContractAddress);
    }

    /** @dev withdraws value from contract.
     * @param _amount *
     */
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

    /** @dev changes main contract token.
     * @param _tokenAddress *
     */
    function changeToken(address _tokenAddress)
        public
        onlyOwner
    {
        token = IERC20(_tokenAddress);
        emit MainTokenChanged(_tokenAddress);
    }

    function onTokenApproval(
        address _from,
        uint256 _amount,
        bytes calldata _extraData
    ) public nonReentrant {
        require(_extraData.length == 32);

        uint64 _functionId = abi.decode(_extraData, (uint64));

        if (_functionId == 1) {
            _refund(msg.sender, _from, _amount);
        } else if (_functionId == 2) {
            _claim(msg.sender, _from, _amount);
        } else {
            revert Errors.UnknownFunctionId();
        }
    }

    function _refund(
        address _tokenAddress,
        address _from,
        uint256 _amount
    ) internal isTokenActive(_tokenAddress, false) {
        Structs.Token memory _token = tokens[_tokenAddress];

        require(
            block.timestamp < _token.limitTimestamp,
            "Tokens are not available"
        );

        uint256 _amountToReturn = _amount * _token.price;

        // tokens burn
        IERC20 _returningToken = IERC20(_tokenAddress);
        _returningToken.safeBurnFrom(_from, _amount);

        tokens[_tokenAddress].available += _amount;
        tokens[_tokenAddress].sold -= _amount;
        token.safeTransfer(_from, _amountToReturn);

        emit Refund(_tokenAddress, _from, _amount, _amountToReturn, _token.price);
    }

    function _claim(
        address _tokenAddress,
        address _from,
        uint256 _amount
    ) internal isTokenActive(_tokenAddress, true) {
        Structs.Token memory _token = tokens[_tokenAddress];
        require(
            _token.claimTimestamp < block.timestamp 
            && block.timestamp < _token.limitTimestamp,
            "Tokens are not available"
        );

        uint256 _amountToReturn = _amount * _token.price;

        // tokens burn
        IERC20 _returningToken = IERC20(_tokenAddress);
        _returningToken.safeBurnFrom(_from, _amount);

        tokens[_tokenAddress].available += _amount;
        tokens[_tokenAddress].sold -= _amount;
        token.safeTransfer(_from, _amountToReturn);

        emit Claim(_tokenAddress, _from, _amount, _amountToReturn, _token.price);
    }

    function _sendReferrals(uint256 _usdAmount, address _caller) internal {
        uint256 _referralFeeAmount = referralsContract
            .calculateReferralFatherFee(_usdAmount, _caller);
        if (_referralFeeAmount != uint256(0)) {
            referralsContract.addReferralFatherFee(_referralFeeAmount, _caller);
        }
    }

    function _checkTokensAreCollectedPre(address _tokenAddress)
        internal
        returns (bool)
    {
        Structs.Token memory _token = tokens[_tokenAddress];
        // If token either collected, or not collected and lastCallTimestamp not passed
        // Token not collected and lastCallTimestamp passed
        if (!_token.isCollected && _token.lastCallTimestamp < block.timestamp) {
            tokens[_tokenAddress].isActive = false;
            tokens[_tokenAddress].closedTimestamp = block.timestamp;
            tokens[_tokenAddress].limitTimestamp = block.timestamp + 2_592_000;

            TSCoinContract _tokenContract = TSCoinContract(_tokenAddress);
            _tokenContract.notPausable();

            emit TokenClosed(_tokenAddress);

            return false;
        }
        return true;
    }

    function _checkTokensAreCollectedAfter(address _tokenAddress) internal {
        if (tokens[_tokenAddress].available == uint256(0)) {
            tokens[_tokenAddress].isCollected = true;
            TSCoinContract _token = TSCoinContract(_tokenAddress);
            _token.notPausable();
        }
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
