import { main as proxyRouterMain } from './proxyrouter';
import { main as gamesPoolMain } from './gamespool';
import { main as referralsMain } from './referrals';
import { main as megaDiceMain } from './megadice';

const { ethers } = require("hardhat");
const hre = require("hardhat");


async function main() {
    const [owner] = await ethers.getSigners();

    let proxyRouterAddress, proxyRouter = proxyRouterMain();
    let referralAddress = referralsMain(proxyRouterAddress);
    let gamesPoolAddress = gamesPoolMain(proxyRouterAddress);
    let megaDiceAddress = megaDiceMain(proxyRouterAddress);
    const updateGamesPoolContractAddressTx = await proxyRouter.updateGamesPoolContractAddress(gamesPoolAddress);
    await updateGamesPoolContractAddressTx.wait();
    const updateReferralContractAddressTx = await proxyRouter.updateReferralContractAddress(referralAddress);
    await updateReferralContractAddressTx.wait();
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
    console.log("Depoyment Done!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
