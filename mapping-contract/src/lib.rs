use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKeys {
    Mappings,
    Delegates,
}

#[near_bindgen]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
struct Contract {
    mappings: LookupMap<(AccountId, String), String>,
    delegates: LookupMap<AccountId, AccountId>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            mappings: LookupMap::new(StorageKeys::Mappings),
            delegates: LookupMap::new(StorageKeys::Delegates),
        }
    }

    pub fn set(&mut self, account_id: Option<AccountId>, label: String, content: Option<String>) {
        let id = if let Some(account_id) = account_id {
            if env::predecessor_account_id() != account_id {
                assert_eq!(
                    self.delegates.get(&account_id).expect("ERR_NOT_DELEGATE"),
                    env::predecessor_account_id(),
                    "ERR_NOT_DELEGATE"
                );
            }
            account_id
        } else {
            env::predecessor_account_id()
        };
        if let Some(content) = content {
            self.mappings.insert(&(id, label), &content);
        } else {
            self.mappings.remove(&(id, label));
        }
    }

    pub fn get(&self, account_id: AccountId, label: String) -> String {
        self.mappings
            .get(&(account_id, label))
            .expect("ERR_NO_VALUE")
    }

    pub fn delegate(&mut self, account_id: Option<AccountId>) {
        if let Some(account_id) = account_id {
            self.delegates
                .insert(&env::predecessor_account_id(), &account_id);
        } else {
            self.delegates.remove(&env::predecessor_account_id());
        }
    }
}