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

    function play(uint8 _bet, address player) external payable;
}

interface ReferralsContractInterface {
    function rootCaller() external view returns (address);

    function calculateReferralFatherFee(uint256 _amount, address _childReferral)
        external
        view
        returns (uint256);

    function addCalculatedFatherFee(address _childReferral, uint256 _amount)
        external
        payable;
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

contract ProxyRouterPrevUpgradable is
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

    // Events
    event UpdateGame(string name, address gameAddress);
    event DeleteGame(string name);
    event UpdateReferralContractAddress(address newAddress);
    event UpdateGamesPoolContractAddress(address newAddress);
    event Payout(address to, uint256 amount);
    event Credited(address user, uint256 amount);

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

    function playGame(string memory _gameName, uint8 _bet)
        public
        payable
        nonReentrant
    {
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
            newAmount >= minBetAmount && newAmount <= maxBetAmount,
            "amount should be more than min and less than max"
        );
        sendFeesAndReferrals((msg.value * fee) / 10_000, msg.value, msg.sender);
        otherContract.play{value: newAmount}(_bet, msg.sender);
    }

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
            })
        });
        emit UpdateGame(newGame.name, newGame.gameAddress);
    }

    function deleteGame(string memory _gameName) public payable onlyOwner {
        assertOneYocto();
        require(
            games[_gameName].gameAddress != address(0),
            "Game does not exists"
        );
        gamesPoolContract.deleteReservedAmount{value: 1}(games[_gameName].gameAddress);
        delete games[_gameName];
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

    function updateGamesPoolContractAddress(
        address _gamesPoolContractAddress
    ) public payable onlyOwner {
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

    function calculateCurrentTransactionFee(string memory _gameName)
        public
        payable
        returns (uint256)
    {
        return calculateCurrentTransactionFeeInternal(_gameName);
    }

    function setNewTreasuryIds(Structs.Treasuries[] memory _treasuries)
        public
        payable
        onlyOwner
    {
        assertOneYocto();
        setNewTreasuryIdsInternal(_treasuries);
    }

    function withdraw(uint256 _amount) public payable onlyOwner {
        uint256 balance = address(this).balance;

        require(_amount <= balance, "amount should be less than balance");

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed.");

        emit Payout(msg.sender, _amount);
    }

    function getTreasuriesLength() public view returns (uint256) {
        return treasuries.length;
    }

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

    function setNewTreasuryIdsInternal(
        Structs.Treasuries[] memory _treasuries
    ) internal {
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

    function sendFeesAndReferrals(uint256 _amount, uint256 _sentAmount, address _caller)
        internal
    {   
        uint256 _referralFeeAmount = referralsContract.calculateReferralFatherFee(_amount, _caller);
        if (_referralFeeAmount != 0) {
            referralsContract.addCalculatedFatherFee{
                value: _referralFeeAmount
            }(_caller, _sentAmount);
            _amount -= _referralFeeAmount;
        }
        for (uint256 i = 0; i < treasuries.length; i++) {
            if (treasuries[i].amount != uint256(0)) {
                (bool success, ) = treasuries[i].treasury.call{
                    value: (_amount * treasuries[i].amount) / 10_000
                }("");
                require(success, "Transfer failed.");
            }
        }
    }

    receive() external payable {
        emit Credited(msg.sender, msg.value);
    }
}
