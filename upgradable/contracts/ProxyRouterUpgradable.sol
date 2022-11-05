//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

library Structs {
    struct TransactionFee {
        uint256 currentFee;
        uint256 nextFee;
        uint256 startTime;
    }
    struct Treasuries {
        uint256 amount;
        address treasury;
    }
    struct Game {
        address gameAddress;
        TransactionFee transactionFee;
        uint64 nonce;
    }
    struct GameWithName {
        string name;
        address gameAddress;
        TransactionFee transactionFee;
    }
    struct ReservedAmount {
        uint256 amount;
        bool isPresent;
    }
}

interface OtherGameContractsInterface {
    function rootCaller() external view returns (address);

    function minBetAmount() external view returns (uint64);

    function maxBetAmount() external view returns (uint64);

    function play(
        address _player,
        uint256 _value,
        uint256 _txIdentifier,
        uint256 _autoroolAmount,
        uint256[] memory _data
    ) external payable;
}

interface ReferralsContractInterface {
    function rootCaller() external view returns (address);

    function calculateReferralFatherFee(uint256 _amount, address _childReferral)
        external
        view
        returns (uint256);

    function addCalculatedFatherFee(
        address _childReferral,
        uint256 _amount,
        uint256 txIdentifier
    ) external payable;
}

interface GamesPoolContractInterface {
    function rootCaller() external view returns (address);

    function reservedAmount(address _address)
        external
        view
        returns (Structs.ReservedAmount memory);

    function setInitReservedAmount(address _address) external payable;

    function deleteReservedAmount(address _address) external payable;
}

