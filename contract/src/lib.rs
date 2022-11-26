#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(target_arch = "wasm32", feature(alloc_error_handler))]

/// storage keys used by this contract because it uses raw storage key value writes and reads
const RULES_KEY: &[u8] = b"r";
const NONCE_KEY: &[u8] = b"n";
/// register constants used
const REGISTER_0: u64 = 0;
/// string literals (improve readability)
const DOUBLE_QUOTE_BYTE: u8 = b'\"';
const RECEIVER_HEADER: &str = "\"|kR|\":";
const ACTION_HEADER: &str = "\"|kA|\":";
const PARAM_STOP: &str = "|kS|\"";
const COMMA: &str = ",";

/// repeated string literals (in parsing tx payloads)
const DEPOSIT: &str = "|kP|deposit";

extern crate alloc;

/// DEBUGGING REMOVE
// use alloc::format;

use alloc::vec;
use alloc::vec::Vec;
// use alloc::string::ToString;

mod sys;
use sys::*;
mod parse;
use parse::*;

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
#[no_mangle]
pub unsafe fn on_panic(_info: &::core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[cfg(target_arch = "wasm32")]
#[alloc_error_handler]
#[no_mangle]
pub unsafe fn on_alloc_error(_: core::alloc::Layout) -> ! {
    core::arch::wasm32::unreachable()
}

#[no_mangle]
pub fn setup() {
    unsafe { near_sys::input(REGISTER_0) };
    let data = register_read(REGISTER_0);
	// remove quotes from string with slice, strip slashes, and write it
	let data_str = alloc::str::from_utf8(&data[1..data.len()-1]).ok().unwrap_or_else(|| sys::panic());
    swrite(RULES_KEY, data_str.replace("\\\"", "\"").as_bytes());
	let nonce: u64 = 0;
    swrite(NONCE_KEY, &nonce.to_le_bytes());
}

/// This method is the main interpreter of the eth typed data signed payload by the ethereum account.
/// First the predecessor is checked by assert_predecessor() in owner.rs to ensure only access keys originating from this NEAR account are calling.
/// Next the nonce and new nonce are read and computed from storage.
/// Finally the data is returned from assert_valid_tx(nonce) in owner.rs.
/// 
/// After these conditions are satisfied the method parses and executes the transaction payload.
/// 
/// For details on NEAR transactions and actions please refer to: https://nomicon.io/RuntimeSpec/, https://nomicon.io/RuntimeSpec/Actions
/// 
/// Matching wallet-selector transaction payload structs here:
/// https://github.com/near/wallet-selector/blob/main/packages/core/src/lib/wallet/transactions.types.ts
#[no_mangle]
pub fn execute() {

	let nonce = unsafe { sread_u64(NONCE_KEY) };
    swrite(NONCE_KEY, &(nonce + 1).to_le_bytes());

    unsafe { near_sys::input(REGISTER_0) };
    let data = register_read(REGISTER_0);

	let msg = alloc::str::from_utf8(&data).ok().unwrap_or_else(|| sys::panic());
	log(&msg);

	let rules_data = storage_read(RULES_KEY);
	let rules_str = alloc::str::from_utf8(&rules_data).ok().unwrap_or_else(|| sys::panic());
	log(&rules_str);
	let contracts: Vec<&str> = get_string(rules_str, "|kP|contracts").split(",").collect();
	let methods: Vec<&str> = get_string(rules_str, "|kP|methods").split(",").collect();
	let amounts: Vec<u128> = get_string(rules_str, "|kP|amounts")
		.split(",")
		.map(|a| {
			let amount: u128 = a.parse().ok().unwrap_or_else(|| sys::panic());
			amount
		})
		.collect();

	log(&contracts.join(","));
	log(&methods.join(","));
	let one_near: u128 = 1000000000000000000000000;
	if amounts.contains(&one_near) {
		log("contains NEAR amount")
	}

	let mut transactions: Vec<&str> = msg.split(RECEIVER_HEADER).collect();
	transactions.remove(0);

	// keep track of promise ids for each tx
	let mut promises: Vec<u64> = vec![];

	// execute transactions
	while transactions.len() > 0 {
		let tx = transactions.remove(0);

		let (mut receiver, tx_rest) = tx.split_once(COMMA).unwrap_or_else(|| sys::panic());
		receiver = &receiver[1..receiver.len()-1];

		log(receiver);
		if !contracts.contains(&receiver) {
			sys::panic()
		}

		let id = if promises.len() == 0 {
			unsafe {
				near_sys::promise_batch_create(
					receiver.len() as u64,
					receiver.as_ptr() as u64
				)
			}
		} else {
			unsafe {
				near_sys::promise_batch_then(
					promises[promises.len() - 1],
					receiver.len() as u64,
					receiver.as_ptr() as u64
				)
			}
		};
		promises.push(id);

		// actions for tx
		let mut actions: Vec<&str> = tx_rest.split(ACTION_HEADER).collect();
		actions.remove(0);
		
		while actions.len() > 0 {
			let action = actions.remove(0);

			let (mut action_type, params) = action.split_once(COMMA).unwrap_or_else(|| sys::panic());
			action_type = &action_type[1..action_type.len()-1];

			log(action_type);
			log(params);

			// match

			match action_type.as_bytes() {
				b"Transfer" => {
					let deposit = get_u128(params, DEPOSIT);
					unsafe {
						near_sys::promise_batch_action_transfer(
							id,
							deposit.to_le_bytes().as_ptr() as u64,
						)
					};
				}
				b"FunctionCall" => {
					let method_name = get_string(params, "|kP|methodName");
					let args = &get_string(params, "|kP|args").replace("\\", "");
					let deposit = get_u128(params, DEPOSIT);
					let gas = get_u128(params, "|kP|gas") as u64;
					unsafe {
						near_sys::promise_batch_action_function_call(
							id,
							method_name.len() as u64,
							method_name.as_ptr() as u64,
							args.len() as u64,
							args.as_ptr() as u64,
							deposit.to_le_bytes().as_ptr() as u64,
							gas,
						)
					};
				}
				// only adds full access keys (exit account, delete contract)
				b"AddKey" => {
					let mut public_key = vec![0];
					let bytes = get_string(action, "|MTXP|publicKey").as_bytes();
					public_key.extend_from_slice(&hex2bytes(&bytes, bytes.len()));
					unsafe {
						near_sys::promise_batch_action_add_key_with_full_access(
							id,
							public_key.len() as u64,
							public_key.as_ptr() as u64,
							0,
						)
					};
				}
				_ => {}
			}
		}
	}
}

/// views

#[no_mangle]
pub(crate) unsafe fn get_rules() {
    return_bytes(&storage_read(RULES_KEY), true);
}

#[no_mangle]
pub(crate) unsafe fn get_nonce() {
    return_bytes(&bytes2hex(&sread_u64(NONCE_KEY).to_be_bytes()), false);
}