// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");


async function main(proxyRouterAddress = "0x0000000000000000000000000000000000000000") {
	const networkName = hre.network.name;
    let args;

	if (networkName === "bscTestnet") {
        args = [
            "0xB425dA01b4A353fF9f36f6Cae4acD32911046fE5",
            proxyRouterAddress, //paste your value
        ];
    } else if (networkName === "bsc") {
        args = [
            "0x55d398326f99059ff775485246999027b3197955",
            proxyRouterAddress, //paste your value
        ];
    } else {
        throw new Error("Trying to deploy to unknown network");
    }
	console.log(args);
	console.log(networkName)
	console.log(await (await hre.ethers.getSigner()).getBalance())

	// Base deploy immutable
    // const Validator = await hre.ethers.getContractFactory("Validator");
    // const validator = await Validator.deploy(...args);

    // Deploying mutable
    // const Validator = await hre.ethers.getContractFactory("ValidatorUpgradeable");
    // const validator = await upgrades.deployProxy(Validator, args, {kind: "uups"});

    // Upgrading
    const Validator = await ethers.getContractFactory("ValidatorUpgradeable");
    const validator = await upgrades.upgradeProxy("0x7c70c6740c2715a03c329b0503bc935d424d3166", Validator);


	await validator.deployed();

	console.log("Validator deployed to:", validator.address);
	return validator.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main("0x5f08c8D3Cd8Ee8FF60bBB39a5310bd1384bc427A")
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
