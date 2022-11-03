const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");

describe("Referrals", function () {
	it("should create a Referrals contract", async function () {
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
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
			]
		);
		await referrals.deployed();
	});

});