const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");
const { toUtf8Bytes } = require("@ethersproject/strings"); 

describe("TSCoin", function () {
	let TSCoin, tsCoin, owner, user1;

	this.timeout(0);

	beforeEach(async () => {
		[owner, user1, user2, user3] =  await ethers.getSigners();
		TSCoin = await ethers.getContractFactory("TSCoin");
		tsCoin = await TSCoin.deploy(
			...[
				owner.address,
				"TS",
                "TsDS",
                7,
                20000,
                user3.address
			]
		);
		await tsCoin.deployed();
	 })

	it("should create a TSCoin contract", async function () {
		
	});

	it("should check TSCoin metadata", async function () {
		expect(await tsCoin.name()).to.equal("TS");
		expect(await tsCoin.symbol()).to.equal("TsDS");
		expect(await tsCoin.decimals()).to.equal(7);
		expect(await tsCoin.totalSupply()).to.equal(20000 * 10 ** 7);
	});

	it("should check TSCoin mint", async function () {
		expect(await tsCoin.balanceOf(owner.address)).to.equal(20000 * 10 ** 7);
		expect(await tsCoin.balanceOf("0x0000000000000000000000000000000000000000")).to.equal(0);
	});

	it("should check TSCoin init approval", async function () {
		expect((await tsCoin.approvedAddresses(user3.address)).canCall).to.equal(true);
		expect((await tsCoin.approvedAddresses(user3.address)).canUnpause).to.equal(true);

		expect((await tsCoin.approvedAddresses("0x0000000000000000000000000000000000000000")).canCall).to.equal(false);
		expect((await tsCoin.approvedAddresses("0x0000000000000000000000000000000000000000")).canUnpause).to.equal(false);
	});

	it("should pause TSCoin", async function () {	
		await expect(tsCoin.pause())
		.to.emit(tsCoin, "Pause");

	});
	
	it("should unpause TSCoin", async function () {	
		await expect(tsCoin.unpause())
		.to.emit(tsCoin, "Unpause");

	});

	it("should notPausable TSCoin", async function () {	
		await expect(tsCoin.notPausable())
		.to.emit(tsCoin, "NotPausable");

	});

	it("should panic in pause TSCoin", async function () {	
		try {
			await expect(tsCoin.connect(user1).pause())
			.to.emit(tsCoin, "Pause");
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
				return;
			}
		}
		throw new Error();
		

	});
	
	it("should panic on unpause TSCoin", async function () {
		try {
			await expect(tsCoin.connect(user1).unpause())
			.to.emit(tsCoin, "Unpause");
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
				return;
			}
		}
		throw new Error();
		

	});

	it("should panic on notPausable TSCoin", async function () {
		try {
			await expect(tsCoin.connect(user1).notPausable())
			.to.emit(tsCoin, "NotPausable");
		} catch (err) {
			if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner or approved'") {
				return;
			}
		}
		throw new Error();
		

	});

	it("should decline transfer while paused TSCoin", async function () {
		await tsCoin.transfer(user1.address, ethers.utils.parseEther("0.00000000002"));
		try {
			await tsCoin.connect(user1).transfer(owner.address, ethers.utils.parseEther("0.00000000002"));
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner or approved'") {
				throw new Error();
            }
        };
		
		await expect(tsCoin.unpause())
		.to.emit(tsCoin, "Unpause");

		await expect(tsCoin.connect(user1).transfer(user2.address, ethers.utils.parseEther("0.00000000002")))
		.to.emit(tsCoin, "Transfer").withArgs(user1.address, user2.address, ethers.utils.parseEther("0.00000000002"));

	});

	it("should not allow to pause after notPausable TSCoin", async function () {
		await expect(tsCoin.notPausable())
		.to.emit(tsCoin, "NotPausable");

		try {
			await expect(tsCoin.pause())
			.to.emit(tsCoin, "Pause");
		} catch (err) {
			if (err.toString() === "Error: Transaction reverted without a reason string") {
				return;
			}
		}

		throw new Error();

	});

	it("should check approved accounts logic TSCoin", async function () {		
		await expect(tsCoin.addInitApproval(user3.address, false))
		.to.emit(tsCoin, "AddInitApproval").withArgs(
			user3.address,
			false
		);

		expect((await tsCoin.approvedAddresses(user3.address)).canCall).to.equal(true);
		expect((await tsCoin.approvedAddresses(user3.address)).canUnpause).to.equal(false);

		await expect(tsCoin.transfer(user3.address, ethers.utils.parseEther("0.00000000002")))
		.to.emit(tsCoin, "Transfer").withArgs(owner.address, user3.address, ethers.utils.parseEther("0.00000000002"))
		await expect(tsCoin.transfer(user2.address, ethers.utils.parseEther("0.00000000002")))
		.to.emit(tsCoin, "Transfer").withArgs(owner.address, user2.address, ethers.utils.parseEther("0.00000000002"))

		// check if can transfer to anyone
		await expect(tsCoin.connect(user3).transfer(user2.address, ethers.utils.parseEther("0.00000000002")))
		.to.emit(tsCoin, "Transfer").withArgs(user3.address, user2.address, ethers.utils.parseEther("0.00000000002"));

		// check if can receive transfer by anyone
		await expect(tsCoin.connect(user2).transfer(user3.address, ethers.utils.parseEther("0.000000000005")))
		.to.emit(tsCoin, "Transfer").withArgs(user2.address, user3.address, ethers.utils.parseEther("0.000000000005"));

		// check if can receive transferFrom by anyone
		await expect(tsCoin.connect(user2).approve(user3.address, ethers.utils.parseEther("0.000000000005")))
		.to.emit(tsCoin, "Approval").withArgs(user2.address, user3.address, ethers.utils.parseEther("0.000000000005"));
		await expect(tsCoin.connect(user3).transferFrom(user2.address, user3.address, ethers.utils.parseEther("0.000000000005")))
		.to.emit(tsCoin, "Transfer").withArgs(user2.address, user3.address, ethers.utils.parseEther("0.000000000005"));
		
		try {
			await expect(tsCoin.connect(user3).notPausable())
			.to.emit(tsCoin, "NotPausable");
			throw new Error();
		} catch (err) {
			if (err.toString() !== "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner or approved'") {
				throw new Error();
			}
		}

		await expect(tsCoin.removeInitApproval(user3.address))
		.to.emit(tsCoin, "RemoveInitApproval").withArgs(
			user3.address
		);

		expect((await tsCoin.approvedAddresses(user3.address)).canCall).to.equal(false);
		expect((await tsCoin.approvedAddresses(user3.address)).canUnpause).to.equal(false);

		await expect(tsCoin.addInitApproval(user3.address, true))
		.to.emit(tsCoin, "AddInitApproval").withArgs(
			user3.address,
			true
		);

		expect((await tsCoin.approvedAddresses(user3.address)).canCall).to.equal(true);
		expect((await tsCoin.approvedAddresses(user3.address)).canUnpause).to.equal(true);

		await expect(tsCoin.connect(user3).notPausable())
			.to.emit(tsCoin, "NotPausable");

	});

	it("should check approveAndCall TSCoin", async function () {
		const TestSeller = await ethers.getContractFactory("TestSeller");
		testSeller = await TestSeller.deploy(
			...[
				tsCoin.address,
			]
		);
		await testSeller.deployed();

		await expect(tsCoin.addInitApproval(testSeller.address, false))
		.to.emit(tsCoin, "AddInitApproval").withArgs(
			testSeller.address,
			false
		);

		await expect(tsCoin.transfer(user3.address, ethers.utils.parseEther("0.00000000002")))
		.to.emit(tsCoin, "Transfer").withArgs(owner.address, user3.address, ethers.utils.parseEther("0.00000000002"))

		await expect(tsCoin.connect(user3).transferAndCall(testSeller.address, ethers.utils.parseEther("0.000000000005"), "0x0000000000000000000000000000000000000000000000000000000000000001"))
		.to.emit(testSeller, "Receive").withArgs(user3.address, ethers.utils.parseEther("0.000000000005"));

		console.log(await tsCoin.balanceOf(testSeller.address));
		
	});

});