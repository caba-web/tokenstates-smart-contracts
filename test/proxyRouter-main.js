const { expect } = require("chai");
const { ethers, waffle, upgrades, network } = require("hardhat");

describe("ProxyRouter-Main", function () {

    let ProxyRouter, TSCoin, Referrals, TestUSDT, proxyRouter, tsCoin, referrals, testUsdt, owner, user1, user2, user3, DECIMAL;

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
                "0x0000000000000000000000000000000000000001"
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

        await expect(proxyRouter.updateReferralContractAddress(referrals.address))
            .to.emit(proxyRouter, "UpdateReferralContractAddress").withArgs(referrals.address);

    })

    it("should buy token at ProxyRouter", async function () {
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

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("50")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("50"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50);
    });

    it("should panic on buy token if amount too low at ProxyRouter", async function () {
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

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("0.01")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("0.01"));

        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("0.01")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, false, 0, 0, 0);
            
    });

    it("should panic at token delete if some is sold in a ProxyRouter", async function () {
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

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("50")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("50"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50);
        
        try {
            await expect(proxyRouter.deleteToken(tsCoin.address))
			.to.emit(proxyRouter, "TokenDeleted").withArgs(tsCoin.address);
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Some of tokens are already sold. Cannot be deleted'") {
                return
            }
        }
        throw new Error();
	});

    it("should close token in a ProxyRouter", async function () {
		let blockNumBefore = await ethers.provider.getBlockNumber();
		let blockBefore = await ethers.provider.getBlock(blockNumBefore);
		let timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            50, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                50, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("50")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("50"));

        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
        .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50);

		await expect(proxyRouter.closeToken(tsCoin.address))
			.to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address)
			.to.emit(tsCoin, "NotPausable");

        let blockNumAfter = await ethers.provider.getBlockNumber();
        let blockAfter = await ethers.provider.getBlock(blockNumAfter);
        let timestampAfter = blockAfter.timestamp;

		expect((await proxyRouter.tokens(tsCoin.address)).price).to.equal(50);
		expect((await proxyRouter.tokens(tsCoin.address)).claimTimestamp).to.equal(1767801720);
		expect((await proxyRouter.tokens(tsCoin.address)).claimTimestampLimit).to.equal(1777801720);
		expect((await proxyRouter.tokens(tsCoin.address)).available).to.equal(ethers.BigNumber.from(1000000 - 1).mul(DECIMAL));
		expect((await proxyRouter.tokens(tsCoin.address)).sold).to.equal(ethers.BigNumber.from(1).mul(DECIMAL));
		expect((await proxyRouter.tokens(tsCoin.address)).lastCallTimestamp).to.equal(1757801720);
		expect((await proxyRouter.tokens(tsCoin.address)).createdTimestamp).to.equal(timestampBefore + 1);
		expect((await proxyRouter.tokens(tsCoin.address)).closedTimestamp).to.equal(timestampAfter);
		expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isPaused).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(false);
	});

});