// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const Referrals = await hre.ethers.getContractFactory("Referrals");
    const referrals = Referrals.attach("0xC4D1052B060d8fC29aB231E2144F285869C4475b");
    const bet = 1;
    const tx = await referrals.storageReferralDeposit();
    await tx.wait();
    console.log("Tx Done!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
