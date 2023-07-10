import { initKeypom } from "keypom-js";
import { Near } from "near-api-js";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { AccountBalance, BN, KeyPair, NEAR, NearAccount, TransactionResult } from "near-workspaces";
import { formatNearAmount } from "near-api-js/lib/utils/format";

export const DEFAULT_GAS: string = "30000000000000";
export const LARGE_GAS: string = "300000000000000";
export const WALLET_GAS: string = "100000000000000";
export const DEFAULT_DEPOSIT: string = "1000000000000000000000000";
export const GAS_PRICE: BN = new BN("100000000");
export const DEFAULT_TERRA_IN_NEAR: string = "3000000000000000000000";
export const CONTRACT_METADATA = {
  "version": "1.0.0",
  "link": "https://github.com/mattlockyer/proxy/commit/71a943ea8b7f5a3b7d9e9ac2208940f074f8afba",
}

export async function functionCall({
  signer,
  receiver,
  methodName,
  args,
  attachedDeposit,
  gas,
  shouldLog = true,
  shouldPanic = false
}: {
  signer: NearAccount,
  receiver: NearAccount,
  methodName: string,
  args: any,
  attachedDeposit?: string,
  gas?: string,
  shouldLog?: boolean,
  shouldPanic?: boolean
}) {
  let rawValue = await signer.callRaw(receiver, methodName, args, {gas: gas || LARGE_GAS, attachedDeposit: attachedDeposit || "0"});
  parseExecutionResults(methodName, receiver.accountId, rawValue, shouldLog, shouldPanic);

  if (rawValue.SuccessValue) {
    return atob(rawValue.SuccessValue);
  } else {
    return rawValue.Failure?.error_message
  }
}

export const displayBalances = (initialBalances: AccountBalance, finalBalances: AccountBalance) => {
  const initialBalancesNear = {
    available: formatNearAmount(initialBalances.available.toString()),
    staked: formatNearAmount(initialBalances.staked.toString()),
    stateStaked: formatNearAmount(initialBalances.stateStaked.toString()),
    total: formatNearAmount(initialBalances.total.toString()),
  };
  
  const finalBalancesNear = {
    available: formatNearAmount(finalBalances.available.toString()),
    staked: formatNearAmount(finalBalances.staked.toString()),
    stateStaked: formatNearAmount(finalBalances.stateStaked.toString()),
    total: formatNearAmount(finalBalances.total.toString()),
  };

  let isMoreState = false;
  if(new BN(initialBalances.stateStaked.toString()).lt(new BN(finalBalances.stateStaked.toString()))) {
    let temp = initialBalances.stateStaked;
    initialBalances.stateStaked = finalBalances.stateStaked;
    finalBalances.stateStaked = temp;
    isMoreState = true;
  }

  console.log(`Available: ${initialBalancesNear.available.toString()} -> ${finalBalancesNear.available.toString()}`)
  console.log(`Staked: ${initialBalancesNear.staked.toString()} -> ${finalBalancesNear.staked.toString()}`)
  console.log(`State Staked: ${initialBalancesNear.stateStaked.toString()} -> ${finalBalancesNear.stateStaked.toString()}`)
  console.log(`Total: ${initialBalancesNear.total.toString()} -> ${finalBalancesNear.total.toString()}`)
  console.log(``)
  console.log(`NET:`)
  console.log(`Available: ${formatNearAmount(new BN(finalBalances.available.toString()).sub(new BN(initialBalances.available.toString())).toString())}`)
  console.log(`Staked: ${formatNearAmount(new BN(finalBalances.staked.toString()).sub(new BN(initialBalances.staked.toString())).toString())}`)
  console.log(`State Staked ${isMoreState ? "(more)" : "(less)"}: ${formatNearAmount(new BN(initialBalances.stateStaked.toString()).sub(new BN(finalBalances.stateStaked.toString())).toString())}`)
  console.log(`Total: ${formatNearAmount(new BN(finalBalances.total.toString()).sub(new BN(initialBalances.total.toString())).toString())}`)
}

export async function initKeypomConnection(
  rpcPort: string,
  funder: NearAccount
) {
  console.log("init keypom connection")
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

    const funderKey = (await funder.getKey())?.toString()
    console.log(`funderKey: `, funderKey)
    await initKeypom({
        near,
        network: "localnet",
        funder: {
            accountId: funder.accountId,
            secretKey: funderKey
        }
    })
}

export function parseExecutionResults(
  methodName: string,
  receiverId: string,
  transaction: TransactionResult,
  shouldLog: boolean,
  shouldPanic: boolean
) {
  let logString = `Logs For ${methodName} on ${receiverId}:\n`;

  let didPanic = false;
  let panicMessages: string[] = [];

  // Loop through each receipts_outcome in the transaction's result field
  transaction.result.receipts_outcome.forEach((receipt) => {   
    const logs = receipt.outcome.logs;
    if (logs.length > 0) {
      // Turn logs into a string
      const logs = receipt.outcome.logs.reduce((acc, log) => {
        return acc.concat(log).concat('\n')
      }, '');
      logString += logs;
    } else {
      logString += '\n';
    }
    
    const status = (receipt.outcome.status as any);
    if (status.Failure) {
      let failure = status.Failure.ActionError;
      let str = `Failure for method: ${methodName} Failure: ${JSON.stringify(failure)}`
      console.log(str)

      panicMessages.push(str);
      didPanic = true;
    }
  })
  
  const styles = [
    'color: green',
  ].join(';');

  if (shouldLog) {
    console.log('%c%s', styles, logString);
  }

  if (shouldPanic && !didPanic) {
    throw new Error(`Expected failure for method: ${methodName}`)
  }

  if (!shouldPanic && didPanic) {
    throw new Error(panicMessages.join('\n'));    
  }
}

export async function generateKeyPairs(
  numKeys: number,
): Promise<{ keys: KeyPair[]; publicKeys: string[] }> {
  // Generate NumKeys public keys
  let kps: KeyPair[] = [];
  let pks: string[] = [];
  for (let i = 0; i < numKeys; i++) {
    let keyPair = await KeyPair.fromRandom('ed25519');
    kps.push(keyPair);
    pks.push(keyPair.getPublicKey().toString());
  }
  return {
    keys: kps,
    publicKeys: pks
  }
}

export function defaultCallOptions(
  gas: string = DEFAULT_GAS,
  attached_deposit: string = DEFAULT_DEPOSIT
) {
  return {
    gas: new BN(gas),
    attachedDeposit: new BN(attached_deposit),
  };
}

// export function assertBalanceChange(b1: NEAR, b2: NEAR, expected_change: NEAR, precision: number) {
//   console.log('expected change: ', expected_change.toString())

//   let numToDivide = new BN(Math.ceil(1 / precision));
//   let range = expected_change.abs().div(numToDivide);
//   console.log('range addition: ', range.toString())

//   let acceptableRange = {
//     upper: expected_change.abs().add(range), // 1 + .05 = 1.05
//     lower: expected_change.abs().sub(range) // 1 - .05  = .95
//   }
//   let diff = b2.sub(b1).abs();
//   console.log(`diff: ${diff.toString()} range: ${JSON.stringify(acceptableRange)}`)
//   return diff.gte(acceptableRange.lower) && diff.lte(acceptableRange.upper)
// }