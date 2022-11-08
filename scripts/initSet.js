// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();

    const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouterUpgradeable");
    const proxyRouter = ProxyRouter.attach("0x97eb8b6aB86AbE13347de0EaFFcBd62fD8b87D25");
    const ReferralToken = await hre.ethers.getContractFactory("ReferralToken");
    const referralToken = ReferralToken.attach("0x0A3b2Bef13fEb27b0DD62A83BC07C28395609a58");
    let referralAddress = "0x0cAfC31298748dAE2ae6A794bc6d34f3b07e42Cc";
    let tsCoinAddress = "0x7b70F0bDDDc069d2aaac8c20490752d6AdbdEFaf";
 
    let tx = await referralToken.transfer(referralAddress, await referralToken.balanceOf(owner.address));
    await tx.wait();

    DECIMAL = ethers.BigNumber.from(10).pow(18)

    let tx1 = await proxyRouter.createToken(tsCoinAddress, [
        100, 1767801720, 1777801720, ethers.BigNumber.from(480000).mul(DECIMAL), 0,
        1757801720, 0, 0, true, false, false
    ]);
    await tx1.wait();

    await expect(proxyRouter.updateReferralContractAddress(referralAddress))
        .to.emit(proxyRouter, "UpdateReferralContractAddress").withArgs(referralAddress);

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
