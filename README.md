# TokenStates smart contracts

Deployment procedure to BSC Mainnet:
0. Run `npm install` if you already didn't do that. And `npm install --save-dev @openzeppelin/hardhat-upgrades`
1. Paste your private key in .env as "MNEMONIC"
2. Setup right rpc urls, check if exact that rpc contains info about your account (ex. getBalance method)
3. Run `npx hardhat run scripts/proxyRouter.js --network bscTestnet`
4. Put contract address into that file so that is it trackable
5. Setup your chain scan apiKey in .env as "ETHER_SCAN_API_KEY" for verifing. Run `npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"`
6. It is ready to go!

**BscTestnet Addresses**
1. ProxyRouter: **0x071a03D627B6989680479290610A6e48b96f7f80**
2. TSCoin: **0x6a54278cD9D9b89697aD94Fea252dF9b5164f952**
3. Referrals: **0x0000000000000000000000000000000000000001**
4. Validator: **0xc8d19f84Dde751ddA76A0479d14230cee3912D97**
