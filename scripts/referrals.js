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
    let helperAccount = "0xf8E461447a3F70D368d5Eb980331C178015769a7";

    if (networkName === "bscTestnet") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else if (networkName === "bscMainnet") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else if (networkName === "polygonTestnet") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else if (networkName === "polygon") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else if (networkName === "ethTestnet") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else if (networkName === "ethMainnet") {
        let _rootCallerAddress = "0x0000000000000000000000000000000000000000"; //paste your value

        if (_rootCallerAddressInit != "0x0000000000000000000000000000000000000000") {
            _rootCallerAddress = _rootCallerAddressInit;
        }

        args =[
            [
                { level: 0, percent: 500 },
                { level: 1, percent: 700 },
                { level: 2, percent: 1_000 },
                { level: 3, percent: 1_500 },
                { level: 4, percent: 2_000 },
                { level: 5, percent: 3_000 },
                { level: 6, percent: 4_000 },
                { level: 7, percent: 5_000 },
            ],
            _rootCallerAddress,
            helperAccount
        ];
    } else {
        throw new Error("Trying to deploy to unknown network");
    }
    console.log(args);
    // console.log(await (await hre.ethers.getSigner()).getBalance())

    // Base deploy immutable
    // const Referrals = await hre.ethers.getContractFactory("Referrals");
    // const referrals = await Referrals.deploy(...args);

    // Deploying mutable
    const Referrals = await hre.ethers.getContractFactory("ReferralsUpgradable");
    const referrals = await upgrades.deployProxy(Referrals, args, {kind: "uups"});

    // Upgrading
    // const Referrals = await ethers.getContractFactory("Referrals");
    // const referrals = await upgrades.upgradeProxy("0x054ACC3f273C0963a29813BC5fcd053BA688C4d9", Referrals);

    await referrals.deployed();

    console.log("Referrals deployed to:", referrals.address);
    return referrals.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main("0x1F6AF640aa8E4fD1f35Dd973C6A51A11048c993e")
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
