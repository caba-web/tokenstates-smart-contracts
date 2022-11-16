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
            "0xB425dA01b4A353fF9f36f6Cae4acD32911046fE5",
            "0x0000000000000000000000000000000000000000", //paste your value
        ];
    } else if (networkName === "bsc") {
        args = [
            "0x55d398326f99059ff775485246999027b3197955",
            "0x0000000000000000000000000000000000000000", //paste your value
        ];
    } else {
        throw new Error("Trying to deploy to unknown network");
    }
    console.log(args);
    // console.log(await (await hre.ethers.getSigner()).getBalance())

    // Base deploy immutable
    const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouter");
    const proxyRouter = await ProxyRouter.deploy(...args);

    // Deploying mutable
    // const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouterUpgradeable");
    // const proxyRouter = await upgrades.deployProxy(ProxyRouter, args, {kind: "uups"});

    // Upgrading
    // const ProxyRouter = await ethers.getContractFactory("ProxyRouterUpgradeable");
    // const proxyRouter = await upgrades.upgradeProxy("0x97eb8b6aB86AbE13347de0EaFFcBd62fD8b87D25", ProxyRouter);

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
