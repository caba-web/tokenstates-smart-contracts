// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");


async function main() {
    const networkName = hre.network.name;

    let args;

    if (networkName === "bscTestnet") {
        args = [
            "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            "0x0000000000000000000000000000000000000000", //paste your value
            "0x0000000000000000000000000000000000000000" //paste your value
        ];
    } else if (networkName === "bscMainnet") {
        args = [
            "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            "0x0000000000000000000000000000000000000000", //paste your value
            "0x0000000000000000000000000000000000000000" //paste your value
        ];
    } else {
        throw new Error("Trying to deploy to unknown network");
    }
    console.log(args);
    // console.log(await (await hre.ethers.getSigner()).getBalance())

    // Base deploy immutable
    // const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouter");
    // const proxyRouter = await ProxyRouter.deploy(...args);

    // Deploying mutable
    const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouterUpgradable");
    const proxyRouter = await upgrades.deployProxy(ProxyRouter, args, {kind: "uups"});

    // Upgrading
    // const ProxyRouter = await ethers.getContractFactory("ProxyRouterUpgradable");
    // const proxyRouter = await upgrades.upgradeProxy("0x1F6AF640aa8E4fD1f35Dd973C6A51A11048c993e", ProxyRouter);

    await proxyRouter.deployed();

    console.log("ProxyRouter deployed to:", proxyRouter.address);
    return proxyRouter.address, proxyRouter;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
