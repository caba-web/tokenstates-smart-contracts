// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();

    const ProxyRouter = await hre.ethers.getContractFactory("ProxyRouter");
    const proxyRouter = ProxyRouter.attach("0x5f08c8D3Cd8Ee8FF60bBB39a5310bd1384bc427A");
    let tsCoinAddress = "0xD04b2388BcC8ab4406A8EEf9A9540e225C0f9f28";
 
    DECIMAL = ethers.BigNumber.from(10).pow(18)

    console.log(ethers.BigNumber.from(480000 - 5118).mul(DECIMAL) + ethers.BigNumber.from(5118).mul(DECIMAL))

    let tx1 = await proxyRouter.createToken(tsCoinAddress, [
        100, 1767801720, 1777801720, ethers.BigNumber.from(480000 - 5118).mul(DECIMAL), ethers.BigNumber.from(5118).mul(DECIMAL),
        1685453328, 0, 0, true, false, false
    ]);
    await tx1.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
