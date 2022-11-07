// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");


async function main(_rootCallerAddressInit = "0x0000000000000000000000000000000000000000") {
	const networkName = hre.network.name;

	let args;

	const winCoeff = 50;

	if (networkName === "bscTestnet") {
		const _vrfSubscriptionId = 111732323; //paste your value
		let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

		if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
			_rootCallerAddress = _rootCallerAddressInit;
		}

		args = [
			_vrfSubscriptionId,
			"0x6A2AAd07396B36Fe02a22b33cf443582f682c82f",
			_rootCallerAddress,
			"0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314",
			400,
            9700
		];
	} else if (networkName === "bscMainnet") {
		const _vrfSubscriptionId = 111732323; //paste your value
		let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

		if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
			_rootCallerAddress = _rootCallerAddressInit;
		}

		args = [
			_vrfSubscriptionId,
			"0xc587d9053cd1118f25F645F9E08BB98c9712A4EE",
			_rootCallerAddress,
			"0x17cd473250a9a479dc7f234c64332ed4bc8af9e8ded7556aa6e66d83da49f470",
			400,
            9700
		];
	} else {
		throw new Error("Trying to deploy to unknown network");
	}
	console.log(args);
	console.log(networkName)
	console.log(await (await hre.ethers.getSigner()).getBalance())

	// Base deploy immutable
	// const MegaDice = await hre.ethers.getContractFactory("MegaDice");
	// const megaDice = await MegaDice.deploy(...args);

	// Deploying mutable
	// const MegaDice = await hre.ethers.getContractFactory("MegaDiceUpgradable");
	// const megaDice = await upgrades.deployProxy(MegaDice, args, { kind: "uups" });

	// Upgrading
	const MegaDiceUpgradable = await ethers.getContractFactory("MegaDiceUpgradable");
	const megaDice = await upgrades.upgradeProxy("0xb15d2FE6C9320F4BAb4C5D2B8cF7962176D91E87", MegaDiceUpgradable,  { kind: "uups" });

	await megaDice.deployed();

	// const updateCoordinatorAddressTx = await megaDice.updateCoordinatorAddress("0x7a1bac17ccc5b313516c5e16fb24f7659aa5ebed", {value: 0});
    // await updateCoordinatorAddressTx.wait();

	console.log("MegaDice deployed to:", megaDice.address);
	return megaDice.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main("0x1F6AF640aa8E4fD1f35Dd973C6A51A11048c993e")
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
