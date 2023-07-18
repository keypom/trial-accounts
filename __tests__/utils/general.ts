import { initKeypom, nearAPI } from "keypom-js";
import { Near } from "near-api-js";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { AccountBalance, BN, KeyPair, NEAR, NearAccount, TransactionResult } from "near-workspaces";
import { formatNearAmount } from "near-api-js/lib/utils/format";
import { ExtDrop, InternalFTData, InternalNFTData, PickOnly } from "./types";

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
    console.log(`Start Time: ${rawValue.startMs}`)
    console.log(`End Time: ${rawValue.endMs}`)
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
  console.log('');
  let logMessages: string[] = [];

  let didPanic = false;
  let panicMessages: string[] = [];

  // Loop through each receipts_outcome in the transaction's result field
  transaction.result.receipts_outcome.forEach((receipt) => {   
    const logs = receipt.outcome.logs;
    if (logs.length > 0) {
      // Turn logs into a string
      let logs = receipt.outcome.logs.reduce((acc, log) => {
        return acc.concat(log).concat('\n');
      }, '');

      logs = logs.substring(0, logs.length - 1);
      logMessages.push(logs);

    } else if (logMessages[logMessages.length - 1] != `\n` && logMessages.length > 0) {
      logMessages.push(`\n`);
    }

    const status = (receipt.outcome.status as any);
    if (status.Failure) {
      let failure = status.Failure.ActionError;
      let str = `Failure for method: ${methodName} Failure: ${JSON.stringify(failure)}\n`

      panicMessages.push(str);
      didPanic = true;
    }
  })
  

  console.log(`${methodName} -> ${receiverId}. ${logMessages.length} Logs Found. ${panicMessages.length} Panics Found.`);
  
  if (shouldLog && logMessages.length > 0) {
    let logStr = logMessages.join('\n');
    // Remove the last instance of `\n` from the log string
    logStr = logStr.substring(0, logStr.length - 1);
    console.log(logStr);
  }

  if (panicMessages.length > 0) { 
    console.log("Panics:")
    let panicStr = panicMessages.join('\n');
    // Remove the last instance of `\n` from the panic string
    panicStr = panicStr.substring(0, panicStr.length - 1);
    console.log(panicStr)
  }

  if (shouldPanic && !didPanic) {
    throw new Error(`Expected failure for method: ${methodName}`)
  }

  if (!shouldPanic && didPanic) {
    throw new Error("Panic found when not expected");    
  }
}

export async function assertKeypomInternalAssets({
  keypom,
  dropId,
  expectedNftData,
  expectedFtData,
}: {
  keypom: NearAccount,
  dropId: string,
  expectedNftData?: InternalNFTData[],
  expectedFtData?: PickOnly<InternalFTData, "contract_id" | "balance_avail">[]
}) {
  expectedNftData = expectedNftData || [];
  expectedFtData = expectedFtData || [];
  let dropInfo: ExtDrop = await keypom.view('get_drop_information', {drop_id: dropId});
  console.log('dropInfo: ', dropInfo)
  
  if (expectedNftData.length != dropInfo.nft_asset_data.length) {
    throw new Error(`Expected ${expectedNftData.length} NFTs but found ${dropInfo.nft_asset_data.length}`);
  } else {
    for (let expectedAsset of expectedNftData) {
      // Check if the NFT data matches one from the list
      let matches = dropInfo.nft_asset_data.find((foundAsset) => {
        let sameTokens = expectedAsset.token_ids.sort().join(',') === foundAsset.token_ids.sort().join(',')
        console.log('sameTokens: ', sameTokens)
        return foundAsset.contract_id == expectedAsset.contract_id && sameTokens
      });

      if (!matches) {
        console.log(`Expected Contract ID: ${expectedAsset.contract_id}`)
        console.log(`Expected Tokens: ${expectedAsset.token_ids.sort().join(',')}`)

        console.log(`Found Contract ID: ${dropInfo.nft_asset_data[0].contract_id}`)
        console.log(`Found Tokens: ${dropInfo.nft_asset_data[0].token_ids.sort().join(',')}`)
        throw new Error(`Expected NFT Data ${expectedAsset} not found`);
      }
    }
  }

  if (expectedFtData.length != dropInfo.ft_asset_data.length) {
    throw new Error(`Expected ${expectedFtData.length} FTs but found ${dropInfo.ft_asset_data.length}`);
  } else {
    for (let expectedAsset of expectedFtData) {
      // Check if the NFT data matches one from the list
      let matches = dropInfo.ft_asset_data.find((foundAsset) => {
        return foundAsset.contract_id == expectedAsset.contract_id && foundAsset.balance_avail == expectedAsset.balance_avail
      });

      if (!matches) {
        throw new Error(`Expected NFT Data ${expectedAsset} not found`);
      }
    }
  }
}

