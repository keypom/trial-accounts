import anyTest, { TestFn } from "ava";
import {
    claimTrialAccountDrop, createDrop, createTrialAccountDrop, getDrops, getUserBalance, trialCallMethod,
} from "@keypom/core";
import { parseNearAmount } from '@near-js/utils';
import { NearAccount, Worker } from "near-workspaces";
import { CONTRACT_METADATA, initKeypomConnection } from "./utils/general";
const { readFileSync } = require('fs');

const test = anyTest as TestFn<{
    worker: Worker;
    accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
    if (t.context.worker) {
        await t.context.worker.tearDown().catch(error => {
            console.log('Failed to tear down the worker:', error);
        });
    }

    console.log(t.title);
    // Init the worker and start a Sandbox server
    const worker = await Worker.init();
    
    // // Prepare sandbox for tests, create accounts, deploy contracts, etc.
    const root = worker.rootAccount;
    const keypom = await root.createSubAccount('keypom');
    const mapping = await root.createSubAccount('mapping');
    
    // // Custom-root.near, deploy contracts to it and init new linkdrop
    await root.deploy(`./out/linkdrop.wasm`);
    // // Deploy the keypom contract.
    await keypom.deploy(`./out/trial.wasm`);
    await mapping.deploy(`./out/mapping.wasm`);
    
    // // Init empty/default linkdrop contract
    console.log('calling new on root')
    await root.call(root, 'new', {});
    // // Init the contract
    console.log('calling new on keypom')
    await keypom.call(keypom, 'new', {root_account: 'testnet', owner_id: keypom, contract_metadata: CONTRACT_METADATA});
    console.log('calling new on mapping')
    await mapping.call(mapping, 'new', {});

    // // Test users
    // const funder = await root.createSubAccount('funder');

    // // Save state for test runs
    // t.context.worker = worker;
    // t.context.accounts = { root, keypom, funder, mapping };
    // t.context.rpcPort = rpcPort;
});

test.serial('something', t => {
    t.true(true);
})

// If the environment is reused, use test.after to replace test.afterEach
test.afterEach.always(async t => {
    await t.context.worker.tearDown().catch(error => {
        console.log('Failed to tear down the worker:', error);
    });
});

//testing drop empty initialization and that default values perform as expected
test('Claim trial account drop', async t => {
    const {keypom, funder, mapping} = t.context.accounts;
    const rpcPort = t.context.rpcPort;
    await initKeypomConnection(rpcPort, funder);

    const callableContracts = [
        `mapping.test.near`,
        `keypom.test.near`,
    ]

    const {keys} 
    //@ts-ignore
    = await createTrialAccountDrop({
        numKeys: 1,
        contractBytes: [...readFileSync('./out/trial.wasm')],
        startingBalanceNEAR: 1,
        callableContracts: callableContracts,
        callableMethods: ['*', 'add_to_balance'],
        maxAttachableNEARPerContract: callableContracts.map(() => '1'),
        trialEndFloorNEAR: (1 + 0.3) - 0.5,
        config: {
            dropRoot: `test.near`
        }
    })

    const trialAccountId = `trial.test.near`
    const trialAccountSecretKey = keys!.secretKeys[0]
    await claimTrialAccountDrop({
        secretKey: keys!.secretKeys[0],
        desiredAccountId: trialAccountId
    })

    const balBefore = await getUserBalance({
        accountId: trialAccountId
    })
    console.log('balBefore: ', balBefore)

    await trialCallMethod({
        trialAccountId,
        trialAccountSecretKey,
        contractId: `keypom.test.near`,
        methodName: `add_to_balance`,
        args: '',
        attachedDeposit: parseNearAmount("0.1")!,
        attachedGas: '10000000000000'
    })

    const balAfter = await getUserBalance({
        accountId: trialAccountId
    })
    console.log('balAfter: ', balAfter)

    // //@ts-ignore
    // const drops = await getDrops({
    //     accountId: funder.accountId,
    // })
    // console.log('drops: ', drops)
});