const { expect } = require("chai");
const { ethers, waffle, upgrades, network } = require("hardhat");

describe("Referrals", function () {

    let ProxyRouter, Referrals, proxyRouter, referrals, testUsdt, owner, user1, user2, user3, DECIMAL;

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

        ProxyRouter = await ethers.getContractFactory("ProxyRouterWithoutValidator");
        proxyRouter = await ProxyRouter.deploy(
            ...[
                testUsdt.address,
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001"
            ]
        );
        await proxyRouter.deployed();

        ReferralToken = await ethers.getContractFactory("ReferralToken");
        referralToken = await ReferralToken.deploy(
            ...[
                owner.address,
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

        let tx = await referralToken.transfer(referrals.address, await referralToken.balanceOf(owner.address));
        await tx.wait();

        await expect(proxyRouter.updateReferralContractAddress(referrals.address))
            .to.emit(proxyRouter, "UpdateReferralContractAddress").withArgs(referrals.address);

    })

    it("should create a Referrals contract", async function () {
    });

    it("should referral deposit", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

    });

    it("should panic FatherReferral already exists", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        try {
            const storageReferralDepositTx = await referrals.storageReferralDeposit({ value: 1 });
            await storageReferralDepositTx.wait()
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Father Referral already exists'") {
                return;
            }
        }
        throw new Error();
    });

    it("should add child referral", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

        let tx = await referrals.addNewChildReferralToFather([
            {
                childReferral: user1.address,
                fatherReferral: owner.address,
            },
        ])
        let result = await tx.wait();
        expect(result.events[0].event).to.be.equal('AddNewChildReferralToFather');
        expect(result.events[0].args[0][0].fatherReferral).to.be.equal(owner.address);
        expect(result.events[0].args[0][0].childReferral).to.be.equal(user1.address);
    });

    it("should panic on add existing child referral", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

        let tx = await referrals.addNewChildReferralToFather([
            {
                childReferral: user1.address,
                fatherReferral: owner.address,

            }
        ])
        let result = await tx.wait();
        expect(result.events[0].event, 'AddNewChildReferralToFather');
        expect(result.events[0].args[0][0].fatherReferral).to.be.equal(owner.address);
        expect(result.events[0].args[0][0].childReferral).to.be.equal(user1.address);
        try {
            const aadNewChildReferralToFather = await referrals.addNewChildReferralToFather([
                {
                    childReferral: user1.address,
                    fatherReferral: owner.address,

                }
            ]);
            await aadNewChildReferralToFather.wait()
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Child Referral already exists'") {
                return;
            }
        };
        throw new Error();

    });

    it("should update referral level father fee", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

        let tx = await referrals.updateLevelReferralFather([
            {
                "fatherReferral": owner.address,
                "newLevel": 1
            }
        ])
        let result = await tx.wait();
        expect(result.events[0].event, 'UpdateLevelReferralFather');
        expect(result.events[0].args[0][0].fatherReferral).to.be.equal(owner.address);
        expect(result.events[0].args[0][0].newLevel).to.be.equal(1);

    });

    it("should panic on update referral level father fee, father referral not exists", async function () {
        try {
            await expect(referrals.updateLevelReferralFather([
                {
                    "fatherReferral": owner.address,
                    "newLevel": 1
                }
            ]))
                .to.emit(referrals, "UpdateLevelReferralFather")
                .withArgs(
                    owner.address,
                    1
                );
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Father referral does not exist'") {
                return;
            }
        };
        throw new Error();

    });

    it("should panic on update referral level father fee, level not exists", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);
        try {
            await expect(referrals.updateLevelReferralFather([
                {
                    "fatherReferral": owner.address,
                    "newLevel": 9
                }
            ]))
                .to.emit(referrals, "UpdateLevelReferralFather")
                .withArgs(
                    owner.address,
                    1
                );
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Level does not exist'") {
                return;
            }
        };
        throw new Error();

    });

    it("should panic on update referral level father fee, caller is not ownerOrHelper", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);
        try {
            await expect(referrals.connect(user1).updateLevelReferralFather([
                {
                    "fatherReferral": owner.address,
                    "newLevel": 7
                }
            ]))
                .to.emit(referrals, "UpdateLevelReferralFather")
                .withArgs(
                    owner.address,
                    1
                );
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner or helper'") {
                return;
            }
        };
        throw new Error();

    });

    it("should calculate referral father fee", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

        let tx = await referrals.addNewChildReferralToFather([
            {
                childReferral: user1.address,
                fatherReferral: owner.address,

            }
        ])
        let result = await tx.wait();
        expect(result.events[0].args[0][0].fatherReferral).to.be.equal(owner.address);
        expect(result.events[0].args[0][0].childReferral).to.be.equal(user1.address);

        expect(await referrals.calculateReferralFatherFee(17_500, user1.address,))
            .to.equal(4375);
    });

    it("should panic on calculate referral father fee, father referral not exists", async function () {
        try {
            expect(await referrals.calculateReferralFatherFee(17_500, user1.address,))
                .to.equal(875);
        } catch (err) {
            if (err.toString() === 'AssertionError: Expected "0" to be equal 875') {
                return;
            }
        };
        throw new Error();
    });

    it("should add calculated referral father fee", async function () {
        await expect(referrals.storageReferralDeposit({ value: 1 }))
            .to.emit(referrals, "StorageReferralDeposit")
            .withArgs(
                owner.address,
                0
            );
        expect((await referrals.fatherReferralMapping(owner.address)).isPresent).to.equal(true);
        expect((await referrals.fatherReferralMapping(owner.address)).level).to.equal(0);

        let tx = await referrals.addNewChildReferralToFather([
            {
                childReferral: user1.address,
                fatherReferral: owner.address,

            }
        ])
        let result = await tx.wait();
        expect(result.events[0].args[0][0].fatherReferral).to.be.equal(owner.address);
        expect(result.events[0].args[0][0].childReferral).to.be.equal(user1.address);

        await expect(referrals.addReferralFatherFee(user1.address, 17_500))
            .to.emit(referrals, "NewReferralPayout")
            .withArgs(
                owner.address,
                user1.address,
                17_500,
            )
            .to.emit(referralToken, "Transfer")
            .withArgs(
                referrals.address,
                owner.address,
                17_500,
            );
    });

    it("should panic on add calculated referral father fee, father referral not exists", async function () {
        try {
            await expect(referrals.addReferralFatherFee(user1.address, 17_500))
                .to.emit(referrals, "NewReferralPayout")
                .withArgs(
                    owner.address,
                    user1.address,
                    17_500,
                );
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Father not found'") {
                return;
            }
        };
        throw new Error();
    });

    it("should allow to withdraw", async function () {
        const [owner] = await ethers.getSigners();
        const provider = waffle.provider;

        const balanceBefore = await provider.getBalance(referrals.address);

        await owner.sendTransaction({
            to: referrals.address,
            value: ethers.utils.parseEther("1"),
        });

        expect(await provider.getBalance(referrals.address)).to.equal(balanceBefore + ethers.utils.parseEther("1"));

        const ownerBalanceBefore = await provider.getBalance(owner.address);

        const withdrawTx = await referrals.withdraw(ethers.utils.parseEther("1"));
        // wait until the transaction is mined
        await withdrawTx.wait();

        const contractBalance = await provider.getBalance(referrals.address);
        expect(contractBalance).to.equal(0);

        const ownerBalanceAfter = await provider.getBalance(owner.address);
        expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.above(
            ethers.utils.parseEther("0.8")
        );

    });

    
	it("should allow to withdraw tokens from Referrals", async function () {
		await expect(referrals.withdrawERC20(referralToken.address, 2000))
			.to.emit(referrals, "PayoutERC20").withArgs(referralToken.address, owner.address, 2000)
            .to.emit(referralToken, "Transfer").withArgs(referrals.address, owner.address, 2000);

	});

    it("should set new root caller", async function () {
        const setNewRootCallerTx = await referrals.setNewRootCaller("0x0000000000000000000000000000000000000001");
        // wait until the transaction is mined
        await setNewRootCallerTx.wait();

        expect(await referrals.rootCaller()).to.equal("0x0000000000000000000000000000000000000001");

    });

    it("should panic on set new root caller, onlyOwner", async function () {
        try {
            const setNewRootCallerTx = await referrals.connect(user1).setNewRootCaller("0x0000000000000000000000000000000000000001");
            // wait until the transaction is mined
            await setNewRootCallerTx.wait();

            expect(await referrals.rootCaller()).to.equal("0x0000000000000000000000000000000000000001");
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                return;
            }
        };
        throw new Error();

    });

    it("should set new helper account", async function () {
        const setNewRootCallerTx = await referrals.setNewHelperAccount("0x0000000000000000000000000000000000000001");
        // wait until the transaction is mined
        await setNewRootCallerTx.wait();

        expect(await referrals.helperAccount()).to.equal("0x0000000000000000000000000000000000000001");

    });

    it("should panic on set new helper account, onlyOwner", async function () {
        try {
            const setNewRootCallerTx = await referrals.connect(user1).setNewHelperAccount("0x0000000000000000000000000000000000000001");
            // wait until the transaction is mined
            await setNewRootCallerTx.wait();

            expect(await referrals.helperAccount()).to.equal("0x0000000000000000000000000000000000000001");
        } catch (err) {
            if (err.toString() === "Error: VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'") {
                return;
            }
        };
        throw new Error();

    });

});
