require("@nomiclabs/hardhat-web3");
// const { ethers, upgrades } = require("hardhat");
// const hre = require("hardhat");


task("storageReferralDepositAdmin", "Adds referral deposit to father's account")
  .addVariadicPositionalParam("data", "The Fathers list")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name;

    let referralAddress;

    if (networkName === "bscTestnet") {
        referralAddress = "0x0000000000000000000000000000000000000000"; //paste your value

    } else if (networkName === "bsc") {
        referralAddress = "0x0000000000000000000000000000000000000000"; //paste your value

    } else if (networkName === "polygonTestnet") {
        referralAddress = "0xC4D1052B060d8fC29aB231E2144F285869C4475b"; //paste your value

    } else if (networkName === "polygonMainnet") {
        referralAddress = "0x0000000000000000000000000000000000000000"; //paste your value

    } else if (networkName === "ethTestnet") {
        referralAddress = "0x0000000000000000000000000000000000000000"; //paste your value

    } else if (networkName === "ethMainnet") {
        referralAddress = "0x0000000000000000000000000000000000000000"; //paste your value

    } else {
        throw new Error("Trying to deploy to unknown network");
    }
    console.log(taskArgs);
    const Referrals = await hre.ethers.getContractFactory("Referrals");
    const referrals = Referrals.attach(referralAddress);
    const storageReferralDepositAdminTx = await referrals.storageReferralDepositAdmin(taskArgs.data, { value: 1 });
    await storageReferralDepositAdminTx.wait();

    console.log("Tx Done!");
  });

module.exports = {};