export async function assertNFTBalance({
  nftContract,
  accountId,
  tokensOwned
}: {
  nftContract: NearAccount,
  accountId: string,
  tokensOwned: string[]
}) {
  let nftTokens: Array<{owner_id: string, token_id: string}> = await nftContract.view('nft_tokens_for_owner', {account_id: accountId});
  console.log(`NFTs for ${accountId} are: ${JSON.stringify(nftTokens)}`);

  let sameTokens = nftTokens.sort().join(',') === tokensOwned.sort().join(',');
  if (!sameTokens) {
    throw new Error(`Expected NFTs for ${accountId} to be ${tokensOwned}. Got ${nftTokens} instead.`)
  }
}

export async function assertFTBalance({
  ftContract,
  accountId,
  amountOwned
}: {
  ftContract: NearAccount,
  accountId: string,
  amountOwned: string
}) {
  let ftBal = await ftContract.view('ft_balance_of', {account_id: accountId});
  console.log(`FT Balance for ${accountId} is: ${ftBal}. Expected ${amountOwned}`)
  if (ftBal != amountOwned) {
    throw new Error(`Expected FT Balance for ${accountId} to be ${amountOwned}. Got ${ftBal} instead.`)
  }
}

export async function claimWithRequiredGas({
  keypomV3,
  root,
  key,
  publicKey,
  createAccount=false,
  newPublicKey="",
  newAccountId="",
  shouldPanic=false
}: {
  keypomV3: NearAccount,
  root: NearAccount,
  key: KeyPair,
  publicKey: string,
  createAccount?: Boolean,
  newPublicKey?: string,
  newAccountId?: string,
  shouldPanic?: Boolean
}){
  // Set key and get required gas
  await keypomV3.setKey(key);
  let keyPk = publicKey;
  const keyInfo: {required_gas: string} = await keypomV3.view('get_key_information', {key: keyPk});
  console.log('keyInfo: ', keyInfo)

  let panic = false
  if(shouldPanic){
    panic = true
  }

  // CAAC - Use longest possible account ID
  if(createAccount){
    // Invalid CAAC
    if(newPublicKey == "" ){
      console.log("CREATING ACCOUNT NEEDS A NEW PUBLIC KEY")
      return("false")
    }

    let myString = "ac" + Date.now().toString() + Date.now().toString() + Date.now().toString() + Date.now().toString()
    newAccountId !== "" ? newAccountId : `${myString}.${root.accountId}`

  
    let response = await functionCall({
        signer: keypomV3,
        receiver: keypomV3,
        methodName: 'create_account_and_claim',
        args: {
          new_account_id: newAccountId,
          new_public_key: newPublicKey
        },
        gas: keyInfo.required_gas,
        shouldPanic: panic
    })
    console.log(response)
    return response
  }
  // Claim - use implicit account
  else{
    // Hex public key
    let implicitAccountId = Buffer.from(nearAPI.utils.PublicKey.fromString(publicKey).data).toString('hex')

    let response = await functionCall({
      signer: keypomV3,
      receiver: keypomV3,
      methodName: 'claim',
      args: {
        account_id: implicitAccountId,
      },
      gas: keyInfo.required_gas,
      shouldPanic: panic
    })
    console.log(response)
    return response
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