contract ProxyRouterUpgradable is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    mapping(string => Structs.Game) public games;
    string[] public keyListgamesAddresses;
    Structs.Treasuries[] public treasuries;
    ReferralsContractInterface internal referralsContract;
    GamesPoolContractInterface internal gamesPoolContract;
    address public referralsContractAddress;
    address public gamesPoolContractAddress;
    bytes32 keyHash;

    // Events
    event UpdateGame(string name, address gameAddress);
    event DeleteGame(string name);
    event UpdateReferralContractAddress(address newAddress);
    event UpdateGamesPoolContractAddress(address newAddress);
    event Payout(address to, uint256 amount);
    event Credited(address user, uint256 amount);

    /** @dev Initializes contract
     * @param _treasuries Treasuries List of objects.
     * @param _referralsContractAddress referral contract address
     * @param _gamesPoolContractAddress gamesPool contract address
     */
    function initialize(
        Structs.Treasuries[] memory _treasuries,
        address _referralsContractAddress,
        address _gamesPoolContractAddress
    ) public payable initializer {
        setNewTreasuryIdsInternal(_treasuries);
        referralsContract = ReferralsContractInterface(
            _referralsContractAddress
        );
        gamesPoolContract = GamesPoolContractInterface(
            _gamesPoolContractAddress
        );
        referralsContractAddress = _referralsContractAddress;
        gamesPoolContractAddress = _gamesPoolContractAddress;
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    ///@dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /** @dev Main function to play a game
     * @param _gameName string.
     * @param _autoRollAmount amount of games to be called.
     * @param _data data to be sent to the game contract.
     */
    function playGame(
        string memory _gameName,
        uint256 _autoRollAmount,
        uint256[] memory _data
        )
        public
        payable
        nonReentrant
    {
        require(
            _autoRollAmount >= 1 && _autoRollAmount <= 100,
            "autoroll amount should be in [1...100]"
        );
        Structs.Game memory game = games[_gameName];
        require(game.gameAddress != address(0), "Game does not exist");
        OtherGameContractsInterface otherContract = OtherGameContractsInterface(
            game.gameAddress
        );
        uint64 minBetAmount = otherContract.minBetAmount();
        uint64 maxBetAmount = otherContract.maxBetAmount();
        uint256 fee = calculateCurrentTransactionFeeInternal(_gameName);
        uint256 newAmount = msg.value - ((msg.value * fee) / 10_000);
        require(
            msg.value >= minBetAmount * _autoRollAmount && msg.value <= maxBetAmount * _autoRollAmount,
            "amount should be more than min and less than max"
        );
        uint64 _newNonce = game.nonce + 1;
        uint256 preSeed = uint256(
            keccak256(abi.encode(keyHash, game.gameAddress, _newNonce))
        );
        uint256 txIdentifier = uint256(keccak256(abi.encode(keyHash, preSeed)));
        uint256 autoRollAmount = _autoRollAmount;
        uint256[] memory data = _data;
        sendFeesAndReferrals(
            (msg.value * fee) / 10_000,
            msg.value,
            msg.sender,
            txIdentifier
        );
        otherContract.play{value: newAmount}(
            msg.sender,
            msg.value,
            txIdentifier,
            autoRollAmount,
            data
        );
        games[_gameName].nonce = _newNonce;
    }

    /** @dev Updates game transactionFee and address
     * @param newGame GameWithName object.
     */
    function updateGame(Structs.GameWithName memory newGame)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        if (games[newGame.name].gameAddress == address(0)) {
            keyListgamesAddresses.push(newGame.name);
        }
        for (uint256 i = 0; i < keyListgamesAddresses.length; i++) {
            require(
                keccak256(abi.encodePacked(keyListgamesAddresses[i])) ==
                    keccak256(abi.encodePacked(newGame.name)) ||
                    games[keyListgamesAddresses[i]].gameAddress !=
                    newGame.gameAddress,
                "That address is already connected to different game"
            );
        }
        OtherGameContractsInterface otherContract = OtherGameContractsInterface(
            newGame.gameAddress
        );
        require(
            otherContract.rootCaller() == address(this),
            "Root caller of that contract is different"
        );
        if (!gamesPoolContract.reservedAmount(newGame.gameAddress).isPresent) {
            gamesPoolContract.setInitReservedAmount{value: 1}(
                newGame.gameAddress
            );
        }
        games[newGame.name] = Structs.Game({
            gameAddress: newGame.gameAddress,
            transactionFee: Structs.TransactionFee({
                currentFee: newGame.transactionFee.currentFee,
                nextFee: newGame.transactionFee.nextFee,
                startTime: newGame.transactionFee.startTime
            }),
            nonce: games[newGame.name].nonce
        });
        emit UpdateGame(newGame.name, newGame.gameAddress);
    }
    
    /** @dev Deletes unneded game
     * @param _gameName string.
     */
    function deleteGame(string memory _gameName) public payable onlyOwner {
        assertOneYocto();
        require(
            games[_gameName].gameAddress != address(0),
            "Game does not exists"
        );
        gamesPoolContract.deleteReservedAmount{value: 1}(
            games[_gameName].gameAddress
        );
        games[_gameName] = Structs.Game({
            gameAddress: address(0),
            transactionFee: Structs.TransactionFee({
                currentFee: uint256(0),
                nextFee: uint256(0),
                startTime: uint256(0)
            }),
            nonce: games[_gameName].nonce
        });
        for (uint256 i = 0; i < keyListgamesAddresses.length; i++) {
            if (
                keccak256(abi.encodePacked(keyListgamesAddresses[i])) ==
                keccak256(abi.encodePacked(_gameName))
            ) {
                keyListgamesAddresses[i] = keyListgamesAddresses[
                    keyListgamesAddresses.length - 1
                ];
                keyListgamesAddresses.pop();
            }
        }
        emit DeleteGame(_gameName);
    }

    /** @dev Updates referrals contractAddress
     * @param _referralsContractAddress address of new contract.
     */
    function updateReferralContractAddress(address _referralsContractAddress)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
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

    /** @dev Updates gamesPool contractAddress
     * @param _gamesPoolContractAddress address of new contract.
     */
    function updateGamesPoolContractAddress(address _gamesPoolContractAddress)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        require(
            GamesPoolContractInterface(_gamesPoolContractAddress)
                .rootCaller() == address(this),
            "Root caller of that contract is different"
        );
        gamesPoolContract = GamesPoolContractInterface(
            _gamesPoolContractAddress
        );
        gamesPoolContractAddress = _gamesPoolContractAddress;
        emit UpdateGamesPoolContractAddress(_gamesPoolContractAddress);
    }

    /** @dev calculates and if needed updates currentTransactionFee
     * @param _gameName str.
     */
    function calculateCurrentTransactionFee(string memory _gameName)
        public
        payable
        returns (uint256)
    {
        return calculateCurrentTransactionFeeInternal(_gameName);
    }

    /** @dev sets new treasuries.
     * @param _treasuries Treasuries objects.
     */
    function setNewTreasuryIds(Structs.Treasuries[] memory _treasuries)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        setNewTreasuryIdsInternal(_treasuries);
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

    /** @dev Sets newKeyHash for txIdentifier.
     * @param _newKeyHash *
     */
    function updateKeyHash(bytes32 _newKeyHash) public onlyOwner {
        keyHash = _newKeyHash;
    }

    /** @dev returns length of treasuriesList.
     */
    function getTreasuriesLength() public view returns (uint256) {
        return treasuries.length;
    }

    /** @dev returns length of gamesList.
     */
    function getKeyListgamesAddressesLength() public view returns (uint256) {
        return keyListgamesAddresses.length;
    }

    function assertOneYocto() internal {
        require(msg.value == 1, "Requires attached deposit of exactly 1 yocto");
    }

    function calculateCurrentTransactionFeeInternal(string memory _gameName)
        internal
        returns (uint256)
    {
        require(
            games[_gameName].gameAddress != address(0),
            "Game does not exists"
        );
        Structs.Game memory game = games[_gameName];
        if (game.transactionFee.nextFee != uint256(0)) {
            if (
                block.timestamp >= game.transactionFee.startTime &&
                game.transactionFee.startTime != uint256(0)
            ) {
                games[_gameName].transactionFee = Structs.TransactionFee({
                    currentFee: game.transactionFee.nextFee,
                    startTime: uint256(0),
                    nextFee: uint256(0)
                });
            }
        }
        return games[_gameName].transactionFee.currentFee;
    }

    function setNewTreasuryIdsInternal(Structs.Treasuries[] memory _treasuries)
        internal
    {
        uint256 summary = 10_000;
        for (uint256 i = 0; i < _treasuries.length; i++) {
            require(
                summary >= _treasuries[i].amount,
                "summary must be equal to 10_000"
            );
            summary -= _treasuries[i].amount;
        }
        require(summary == uint256(0), "summary must be equal to 10_000");

        for (uint256 i = 0; i < treasuries.length; i++) {
            treasuries[i] = treasuries[treasuries.length - 1];
            treasuries.pop();
        }

        for (uint256 i = 0; i < _treasuries.length; i++) {
            treasuries.push(
                Structs.Treasuries({
                    amount: _treasuries[i].amount,
                    treasury: _treasuries[i].treasury
                })
            );
        }
    }

    function sendFeesAndReferrals(
        uint256 _amount,
        uint256 _sentAmount,
        address _caller,
        uint256 _txIdentifier
    ) internal {
        uint256 _referralFeeAmount = referralsContract
            .calculateReferralFatherFee(_amount, _caller);
        if (_referralFeeAmount != 0) {
            referralsContract.addCalculatedFatherFee{value: _referralFeeAmount}(
                _caller,
                _sentAmount,
                _txIdentifier
            );
            _amount -= _referralFeeAmount;
        }
        for (uint256 i = 0; i < treasuries.length; i++) {
            if (treasuries[i].amount != uint256(0)) {
                (bool success, ) = treasuries[i].treasury.call{
                    value: (_amount * treasuries[i].amount) / 10_000
                }("");
                require(success, "Transfer failed.");
                emit Payout(
                    treasuries[i].treasury,
                    (_amount * treasuries[i].amount) / 10_000
                );
            }
        }
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
