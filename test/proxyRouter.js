const { expect } = require("chai");
const { ethers, waffle, upgrades, network } = require("hardhat");

describe("ProxyRouter", function () {

	let ProxyRouter, TSCoin, proxyRouter, tsCoin, owner, user1, user2, user3;

	this.timeout(0);

	beforeEach(async () => {
		await network.provider.send("hardhat_reset");
		[owner, user1, user2, user3] = await ethers.getSigners();
		ProxyRouter = await ethers.getContractFactory("ProxyRouter");
		proxyRouter = await ProxyRouter.deploy(
			...[
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000001",
			]
		);
		await proxyRouter.deployed();

		TSCoin = await ethers.getContractFactory("TSCoin");
		tsCoin = await TSCoin.deploy(
			...[
				owner.address,
				"TS",
				"TsDS",
				7,
				20000,
				proxyRouter.address
			]
		);
		await tsCoin.deployed();
	})

	it("should create a ProxyRouter contract", async function () {

	});

	it("should panic on buy token that does not exist at ProxyRouter", async function () {
		try {
			await expect(proxyRouter.connect(user1).buy(tsCoin.address, 150))
				.to.emit(proxyRouter, "Buy").withArgs(tsCoin.address, user1.address, 150, 50);
		} catch (err) {
			if (err.toString() === "Error: Transaction reverted without a reason string") {
				return;
			}
		}
		throw new Error();

	});

	it("should create token in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);


		expect((await proxyRouter.tokens(tsCoin.address)).price).to.equal(50);
		expect((await proxyRouter.tokens(tsCoin.address)).claimTimestamp).to.equal(1767801720);
		expect((await proxyRouter.tokens(tsCoin.address)).limitTimestamp).to.equal(1777801720);
		expect((await proxyRouter.tokens(tsCoin.address)).available).to.equal(20000 * 10 ** 7);
		expect((await proxyRouter.tokens(tsCoin.address)).sold).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).lastCallTimestamp).to.equal(1757801720);
		expect((await proxyRouter.tokens(tsCoin.address)).createdTimestamp).to.equal(timestampBefore + 1);
		expect((await proxyRouter.tokens(tsCoin.address)).closedTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(true);
		expect((await proxyRouter.tokens(tsCoin.address)).isPaused).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(false);
	});

	it("should panic at token create if already exists in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: Transaction reverted without a reason string") {
				throw new Error();
			}
		}
	});

	it("should check all errors at token create in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		// price == uint256(0)
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				0, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					0, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// claimTimestamp less then current block.timestamp
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1567801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1567801720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// available == uint256(0)
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1767801720, 1777801720, 0, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1767801720, 1777801720, 0, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// totalSupply != available + sold
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 6, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 6, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// lastCallTimestamp < block.timestamp
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1557801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1557801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// claimTimestamp < lastCallTimestamp
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1757801720, 1777801720, 20000 * 10 ** 7, 0,
				1767801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1757801720, 1777801720, 20000 * 10 ** 7, 0,
					1767801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// limitTimestamp < claimTimestamp
		try {
			await expect(proxyRouter.createToken(tsCoin.address, [
				50, 1777801720, 1767801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenAdded").withArgs([
					50, 1777801720, 1767801720, 20000 * 10 ** 7, 0,
					1767801820, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}
	});

	it("should update token in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801721, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801721, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);


		expect((await proxyRouter.tokens(tsCoin.address)).price).to.equal(50);
		expect((await proxyRouter.tokens(tsCoin.address)).claimTimestamp).to.equal(1767801721);
		expect((await proxyRouter.tokens(tsCoin.address)).limitTimestamp).to.equal(1777801720);
		expect((await proxyRouter.tokens(tsCoin.address)).available).to.equal(20000 * 10 ** 7);
		expect((await proxyRouter.tokens(tsCoin.address)).sold).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).lastCallTimestamp).to.equal(1757801720);
		expect((await proxyRouter.tokens(tsCoin.address)).createdTimestamp).to.equal(timestampBefore + 1);
		expect((await proxyRouter.tokens(tsCoin.address)).closedTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(true);
		expect((await proxyRouter.tokens(tsCoin.address)).isPaused).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(false);
	});

	it("should panic at token update if not exists in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: Transaction reverted without a reason string") {
				throw new Error();
			}
		}
	});

	it("should check all errors at token update in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;


		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// price == uint256(0)
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 0, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 0, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// claimTimestamp less then current block.timestamp
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1567801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1567801720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// available == uint256(0)
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 0, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 0, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// totalSupply != available + sold
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 6, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 6, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// lastCallTimestamp < block.timestamp
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1557801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1557801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// claimTimestamp < lastCallTimestamp
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1757801720, 1777801720, 20000 * 10 ** 7, 0,
				1767801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1757801720, 1777801720, 20000 * 10 ** 7, 0,
					1767801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// isCollected true to faulse

		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, true
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, true
			])
			.to.emit(tsCoin, "NotPausable");

		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(true);
		expect((await tsCoin.paused())).to.equal(false);
		expect((await tsCoin.canPause())).to.equal(false);

		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, true
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, true
			]);

		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(true);


		// limitTimestamp < claimTimestamp
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1777801720, 1767801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1777801720, 1767801720, 20000 * 10 ** 7, 0,
					1767801820, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}
	});

	it("should check update claimTimestamp in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);


		// claimTimestamp success
		// 1
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801220, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801220, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// 2
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// claimTimestamp error
		// 1
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		await ethers.provider.send("evm_setNextBlockTimestamp", [1767801720])
		await ethers.provider.send("evm_mine")

		
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, true, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, true, false
			]);

		// 2
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767803720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767803720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// 3
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767809720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767809720, 1777801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

	});

	it("should check update lastCallTimestamp in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);


		// lastCallTimestamp success
		// 1
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1754801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1754801720, timestampBefore + 1, 0, true, false, false
			]);

		// 2
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// lastCallTimestamp error
		// 1
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		await ethers.provider.send("evm_setNextBlockTimestamp", [1757801720])
		await ethers.provider.send("evm_mine")

		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, true, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, true, false
			]);

		// 2
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757803720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1757803720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// 3
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757800720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
					1757800720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

	});

	it("should check update limitTimestamp in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);


		// lastCallTimestamp success
		// 1
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1778801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1778801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// 2
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		// lastCallTimestamp error
		// 1
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		await ethers.provider.send("evm_setNextBlockTimestamp", [1777801720])
		await ethers.provider.send("evm_mine")

		
		await expect(proxyRouter.updateToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, true, false
		]))
			.to.emit(proxyRouter, "TokenUpdated").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, true, false
			]);

		// 2
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1776801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1776801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

		// 3
		try {
			await expect(proxyRouter.updateToken(tsCoin.address, [
				50, 1767801720, 1779801720, 20000 * 10 ** 7, 0,
				1757801720, 0, 0, true, false, false
			]))
				.to.emit(proxyRouter, "TokenUpdated").withArgs([
					50, 1767801720, 1779801720, 20000 * 10 ** 7, 0,
					1757801720, timestampBefore + 1, 0, true, false, false
				]);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with custom error 'InvalidTokenData()'") {
				throw new Error();
			}
		}

	});

	it("should delete token in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);

		await expect(proxyRouter.deleteToken(tsCoin.address))
			.to.emit(proxyRouter, "TokenDeleted").withArgs(tsCoin.address);


		expect((await proxyRouter.tokens(tsCoin.address)).price).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).claimTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).limitTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).available).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).sold).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).lastCallTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).createdTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).closedTimestamp).to.equal(0);
		expect((await proxyRouter.tokens(tsCoin.address)).isActive).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isPaused).to.equal(false);
		expect((await proxyRouter.tokens(tsCoin.address)).isCollected).to.equal(false);
	});

	it("should panic at token delete if not exists in a ProxyRouter", async function () {
		try {
			await expect(proxyRouter.deleteToken(tsCoin.address))
				.to.emit(proxyRouter, "TokenDeleted").withArgs(tsCoin.address);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: Transaction reverted without a reason string") {
				throw new Error();
			}
		}
	});

	it("should panic at token close if not exists in a ProxyRouter", async function () {
		try {
			await expect(proxyRouter.closeToken(tsCoin.address))
				.to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: Transaction reverted without a reason string") {
				throw new Error();
			}
		}
	});

	it("should panic at token close if nothing is sold in a ProxyRouter", async function () {
		const blockNumBefore = await ethers.provider.getBlockNumber();
		const blockBefore = await ethers.provider.getBlock(blockNumBefore);
		const timestampBefore = blockBefore.timestamp;

		await expect(proxyRouter.createToken(tsCoin.address, [
			50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
			1757801720, 0, 0, true, false, false
		]))
			.to.emit(proxyRouter, "TokenAdded").withArgs([
				50, 1767801720, 1777801720, 20000 * 10 ** 7, 0,
				1757801720, timestampBefore + 1, 0, true, false, false
			]);
		try {
			await expect(proxyRouter.closeToken(tsCoin.address))
				.to.emit(proxyRouter, "TokenClosed").withArgs(tsCoin.address);
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Tokens are not sold. Should be deleted'") {
				return;
			}
		}
		throw new Error();
	});

	it("should update referralContractAddress in ProxyRouter", async function () {
		const Referrals = await ethers.getContractFactory("Referrals");
		const referrals = await Referrals.deploy(
			...[
				"0x0000000000000000000000000000000000000000",
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

		expect((await proxyRouter.referralsContractAddress())).to.equal(referrals.address);

	});

	it("should allow to withdraw from ProxyRouter", async function () {
		const provider = waffle.provider;

		const balanceBefore = await provider.getBalance(proxyRouter.address);

		await owner.sendTransaction({
			to: proxyRouter.address,
			value: ethers.utils.parseEther("1"),
		});

		expect(await provider.getBalance(proxyRouter.address)).to.equal(balanceBefore + ethers.utils.parseEther("1"));

		const ownerBalanceBefore = await provider.getBalance(owner.address);

		const withdrawTx = await proxyRouter.withdraw(ethers.utils.parseEther("1"));
		// wait until the transaction is mined
		await withdrawTx.wait();

		const contractBalance = await provider.getBalance(proxyRouter.address);
		expect(contractBalance).to.equal(0);

		const ownerBalanceAfter = await provider.getBalance(owner.address);
		expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.above(
			ethers.utils.parseEther("0.8")
		);

	});

	it("should allow to withdraw tokens from ProxyRouter", async function () {
		let balance = await tsCoin.balanceOf(owner.address);
		await expect(tsCoin.transfer(proxyRouter.address, balance))
			.to.emit(tsCoin, 'Transfer')
			.withArgs(owner.address, proxyRouter.address, balance);

		await expect(proxyRouter.withdrawERC20(tsCoin.address, 2000))
			.to.emit(proxyRouter, "PayoutERC20").withArgs(tsCoin.address, owner.address, 2000);

		expect((await tsCoin.balanceOf(proxyRouter.address))).to.equal(balance - 2000);

	});

	it("should panic if onTokenApproval called not by token in ProxyRouter", async function () {
		try {
			await expect(proxyRouter.onTokenApproval(owner.address, 2000, 1)).to.emit(proxyRouter, "PayoutERC20");
		} catch (err) {
			if (err.toString() === "Error: Transaction reverted without a reason string") {
				return;
			}
		}
		throw new Error();

	});

	it("should panic if _buy called not by ProxyRouter in ProxyRouter", async function () {
		try {
			await expect(proxyRouter._buy(tsCoin.address, owner.address, 2000)).to.emit(proxyRouter, "PayoutERC20");
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the proxyRouter'") {
				return;
			}
		}
		throw new Error();
	});
});