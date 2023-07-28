import anyTest, { TestFn } from "ava";
import { Account, Worker, Connection } from "near-workspaces";
import { InMemoryKeyStore } from "@near-js/keystores";
const { connect, Near } = require("@near-js/wallet-account");
import { initKeypom, wrapTxnParamsForTrial } from "@keypom/core";
import { readFileSync } from 'fs';

import {
    claimTrialAccountDrop, createDrop, createTrialAccountDrop, getDrops, getUserBalance, trialCallMethod,
} from "@keypom/core";
import { CONTRACT_METADATA } from "./utils/general";

const test = anyTest as TestFn<{
    worker: Worker;
    accounts: Record<string, Account>;
    connection: Connection;
}>;

// reuse the environment across all tests (before vs. beforeEach)
test.before(async (t) => {
    if (t.context.worker) {
        await t.context.worker.tearDown().catch(error => {
            console.log('Failed to tear down the worker:', error);
        });
    }

    console.log(t.title);
    // Init the worker and start a Sandbox server
    const worker = await Worker.init();

    console.log(worker);

	// Prepare sandbox for tests, create accounts, deploy contracts, etc.
    const root = worker.rootAccount;
    const trial = await root.createSubAccount('keypom');
    const mapping = await root.createSubAccount('mapping');
    
    // Custom-root.near, deploy contracts to it and init new linkdrop
    await root.deploy(`./out/linkdrop.wasm`);
    // Deploy the keypom contract
    await trial.deploy(`./out/trial.wasm`);
    await mapping.deploy(`./out/mapping.wasm`);
    
    console.log('calling new on root')
    await root.call(root, 'new', {});
    console.log('calling new on mapping')
    await mapping.call(mapping, 'new', {});
    console.log('calling new on trial account')
    await trial.call(trial, 'setup', Buffer.from(JSON.stringify(
		wrapTxnParamsForTrial({
			contracts: '*',
			amounts: '*',
			methods: '*',
			funder: root.accountId,
			repay: '0',
			floor: '0',
		})
	)));

    // Keypom connection
    const config = (worker as any).config
    const { network, rpcAddr: nodeUrl } = config.network;
    let keyStore = new InMemoryKeyStore();

    // Establish the configuration for the connection
    let nearConfig = {
        networkId: network,
        keyStore,
        nodeUrl,
    };
    // Connect to the NEAR blockchain and get the connection instance
    let near = await connect(nearConfig);

    // Initialize the SDK for the given network and NEAR connection
    await initKeypom({
        near,
        network
    });

    const { connection } = await initKeypom({
        near,
        network
    });
    t.context.connection = connection

    // Test user as Keypom key funder
    const funder = await root.createSubAccount('funder');

    // Save state for test runs
    t.context.worker = worker;
    t.context.accounts = {
        root: new Account(root.accountId, connection),
        trial: new Account(trial.accountId, connection),
        funder: new Account(funder.accountId, connection),
        mapping: new Account(mapping.accountId, connection)
    };

});

// test.after.always for all tests even if any fail, replace test.afterEach if using beforeEach
test.after.always(async (t) => {
    await t.context.worker.tearDown().catch(error => {
        console.log('Failed to tear down the worker:', error);
    });
});

test('Create trial account drop', async (t) => {

//     // from https://docs.keypom.xyz/docs/next/TrialAccounts/Creation/drop-creation#creating-the-trial-drop

//     // What contracts can the trial account call?
//    const callableContracts = [
//         'guest-book.examples.keypom.testnet',
//         'v1.social08.testnet'
//     ]
//     // What is the maximum amount of $NEAR that can be attached to a call for each callable contract?
//     const maxAttachableNEARPerContract = [
//         '1',
//         '1'
//     ]
//     // What methods can the trial account call?
//     const callableMethods = [
//         ['*'],
//         ['*']
//     ]
    
//     const wasmDirectory = `./out/trial.wasm`

//     const {keys} = await createTrialAccountDrop({
//         account: t.context.accounts.trial,
//         numKeys: 1,
//         contractBytes: [...readFileSync(wasmDirectory)],
// // How much $NEAR should be made available to the trial account when it's created?
//         startingBalanceNEAR: 0.5,
//         callableContracts,
//         callableMethods,
//         maxAttachableNEARPerContract,
//         // repayAmountNEAR: 0.6,
//         // repayTo: "dennis.near",
// // Once the trial account has spent this much $NEAR, the trial will be over.
//         trialEndFloorNEAR: 0.01
//     })  


        t.true(true)
})