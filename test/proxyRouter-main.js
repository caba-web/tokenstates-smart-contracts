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
                1000001
            ]
        );
        await testUsdt.deployed();

        ProxyRouter = await ethers.getContractFactory("ProxyRouter");
        proxyRouter = await ProxyRouter.deploy(
            ...[
                testUsdt.address,
                "0x0000000000000000000000000000000000000000",
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));
    });

    it("should adminBuy token at ProxyRouter", async function () {
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

        await expect(proxyRouter.adminBuy(tsCoin.address, user1.address, ethers.utils.parseEther("50")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));
    });

    it("should panic adminBuy token if not owner at ProxyRouter", async function () {
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
        
        try {
            await expect(proxyRouter.connect(user1).adminBuy(tsCoin.address, user1.address, ethers.utils.parseEther("50")))
                .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
                .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                return;
            }
        }
        throw new Error();
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

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

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("100")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("100"));

        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address)
            .to.emit(tsCoin, "NotPausable");

        let blockNumAfter = await ethers.provider.getBlockNumber();
        let blockAfter = await ethers.provider.getBlock(blockNumAfter);
        let timestampAfter = blockAfter.timestamp;

        expect((await proxyRouter.tokens(tsCoin.address)).price).to.equal(50);
        expect((await proxyRouter.tokens(tsCoin.address)).claimTimestamp).to.equal(1767801720);
        expect((await proxyRouter.tokens(tsCoin.address)).limitTimestamp).to.equal(timestampAfter + 2_592_000);
        expect((await proxyRouter.tokens(tsCoin.address)).available).to.equal(ethers.BigNumber.from(1000000 - 1).mul(DECIMAL));
        expect((await proxyRouter.tokens(tsCoin.address)).sold).to.equal(ethers.BigNumber.from(1).mul(DECIMAL));
        expect((await proxyRouter.tokens(tsCoin.address)).lastCallTimestamp).to.equal(1757801720);
        expect((await proxyRouter.tokens(tsCoin.address)).createdTimestamp).to.equal(timestampBefore + 1);
        expect((await proxyRouter.tokens(tsCoin.address)).closedTimestamp).to.equal(timestampAfter);
        expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(false);
        expect((await proxyRouter.tokens(tsCoin.address)).isPaused).to.equal(false);
        expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(false);

        try {
            await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
                .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50);
        } catch (err) {
            if (err.toString() === "Error: Transaction reverted without a reason string") {
                return;
            }
        }
        throw new Error();
    });

    it("should panic on token buy lastCallTimeout passed at ProxyRouter", async function () {
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

        await ethers.provider.send("evm_setNextBlockTimestamp", [1757801720])
        await ethers.provider.send("evm_mine")

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("50")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("50"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("50")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, false, 0, 0, 0)
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address)
            .to.emit(tsCoin, "NotPausable");
        
        expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(false);

    });

    it("should buy all and unlock notPausable at ProxyRouter", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1000000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1000000"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("1000000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"), 1)
            .to.emit(proxyRouter, "TokenCollected")
            .to.emit(tsCoin, "NotPausable");
        
        expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(true);

    });

    it("should panic at insufficient available at ProxyRouter", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1000001")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1000001"));

        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("1000001")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, false, 0, 0, 0);
        
    });

    it("should panic at token close if claim period's started in a ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await ethers.provider.send("evm_setNextBlockTimestamp", [1767801721])
        await ethers.provider.send("evm_mine")

		try {
			await expect(proxyRouter.closeToken(tsCoin.address))
				.to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Claim period has started'") {
				return;
			}
		}
		throw new Error();
	});

    it("should check refund normal at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);

        await expect(tsCoin.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.connect(user1).refund(tsCoin.address, ethers.utils.parseEther("1")))
            .to.emit(proxyRouter, "Refund").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
            .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
            .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));

    });

    it("should check refund onTokenApproval at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);

        await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000001"))
            .to.emit(proxyRouter, "Refund").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
            .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
            .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));

    });

    it("should panic if refund timestamp limit passed at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);

        let blockNumAfter = await ethers.provider.getBlockNumber();
        let blockAfter = await ethers.provider.getBlock(blockNumAfter);
        let timestampAfter = blockAfter.timestamp;

        await ethers.provider.send("evm_setNextBlockTimestamp", [timestampAfter + 2_592_000])
        await ethers.provider.send("evm_mine")
        
        try {
            await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000001"))
                .to.emit(proxyRouter, "Refund").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
                .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
                .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Tokens are not available'") {
                return;
            }
        }
        throw new Error();
        
    });

    it("should check claim normal at ProxyRouter", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1000000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1000000"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("1000000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"), 1)
            .to.emit(proxyRouter, "TokenCollected")
            .to.emit(tsCoin, "NotPausable");

        await ethers.provider.send("evm_setNextBlockTimestamp", [1767801721])
		await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1")))
            .to.emit(tsCoin, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.connect(user1).claim(tsCoin.address, ethers.utils.parseEther("1")))
            .to.emit(proxyRouter, "Claim").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("1"), 1)
            .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
            .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

    });

    it("should check claim onTokenApproval at ProxyRouter", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1000000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1000000"));


        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("1000000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"), 1)
            .to.emit(proxyRouter, "TokenCollected")
            .to.emit(tsCoin, "NotPausable");

        await ethers.provider.send("evm_setNextBlockTimestamp", [1767801721])
        await ethers.provider.send("evm_mine")

        await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000002"))
            .to.emit(proxyRouter, "Claim").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("1"), 1)
            .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
            .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

    });

    it("should panic if claim timestamp passed and tokens are not sold at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await ethers.provider.send("evm_setNextBlockTimestamp", [1777800720])
        await ethers.provider.send("evm_mine")
        
        try {
            await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000002"))
                .to.emit(proxyRouter, "Claim").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
                .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
                .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Tokens are not available'") {
                return;
            }
        }
        throw new Error();
        
    });

    it("should panic if claim timestamp limit passed at ProxyRouter", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await expect(proxyRouter.createToken(tsCoin.address, [
            1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
            1757801720, 0, 0, true, false, false
        ]))
            .to.emit(proxyRouter, "TokenAdded").withArgs([
                1, 1767801720, 1777801720, ethers.BigNumber.from(1000000).mul(DECIMAL), 0,
                1757801720, timestampBefore + 1, 0, true, false, false
            ]);

        await expect(testUsdt.connect(user1).approve(proxyRouter.address, ethers.utils.parseEther("1000000")))
            .to.emit(testUsdt, "Approval").withArgs(user1.address, proxyRouter.address, ethers.utils.parseEther("1000000"));

        await expect(proxyRouter.connect(user1).buy(tsCoin.address, ethers.utils.parseEther("1000000")))
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"), 1)
            .to.emit(proxyRouter, "TokenCollected")
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1000000"));

        await ethers.provider.send("evm_setNextBlockTimestamp", [1777802720])
        await ethers.provider.send("evm_mine")
        
        try {
            await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000002"))
                .to.emit(proxyRouter, "Claim").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
                .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
                .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Tokens are not available'") {
                return;
            }
        }
        throw new Error();
        
    });

    it("should panic if claim timestamp limit passed after tokenClose at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);

        await ethers.provider.send("evm_setNextBlockTimestamp", [1777802720])
        await ethers.provider.send("evm_mine")
        
        try {
            await expect(tsCoin.connect(user1).approveAndCall(proxyRouter.address, ethers.utils.parseEther("1"), "0x0000000000000000000000000000000000000000000000000000000000000001"))
                .to.emit(proxyRouter, "Refund").withArgs(tsCoin.address, user1.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("50"), 50)
                .to.emit(tsCoin, 'Transfer').withArgs(user1.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther("1"))
                .to.emit(testUsdt, 'Transfer').withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("50"));
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Tokens are not available'") {
                return;
            }
        }
        throw new Error();
        
    });

    it("should check if limitTimestamp can be updated if isActive false at ProxyRouter", async function () {
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
            .to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, true, ethers.utils.parseEther("50"), ethers.utils.parseEther("1"), 50)
            .to.emit(tsCoin, "Transfer").withArgs(proxyRouter.address, user1.address, ethers.utils.parseEther("1"));

        await expect(proxyRouter.closeToken(tsCoin.address))
            .to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);

        let closedTimestamp = (await proxyRouter.tokens(tsCoin.address)).closedTimestamp;

        await expect(proxyRouter.updateToken(tsCoin.address, [
            50, 1767801720, 1777801720, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
            1757801720, timestampBefore + 1, closedTimestamp, false, false, false
        ]))
            .to.emit(proxyRouter, "TokenUpdated").withArgs([
                50, 1767801720, 1777801720, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
                1757801720, timestampBefore + 1, closedTimestamp, false, false, false
            ]);

        try {
            await expect(proxyRouter.updateToken(tsCoin.address, [
                50, 1767801720, 1, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
                1757801720, timestampBefore + 1, closedTimestamp, false, false, false
            ]))
                .to.emit(proxyRouter, "TokenUpdated").withArgs([
                    50, 1767801720, 1, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
                    1757801720, timestampBefore + 1, closedTimestamp, false, false, false
                ]);
        } catch (err) {
            if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
                throw new Error();
            }
        }

        await ethers.provider.send("evm_setNextBlockTimestamp", [1777802720])
        await ethers.provider.send("evm_mine")

        try {
            await expect(proxyRouter.updateToken(tsCoin.address, [
                50, 1767801720, 1777802820, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
                1757801720, timestampBefore + 1, closedTimestamp, false, false, false
            ]))
                .to.emit(proxyRouter, "TokenUpdated").withArgs([
                    50, 1767801720, 1777802820, ethers.BigNumber.from(1000000 - 1).mul(DECIMAL), ethers.BigNumber.from(1).mul(DECIMAL),
                    1757801720, timestampBefore + 1, closedTimestamp, false, false, false
                ]);
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
                return;
            }
        }
        throw new Error();
        
    });



});