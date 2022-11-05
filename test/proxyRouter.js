const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");

describe("ProxyRouter", function () {
	it("should create a ProxyRouter contract", async function () {
		const ProxyRouter = await ethers.getContractFactory("ProxyRouter");
		const proxyRouter = await ProxyRouter.deploy(
			...[
				"0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001"
			]
		);
		await proxyRouter.deployed();
	});

});