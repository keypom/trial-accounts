use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault, PublicKey, Promise};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKeys {
    NearByPk,
}

#[near_bindgen]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
pub struct Mapping {
    near_by_pk: LookupMap<PublicKey, AccountId>
}

#[near_bindgen]
impl Mapping {
    #[init]
    pub fn new() -> Self {
        Self {
            near_by_pk: LookupMap::new(StorageKeys::NearByPk)
        }
    }

    #[payable]
    pub fn set(&mut self) {
        let pk = env::signer_account_pk();
        let account_id = env::signer_account_id();

        let initial_storage = env::storage_usage();
        
        self.near_by_pk.insert(&pk, &account_id);

        let net = env::storage_usage() - initial_storage;
        let price = net as u128 * env::storage_byte_cost();

        let attached_deposit = env::attached_deposit();
        assert!(attached_deposit >= price, "ERR_NOT_ENOUGH_DEPOSIT");

        // Refund any unused deposit
        if attached_deposit > price {
            near_sdk::log!(
                "Refunding: {} for {} excess storage",
                env::signer_account_id(),
                attached_deposit - price
            );
            Promise::new(env::signer_account_id()).transfer(attached_deposit - price);
        }
    }

    pub fn get_account_id(&self, pk: PublicKey) -> Option<AccountId> {
        self.near_by_pk
            .get(&pk)
    }
}