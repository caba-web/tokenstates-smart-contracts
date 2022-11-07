const { expect, use } = require("chai");
const { ethers, waffle, upgrades, network } = require("hardhat");

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

		Validator = await ethers.getContractFactory("Validator");
		validator = await Validator.deploy(
			...[
				testUsdt.address,
                proxyRouter.address
			]
		);
		await validator.deployed();

		await expect(proxyRouter.updateValidatorContractAddress(validator.address))
			.to.emit(proxyRouter, "UpdateValidatorContractAddress").withArgs(validator.address);

		await expect(tsCoin.addInitApproval(validator.address,  false))
			.to.emit(tsCoin, "AddInitApproval").withArgs(validator.address, false);

		expect((await proxyRouter.validatorContractAddress())).to.equal(validator.address);

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

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("3000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("3000"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("3000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("3000"), ethers.utils.parseEther("60"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("60"));	})

	it("should create a Validator contract", async function () {

	});

	it("should lock tokens", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

		await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("50")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));


		await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"), timestampBefore + 2 )
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));	

        expect((await validator.userTokens(tsCoin.address, user1.address)).initLocked).to.equal(ethers.utils.parseEther("50"));
        expect((await validator.userTokens(tsCoin.address, user1.address)).initTimeCreate).to.equal(1669852800);
        expect((await validator.userTokens(tsCoin.address, user1.address)).lastCalculationTimestamp).to.equal(1669852800);
        expect((await validator.tokens(tsCoin.address)).wasSomethingLocked).to.equal(true);
		expect((await validator.tokens(tsCoin.address)).isPresent).to.equal(true);
        expect((await validator.tokens(tsCoin.address)).isPaused).to.equal(false);
        expect((await validator.tokens(tsCoin.address)).isLockedActive).to.equal(true);
	})

	it("should lock secondary tokens", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

		await expect(tsCoin.connect(user1).approve(validator.address, ethers.utils.parseEther("60")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, validator.address, ethers.utils.parseEther("60"));

		await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("50"), timestampBefore + 2 )
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("50"));	

		await ethers.provider.send("evm_setNextBlockTimestamp", [1669852801])
		await ethers.provider.send("evm_mine")

		await expect(validator.connect(user1).lock(tsCoin.address, ethers.utils.parseEther("10")))
            .to.emit(validator, "Locked").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("10"), timestampBefore + 3 )
            .to.emit(tsCoin, "Transfer").withArgs(user1.address, validator.address, ethers.utils.parseEther("10"));	

		console.log(await validator.userTokens(tsCoin.address, user1.address))
		console.log(await validator.getWRequest(tsCoin.address, user1.address, 0))
	})
});

