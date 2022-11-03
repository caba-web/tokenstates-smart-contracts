const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");

describe("TSCoin", function () {
	it("should create a TSCoin contract", async function () {
		const TSCoin = await ethers.getContractFactory("TSCoin");
		const tsCoin = await TSCoin.deploy(
			...[
				"0x0000000000000000000000000000000000000001",
				"TS",
                "TsDS",
                18,
                2000000000000000,
                "0x0000000000000000000000000000000000000001"
			]
		);
		await tsCoin.deployed();
	});

});