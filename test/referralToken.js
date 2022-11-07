const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");

describe("ReferralToken", function () {
	it("should create a ReferralToken contract", async function () {
		const ReferralToken = await ethers.getContractFactory("ReferralToken");
		const referralToken = await ReferralToken.deploy(
			...[
				"0x0000000000000000000000000000000000000001",
				"TS",
                "TsDS",
                18,
                2000000000000000
			]
		);
		await referralToken.deployed();
	});

});