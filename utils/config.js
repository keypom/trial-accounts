const { parseSeedPhrase } = require('near-seed-phrase');
let contractFromProcess = process.env.REACT_APP_CONTRACT_ID
const fundingSeedPhrase = process.env.REACT_APP_FUNDING_SEED_PHRASE
if (fundingSeedPhrase) {
	const { publicKey, secretKey } = parseSeedPhrase(process.env.REACT_APP_FUNDING_SEED_PHRASE)
	contractFromProcess = publicKey
}

const contractName = contractFromProcess || 'testnet';

module.exports = function getConfig(network = process.env.REACT_APP_NETWORK_ID || 'testnet') {
	let config = {
		networkId: "testnet",
		nodeUrl: "https://rpc.testnet.near.org",
		walletUrl: "https://testnet.mynearwallet.com",
		helperUrl: "https://helper.testnet.near.org",
		contractName,
	};

	switch (network) {
		case 'testnet':
			config = {
				...config,
				explorerUrl: "https://explorer.testnet.near.org",
				GAS: "200000000000000",
				gas: "200000000000000",
				attachedDeposit: '10000000000000000000000', // 0.01 N (1kb storage)
				NEW_ACCOUNT_AMOUNT: '1000000000000000000000000',
				NEW_CONTRACT_AMOUNT: '5000000000000000000000000',
				contractId: contractName,
				isBrowser: new Function("try {return this===window;}catch(e){ return false;}")()
			};
			break;

		case 'mainnet':
			config = {
				...config,
				networkId: "mainnet",
				nodeUrl: "https://rpc.mainnet.near.org",
				walletUrl: "https://app.mynearwallet.com",
				helperUrl: "https://helper.near.org",
				explorerUrl: "https://explorer.near.org",
				GAS: "200000000000000",
				gas: "200000000000000",
				attachedDeposit: '10000000000000000000000', // 0.01 N (1kb storage)
				NEW_ACCOUNT_AMOUNT: '1000000000000000000000000',
				NEW_CONTRACT_AMOUNT: '5000000000000000000000000',
				contractId: contractName,
				isBrowser: new Function("try {return this===window;}catch(e){ return false;}")()
			};
			break;
	}
	return config;
};
