use crate::*;

/// Minimum Gas required to perform a simple transfer of fungible tokens.
/// 5 TGas
const MIN_GAS_FOR_FT_TRANSFER: Gas = Gas(5_000_000_000_000);
/// Minimum Gas required to resolve the batch of promises for transferring the FTs and registering the user.
/// 5 TGas
const MIN_GAS_FOR_RESOLVE_BATCH: Gas = Gas(5_000_000_000_000);

impl InternalFTData {
    /// Attempt to transfer FTs to a given address (will cover registration automatically).
    /// If the transfer fails, the FTs will be returned to the available balance
    /// Should *only* be invoked if the available balance is greater than or equal to the transfer amount.
    pub fn ft_refund(&mut self, receiver_id: AccountId, transfer_amount: U128) {
        // get the drop object
        let mut drop = self.drop_for_id.get(&drop_id.0).expect("No drop found");
        let owner_id = drop.owner_id.clone();
        
        if env::predecessor_account_id() != self.owner_id {
            require!(
                owner_id == env::predecessor_account_id(),
                "only drop funder can delete keys"
            );
        }

        // Get the number of uses registered for the drop.
        let uses_registered = drop.registered_uses;
        require!(uses_registered > 0, "no uses left to unregister");

        // Get the uses to refund. If not specified, this is the number of uses currently registered.
        let num_to_refund = assets_to_refund.unwrap_or(uses_registered);
        require!(
            num_to_refund <= uses_registered,
            "can only refund less than or equal to the amount of keys registered"
        );

        // Decrement the drop's keys registered temporarily. If the transfer is unsuccessful, revert in callback.
        drop.registered_uses -= num_to_refund;
        self.drop_for_id.insert(&drop_id.0, &drop);

        match &mut drop.drop_type {
            DropType::nft(data) => {
                /*
                    NFTs need to be batched together. Loop through and transfer all NFTs.
                    Keys registered will be decremented and the token IDs will be removed
                    in the callback if everything is successful. If anything fails, the
                    keys registered will be added back in the callback for the drop.
                */
                let nft_batch_index = env::promise_batch_create(&data.contract_id);
                let mut token_ids: Vec<String> = vec![];

                // Loop through and pop / transfer all token IDs. If anything goes wrong, we send back all the token IDs, we popped and push them back in the callback.
                for _ in 0..num_to_refund {
                    let token_id = data.token_ids.pop().unwrap();
                    token_ids.push(token_id.clone());
                    // Send the NFTs back to the sender
                    // Call the function with the min GAS and then attach 1/5 of the unspent GAS to the call
                    env::promise_batch_action_function_call_weight(
                        nft_batch_index,
                        "nft_transfer",
                        json!({ "receiver_id": data.sender_id.clone().unwrap_or(owner_id.clone()), "token_id": token_id, "memo": "Refund" }).to_string().as_bytes(),
                        1,
                        MIN_GAS_FOR_SIMPLE_NFT_TRANSFER,
                        GasWeight(1)
                    );
                }

                self.drop_for_id.insert(&drop_id.0, &drop);

                // Create the second batch promise to execute after the nft_batch_index batch is finished executing.
                // It will execute on the current account ID (this contract)
                let batch_ft_resolve_promise_id =
                    env::promise_batch_then(nft_batch_index, &env::current_account_id());

                // Execute a function call as part of the resolved promise index created in promise_batch_then
                // Callback after all NFTs were refunded
                // Call the function with the min GAS and then attach 10/(10 + num_to_refund) of the unspent GAS to the call
                env::promise_batch_action_function_call_weight(
                    batch_ft_resolve_promise_id,
                    "nft_resolve_refund",
                    json!({ "drop_id": drop_id, "token_ids": token_ids })
                        .to_string()
                        .as_bytes(),
                    NO_DEPOSIT,
                    MIN_GAS_FOR_RESOLVE_BATCH,
                    GasWeight(10),
                );
            }
            DropType::ft(data) => {
                // All FTs can be refunded at once. Funder responsible for registering themselves
                ext_ft_contract::ext(data.contract_id.clone())
                    // Call ft transfer with 1 yoctoNEAR. 1/2 unspent GAS will be added on top
                    .with_attached_deposit(1)
                    .ft_transfer(
                        data.sender_id.clone().unwrap_or(owner_id),
                        U128(data.balance_per_use.0 * num_to_refund as u128),
                        None,
                    )
                    // We then resolve the promise and call nft_resolve_transfer on our own contract
                    .then(
                        // Call resolve refund with the min GAS and no attached_deposit. 1/2 unspent GAS will be added on top
                        Self::ext(env::current_account_id())
                            .ft_resolve_refund(drop_id.0, num_to_refund),
                    )
                    .as_return();
            }
            _ => env::panic_str("can only refund assets for FT and NFT drops"),
        };
    }
}