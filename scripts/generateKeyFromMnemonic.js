const ethers = require('ethers');
let mnemonic = "YOUR MNEMONIC";
let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);
console.log(mnemonicWallet.privateKey, mnemonicWallet.address);