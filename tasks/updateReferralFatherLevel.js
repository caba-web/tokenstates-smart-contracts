require("@nomiclabs/hardhat-web3");
// const { ethers, upgrades } = require("hardhat");
// const hre = require("hardhat");


task("updateReferralFatherLevel", "Updates referral father level")
  .addVariadicPositionalParam("data", "The UpdateLevelReferralFather objects")
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
    let data = [];
    for (let i = 0; i < taskArgs.data.length; i++) {
        data.push({
            "fatherReferral": taskArgs.data[i].substring(0, 42),
            "newLevel": Number(taskArgs.data[i].substring(42)),
        });
    }
    console.log(data);
    const Referrals = await hre.ethers.getContractFactory("Referrals");
    const referrals = Referrals.attach(referralAddress);
    const updateLevelReferralFatherTx = await referrals.updateLevelReferralFather(data, { value: 1 });
    await updateLevelReferralFatherTx.wait();

    console.log("Tx Done!");
  });

module.exports = {};