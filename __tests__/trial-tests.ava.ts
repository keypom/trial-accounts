import anyTest, { TestFn } from "ava";
import { claimTrialAccountDrop, createDrop, createTrialAccountDrop, getDrops, getUserBalance, parseNearAmount, trialCallMethod } from "keypom-js";
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
    
    //const keypom = await root.createSubAccount('keypom');
    const mapping = await root.createSubAccount('mapping');
    
    // Custom-root.near, deploy contracts to it and init new linkdrop
    await root.deploy(`./out/linkdrop.wasm`);
    // Deploy the keypom contract.
    //await keypom.deploy(`./out/keypom.wasm`);
    await mapping.deploy(`./out/mapping.wasm`);
    
    // Init empty/default linkdrop contract
    await root.call(root, 'new', {});
    // Init the contract
    //await keypom.call(keypom, 'new', {root_account: 'testnet', owner_id: keypom, contract_metadata: CONTRACT_METADATA});
    await mapping.call(mapping, 'new', {});

    // Test users
    const funder = await root.createSubAccount('funder');

    // Save state for test runs
    t.context.worker = worker;
    t.context.accounts = { root, funder, mapping };
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
    const {keypom, funder, mapping} = t.context.accounts;
    const rpcPort = t.context.rpcPort;
    
    //let key = await funder.getKey()

    let mappingBal = await mapping.balance();
    console.log('available before: ', mappingBal.available.toString())
    console.log('staked before: ', mappingBal.staked.toString())
    console.log('state staked before: ', mappingBal.stateStaked.toString())
    console.log('total before: ', mappingBal.total.toString())


    await mapping.call(mapping, 'store_contract_data', {});
    const res = await mapping.view('get_contract_data', {});
    console.log('res: ', res)

    mappingBal = await mapping.balance();
    console.log('available after: ', mappingBal.available.toString())
    console.log('staked after: ', mappingBal.staked.toString())
    console.log('state staked after: ', mappingBal.stateStaked.toString())
    console.log('total after: ', mappingBal.total.toString())

    // //@ts-ignore
    // const drops = await getDrops({
    //     accountId: funder.accountId,
    // })
    // console.log('drops: ', drops)
});