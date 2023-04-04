import anyTest, { TestFn } from "ava";
import { claimTrialAccountDrop, createDrop, createTrialAccountDrop, getDrops, getUserBalance, parseNearAmount, trialCallMethod } from "keypom-js";
import { Account, Near } from "near-api-js";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { NearAccount, Worker } from "near-workspaces";
import { CONTRACT_METADATA, initKeypomConnection } from "./utils/general";
const { readFileSync } = require('fs');

const test = anyTest as TestFn<{
    worker: Worker;
    accounts: Record<string, NearAccount>;
    rpcPort: string;
  }>;

test.beforeEach(async (t) => {
    console.log(t.title);
    // Init the worker and start a Sandbox server
    const worker = await Worker.init();

    const rpcPort = (worker as any).config.rpcAddr
    console.log(`rpcPort: `, rpcPort)
    
    // Prepare sandbox for tests, create accounts, deploy contracts, etc.
    const root = worker.rootAccount;
    
    const keypom = await root.createSubAccount('keypom');
    const mapping = await root.createSubAccount('mapping');

    const network = 'sandbox';
    let networkConfig = {
        networkId: 'localnet',
        viewAccountId: 'test.near',
        nodeUrl: rpcPort,
        walletUrl: `https://wallet.${network}.near.org`,
		helperUrl: `https://helper.${network}.near.org`,
	};

    const keyStore =  new InMemoryKeyStore();
    const near = new Near({
        ...networkConfig,
        keyStore,
        headers: {}
    });

    const signerId = "test.near";
    const account = new Account(near.connection, signerId);
    const { provider } = account.connection;

    const key = await root.getKey();

    const queryUrl = `access_key/${signerId}/${key!.getPublicKey().toString()}`;

    const accessKey: any = await provider.query(
        queryUrl,
        ""
    );
    console.log(`accessKey: ${JSON.stringify(accessKey)}`)
    
    // // Custom-root.near, deploy contracts to it and init new linkdrop
    // await root.deploy(`./out/linkdrop.wasm`);
    // // Deploy the keypom contract.
    // await keypom.deploy(`./out/keypom.wasm`);
    // await mapping.deploy(`./out/mapping.wasm`);
    
    // // Init empty/default linkdrop contract
    // await root.call(root, 'new', {});
    // // Init the contract
    // await keypom.call(keypom, 'new', {root_account: 'testnet', owner_id: keypom, contract_metadata: CONTRACT_METADATA});
    // await mapping.call(mapping, 'new', {});

    // // Test users
    // const funder = await root.createSubAccount('funder');

    // Save state for test runs
    t.context.worker = worker;
    t.context.accounts = { root, keypom, mapping };
    t.context.rpcPort = rpcPort;
});

// If the environment is reused, use test.after to replace test.afterEach
test.afterEach(async t => {
    await t.context.worker.tearDown().catch(error => {
        console.log('Failed to tear down the worker:', error);
    });
});

//testing drop empty initialization and that default values perform as expected
test('Claim trial account drop', async t => {
//     const {keypom, funder, mapping} = t.context.accounts;
//     const rpcPort = t.context.rpcPort;
//     await initKeypomConnection(rpcPort, funder);

//     const callableContracts = [
//         `mapping.test.near`,
//         `keypom.test.near`,
//     ]

//     const {keys} 
//     //@ts-ignore
//     = await createTrialAccountDrop({
//         numKeys: 1,
//         contractBytes: [...readFileSync('./out/trial.wasm')],
//         startingBalanceNEAR: 1,
//         callableContracts: callableContracts,
//         callableMethods: ['*', 'add_to_balance'],
//         maxAttachableNEARPerContract: callableContracts.map(() => '1'),
//         trialEndFloorNEAR: (1 + 0.3) - 0.5,
//         config: {
//             dropRoot: `test.near`
//         }
//     })

//     const trialAccountId = `trial.test.near`
//     const trialAccountSecretKey = keys!.secretKeys[0]
//     await claimTrialAccountDrop({
//         secretKey: keys!.secretKeys[0],
//         desiredAccountId: trialAccountId
//     })

//     const balBefore = await getUserBalance({
//         accountId: trialAccountId
//     })
//     console.log('balBefore: ', balBefore)

//     await trialCallMethod({
//         trialAccountId,
//         trialAccountSecretKey,
//         contractId: `keypom.test.near`,
//         methodName: `add_to_balance`,
//         args: '',
//         attachedDeposit: parseNearAmount("0.1")!,
//         attachedGas: '10000000000000'
//     })

//     const balAfter = await getUserBalance({
//         accountId: trialAccountId
//     })
//     console.log('balAfter: ', balAfter)

//     // //@ts-ignore
//     // const drops = await getDrops({
//     //     accountId: funder.accountId,
//     // })
//     // console.log('drops: ', drops)
});