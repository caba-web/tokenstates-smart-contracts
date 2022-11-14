const { expect, use } = require("chai");
const { ethers, waffle, upgrades, network } = require("hardhat");
const moment = require('moment');


describe("Validator", function () {

    let ProxyRouter, TSCoin, Validator, TestUSDT, Referrals, ReferralToken, proxyRouter, tsCoin, validator, testUsdt, referrals, referralToken, owner, user1, user2, user3;

    this.timeout(0);

    beforeEach(async () => {
        await network.provider.send("hardhat_reset");
        [owner, user1, user2, user3] = await ethers.getSigners();

        DECIMAL = ethers.BigNumber.from(10).pow(18)

        TestUSDT = await ethers.getContractFactory("TestUSDT");
        testUsdt = await TestUSDT.deploy(
            ...[
                user1.address,
                "USDT",
                "TEST USDT",
                18,
                1000000
            ]
        );
        await testUsdt.deployed();

        ProxyRouter = await ethers.getContractFactory("ProxyRouter");
        proxyRouter = await ProxyRouter.deploy(
            ...[
                testUsdt.address,
                "0x0000000000000000000000000000000000000001",
            ]
        );
        await proxyRouter.deployed();

        TSCoin = await ethers.getContractFactory("TSCoin");
        tsCoin = await TSCoin.deploy(
            ...[
                proxyRouter.address,
                "TS",
                "TsDS",
                18,
                1000000,
                proxyRouter.address
            ]
        );
        await tsCoin.deployed();

        Validator = await ethers.getContractFactory("Validator");
        validator = await Validator.deploy(
            ...[
                testUsdt.address,
            ]
        );
        await validator.deployed();

        await expect(tsCoin.addInitApproval(validator.address, false))
            .to.emit(tsCoin, "AddInitApproval").withArgs(validator.address, false);

        ReferralToken = await ethers.getContractFactory("ReferralToken");
        referralToken = await ReferralToken.deploy(
            ...[
                "0x0000000000000000000000000000000000000001",
                "TS",
                "TsDS",
                18,
                2000000000000000
            ]
        );
        await referralToken.deployed();

        Referrals = await ethers.getContractFactory("Referrals");
        referrals = await Referrals.deploy(
            ...[
                referralToken.address,
                [
                    { level: 0, percent: 500 },
                    { level: 1, percent: 700 },
                    { level: 2, percent: 1_000 },
                    { level: 3, percent: 1_500 },
                    { level: 4, percent: 2_000 },
                    { level: 5, percent: 3_500 },
                    { level: 6, percent: 4_000 },
                    { level: 7, percent: 5_000 },
                ],
                proxyRouter.address,
                "0x0000000000000000000000000000000000000000"
            ]
        );
        await referrals.deployed();

        await expect(proxyRouter.updateReferralContractAddress(referrals.address, true))
            .to.emit(proxyRouter, "UpdateReferralContractAddress").withArgs(referrals.address);

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            50, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                50, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(validator.createToken(tsCoin.address))
            .to.emit(validator, "TokenAdded").withArgs(tsCoin.address);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("3000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("3000"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("3000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("3000"), ethers.utils.parseEther("60"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("60"));
    })

    it("should create a Validator contract", async function () {

    });

    it("should lock tokens", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();
        let monthPlusTwo = moment().utc(true).add(2, 'month').startOf('month').unix();

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOne])
        await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("50")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        expect((await validator.userTokens(tsCoin.address, user1.address)).initLocked).to.equal(ethers.utils.parseEther("50"));
        expect((await validator.userTokens(tsCoin.address, user1.address)).initTimeCreate).to.equal(monthPlusTwo);
        expect((await validator.userTokens(tsCoin.address, user1.address)).lastCalculationTimestamp).to.equal(monthPlusTwo);

        expect((await validator.tokens(tsCoin.address)).wasSomethingLocked).to.equal(true);
        expect((await validator.tokens(tsCoin.address)).isPresent).to.equal(true);
        expect((await validator.tokens(tsCoin.address)).isPaused).to.equal(false);
        expect((await validator.tokens(tsCoin.address)).isLockedActive).to.equal(true);
    })

    it("should lock for next month tokens", async function () {
        let monthPlusOneEnd = moment().utc(true).add(1, 'month').endOf('month').unix();
        let monthPlusThree = moment().utc(true).add(3, 'month').startOf('month').unix();

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOneEnd])
        await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("50")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        expect((await validator.userTokens(tsCoin.address, user1.address)).initLocked).to.equal(ethers.utils.parseEther("50"));
        expect((await validator.userTokens(tsCoin.address, user1.address)).initTimeCreate).to.equal(monthPlusThree);
        expect((await validator.userTokens(tsCoin.address, user1.address)).lastCalculationTimestamp).to.equal(monthPlusThree);

        expect((await validator.tokens(tsCoin.address)).wasSomethingLocked).to.equal(true);
        expect((await validator.tokens(tsCoin.address)).isPresent).to.equal(true);
        expect((await validator.tokens(tsCoin.address)).isPaused).to.equal(false);
        expect((await validator.tokens(tsCoin.address)).isLockedActive).to.equal(true);
    })

    it("should lock secondary for next month tokens", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();
        let monthPlusTwo = moment().utc(true).add(2, 'month').startOf('month').unix();
        let monthPlusThree = moment().utc(true).add(3, 'month').startOf('month').unix();

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOne])
        await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("60")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("60"));

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusTwo])
        await ethers.provider.send("evm_mine")

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("10")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("10"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("10"));

        expect((await validator.userTokens(tsCoin.address, user1.address)).initLocked).to.equal(ethers.utils.parseEther("50"));
        expect((await validator.userTokens(tsCoin.address, user1.address)).initTimeCreate).to.equal(monthPlusTwo);
        expect((await validator.userTokens(tsCoin.address, user1.address)).lastCalculationTimestamp).to.equal(monthPlusTwo);

        expect((await validator.getOtherTokensByIndex(tsCoin.address, user1.address, 0)).timestamp).to.equal(monthPlusThree);
        expect((await validator.getOtherTokensByIndex(tsCoin.address, user1.address, 0)).amount).to.equal(ethers.utils.parseEther("10"));

    })

    it("should lock secondary for next + 1 month tokens", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();
        let monthPlusTwo = moment().utc(true).add(2, 'month').startOf('month').unix();
        let monthPlusTwoEnd = moment().utc(true).add(2, 'month').endOf('month').unix();
        let monthPlusFour = moment().utc(true).add(4, 'month').startOf('month').unix();

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOne])
        await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("60")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("60"));

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusTwoEnd])
        await ethers.provider.send("evm_mine")

        await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("10")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("10"))
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("10"));

        expect((await validator.userTokens(tsCoin.address, user1.address)).initLocked).to.equal(ethers.utils.parseEther("50"));
        expect((await validator.userTokens(tsCoin.address, user1.address)).initTimeCreate).to.equal(monthPlusTwo);
        expect((await validator.userTokens(tsCoin.address, user1.address)).lastCalculationTimestamp).to.equal(monthPlusTwo);

        expect((await validator.getOtherTokensByIndex(tsCoin.address, user1.address, 0)).timestamp).to.equal(monthPlusFour);
        expect((await validator.getOtherTokensByIndex(tsCoin.address, user1.address, 0)).amount).to.equal(ethers.utils.parseEther("10"));

    })

    it("should not allow any action if token paused", async function () {

        await expect(validator.updateTokenPaused(tsCoin.address, true)).to.emit(validator, "TokenUpdated").withArgs(tsCoin.address, true);

        try {
            await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("60")))
                .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("60"));

            await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
                .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
                .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));

            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: Transaction reverted without a reason string") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).unlock(tsCoin.address, ethers.utils.parseEther("50")))
                .to.emit(validator, "Unlocked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
                .to.emit(tsCoin, "Transfer").withArgs(validator.address, user1.address, ethers.utils.parseEther("50"));

            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: Transaction reverted without a reason string") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).claim(tsCoin.address, ethers.utils.parseEther("50")))
                .to.emit(validator, "Claimed").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"))
                .to.emit(testUsdt, "Transfer").withArgs(validator.address, user1.address, ethers.utils.parseEther("50"));

            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: Transaction reverted without a reason string") {
                throw new Error();
            }
        }

    })

    it("should update token", async function () {
        await expect(validator.updateTokenPaused(tsCoin.address, true))
            .to.emit(validator, "TokenUpdated").withArgs(tsCoin.address, true);

        expect((await validator.tokens(tsCoin.address)).isPaused).to.equal(true);
    })

    it("should delete token", async function () {
        await expect(validator.deleteToken(tsCoin.address))
            .to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);
    })

    it("should not allow onlyOwner actions if not owner", async function () {
        await expect(validator.deleteToken(tsCoin.address))
            .to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);

        try {
            await expect(validator.connect(user1).createToken(tsCoin.address))
                .to.emit(validator, "TokenAdded").withArgs(tsCoin.address);

            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

        await expect(validator.createToken(tsCoin.address))
            .to.emit(validator, "TokenAdded").withArgs(tsCoin.address);

        try {
            await expect(validator.connect(user1).updateTokenPaused(tsCoin.address, true))
                .to.emit(validator, "TokenUpdated").withArgs(tsCoin.address, true);

            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).deleteToken(tsCoin.address))
                .to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).addTokensPayoutBonds(tsCoin.address, moment().utc(true).add(1, 'month').startOf('month').unix(), 23)).to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);;
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).withdraw(12121212112)).to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);;
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

        try {
            await expect(validator.connect(user1).withdrawERC20(tsCoin.address, 1)).to.emit(validator, "TokenDeleted").withArgs(tsCoin.address);;
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                throw new Error();
            }
        }

    })

    it("should add payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);

        expect(await validator.getTokensUsedTimestampsByIndex(tsCoin.address, 0)).to.equal(monthPlusOne);
        expect(await validator.getTokensTimestampToPercent(tsCoin.address, monthPlusOne)).to.equal(350);
    })

    it("should check all errors at add payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        // _timestamp <= block.timestamp
        try {
            let tx = await validator.addTokensPayoutBonds(tsCoin.address, 1, 350);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        // _percent == uint256(0)
        try {
            let tx = await validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 0);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        // _percent > uint256(10_000)
        try {
            let tx = await validator.addTokensPayoutBonds(tsCoin.address, 1, 10001);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);

        // tokens[_tokenAddress].timestampToPercent[_timestamp] != uint256(0)
        try {
            let tx = await validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne - 20, 350);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        // _timestamp <= tokens[_tokenAddress].lastTimestamp
        try {
            let tx = await validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }
    })

    it("should edit payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);
        await expect(validator.editTokensPayoutBonds(tsCoin.address, monthPlusOne, 600)).to.emit(validator, "EditTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 600);

        expect(await validator.getTokensUsedTimestampsByIndex(tsCoin.address, 0)).to.equal(monthPlusOne);
        expect(await validator.getTokensTimestampToPercent(tsCoin.address, monthPlusOne)).to.equal(600);
    })

    it("should check all errors at edit payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        // tokens[_tokenAddress].timestampToPercent[_timestamp] == uint256(0)
        try {
            let tx = await validator.editTokensPayoutBonds(tsCoin.address, monthPlusOne, 350);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);

        // _percent == uint256(0)
        try {
            let tx = await validator.editTokensPayoutBonds(tsCoin.address, monthPlusOne, 0);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        // _percent > uint256(10_000)
        try {
            let tx = await validator.editTokensPayoutBonds(tsCoin.address, monthPlusOne, 10001);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOne])
        await ethers.provider.send("evm_mine")

        // _timestamp <= block.timestamp
        try {
            let tx = await validator.editTokensPayoutBonds(tsCoin.address, monthPlusOne - 20, 350);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }
    })

    it("should delete payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);
        await expect(validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne)).to.emit(validator, "DeletedTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne);

        expect((await validator.tokens(tsCoin.address)).lastTimestamp).to.equal(0);
    })

    it("should check all errors at delete payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();

        // tokens[_tokenAddress].timestampToPercent[_timestamp] == uint256(0)
        try {
            let tx = await validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }

        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);

        await ethers.provider.send("evm_setNextBlockTimestamp", [monthPlusOne])
        await ethers.provider.send("evm_mine")

        // _timestamp <= block.timestamp
        try {
            let tx = await validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne - 20);
            await tx.wait();
            throw new Error();
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidBondData()'") {
                throw new Error();
            }
        }
    })

    it("should check lastTimestamp at delete payout bonds", async function () {
        let monthPlusOne = moment().utc(true).add(1, 'month').startOf('month').unix();


        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne, 350);
        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne + 1, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne + 1, 350);
        await expect(validator.addTokensPayoutBonds(tsCoin.address, monthPlusOne + 2, 350)).to.emit(validator, "AddedNewTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne + 2, 350);

        expect((await validator.tokens(tsCoin.address)).lastTimestamp).to.equal(monthPlusOne + 2);

        // deletes central
        await expect(validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne + 1)).to.emit(validator, "DeletedTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne + 1);
        expect((await validator.tokens(tsCoin.address)).lastTimestamp).to.equal(monthPlusOne + 2);

        // deletes latest
        await expect(validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne + 2)).to.emit(validator, "DeletedTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne + 2);
        expect((await validator.tokens(tsCoin.address)).lastTimestamp).to.equal(monthPlusOne);

        // deletes last one
        await expect(validator.deleteTokensPayoutBonds(tsCoin.address, monthPlusOne)).to.emit(validator, "DeletedTokenPayoutBond").withArgs(tsCoin.address, monthPlusOne);
        expect((await validator.tokens(tsCoin.address)).lastTimestamp).to.equal(0);

    })
});

