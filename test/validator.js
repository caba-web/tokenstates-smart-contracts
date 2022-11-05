const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");

describe("Validator", function () {
	it("should create a Validator contract", async function () {
		const Validator = await ethers.getContractFactory("Validator");
		const validator = await Validator.deploy(
			...[
				"0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001"
			]
		);
		await validator.deployed();
	});

});