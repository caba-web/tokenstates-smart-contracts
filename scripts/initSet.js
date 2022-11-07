// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();

    const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouterUpgradable");
    const proxyRouter = ProxyRouter.attach("0x1F6AF640aa8E4fD1f35Dd973C6A51A11048c993e");
    let referralAddress = "0xBeAdde56C07a2c9707AeF1a78bE707a4EC46DC21";
    let gamesPoolAddress = "0x2B6afaE55024320ee772DBa1cE80FA0Ca2E857ed";
    let megaDiceAddress = "0xb15d2FE6C9320F4BAb4C5D2B8cF7962176D91E87";

    const Referrals = await hre.ethers.getContractFactory("ReferralsUpgradable");
    let referrals = Referrals.attach(referralAddress);

    const updateGamesPoolContractAddressTx = await proxyRouter.updateGamesPoolContractAddress(gamesPoolAddress);
    await updateGamesPoolContractAddressTx.wait();
    const updateReferralContractAddressTx = await proxyRouter.updateReferralContractAddress(referralAddress);
    await updateReferralContractAddressTx.wait();

    const setNewHelperAccountTx = await referrals.setNewHelperAccount("0xf8E461447a3F70D368d5Eb980331C178015769a7");
    await setNewHelperAccountTx.wait();

    let game = {
        name: "megadice",
        gameAddress: megaDiceAddress,
        transactionFee: {
            currentFee: 300,
            nextFee: 0,
            startTime: 0
        }
    };
    await owner.sendTransaction({
        to: gamesPoolAddress,
        value: ethers.utils.parseEther("0.2"),
    });

    const updateGameTx = await proxyRouter.updateGame(game);
    await updateGameTx.wait();
    console.log("Init Done!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
