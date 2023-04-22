
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, LookupSet};
use near_sdk::json_types::U128;
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault, PublicKey, Promise};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKeys {
    NearByPk,
}

mod fungible_tokens;
use fungible_tokens::*;

#[near_bindgen]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
pub struct Mapping {
    custom_struct: LookupSet<InternalFTData>
}

#[near_bindgen]
impl Mapping {
    #[init]
    pub fn new() -> Self {
        Self {
            custom_struct: LookupSet::new(StorageKeys::NearByPk)
        }
    }

    #[payable]
    pub fn store_contract_data(&mut self) {
        let initial_storage = env::storage_usage();
        near_sdk::log!("initial bytes {}", initial_storage);
        
        let mut new_struct = InternalFTData::new();
        new_struct.store_struct_data();
        new_struct.get_struct_data();

        self.custom_struct.insert(&new_struct);

        let final_storage = env::storage_usage();
        near_sdk::log!("final bytes {}", final_storage);
    }

    pub fn get_contract_data(&self) -> bool {
        self.custom_struct.contains(&CustomStruct::new())
    }
}