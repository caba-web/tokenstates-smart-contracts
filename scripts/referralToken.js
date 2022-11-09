// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");


async function main() {
	const networkName = hre.network.name;

    [owner] = await hre.ethers.getSigners();

	let args = [
        owner.address,
        "TS Referral",
        "tsREF",
        18,
        2000000000000000
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
	const ReferralToken = await hre.ethers.getContractFactory("ReferralToken");
	const referralToken = await ReferralToken.deploy(...args);

	await referralToken.deployed();

	console.log("ReferralToken deployed to:", referralToken.address);
	return referralToken.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
