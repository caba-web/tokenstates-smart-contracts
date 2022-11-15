// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");


async function main(proxyRouterAddress = "0x0000000000000000000000000000000000000000") {
	const networkName = hre.network.name;

	let args = [
		proxyRouterAddress,
		"TS Hotel Montenegro",
		"tsHM",
		18,
		480000,
		proxyRouterAddress
	];

	if (networkName === "bscTestnet") {
		
	} else if (networkName === "bsc") {
		
	} else {
		throw new Error("Trying to deploy to unknown network");
	}
	console.log(args);
	console.log(networkName)
	console.log(await (await hre.ethers.getSigner()).getBalance())

	// Base deploy immutable
	const TSCoin = await hre.ethers.getContractFactory("TSCoin");
	const tsCoin = await TSCoin.deploy(...args);

	await tsCoin.deployed();

	console.log("TSCoin deployed to:", tsCoin.address);
	return tsCoin.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main("0x5f08c8D3Cd8Ee8FF60bBB39a5310bd1384bc427A")
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
