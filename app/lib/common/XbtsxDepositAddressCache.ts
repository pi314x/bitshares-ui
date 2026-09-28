// TypeScript port of the legacy XbtsxDepositAddressCache.js (Phase 7,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive-adjacent per AGENTS.md: this only caches gateway
// *deposit addresses/memos* (not private keys) inside the wallet's
// `deposit_keys` blob and persists them via the real `WalletDb
// ._updateWallet()` - unchanged from the original.
import WalletDb from "stores/WalletDb";

class XbtsxDepositAddressCache {
    current_xbtsx_address_cache_version_string: string;

    constructor() {
        // increment this to force generating new addresses for all mappings
        this.current_xbtsx_address_cache_version_string = "1";
    }

    getIndexForDepositKeyInExchange(
        account_name: string,
        input_coin_type: string,
        output_coin_type: string
    ) {
        const args = [
            this.current_xbtsx_address_cache_version_string,
            account_name,
            input_coin_type,
            output_coin_type
        ];
        return args.reduce(function(previous, current) {
            return previous.concat("[", current, "]");
        }, "");
    }

    // returns {"address": address, "memo": memo}, with a null memo if not applicable
    getCachedInputAddress(
        exchange_name: string,
        account_name: string,
        input_coin_type: string,
        output_coin_type: string
    ) {
        const wallet: any = (WalletDb as any).getWallet();
        if (!wallet) return null;
        wallet.deposit_keys = wallet.deposit_keys || {};
        wallet.deposit_keys[exchange_name] =
            wallet.deposit_keys[exchange_name] || {};
        const index = this.getIndexForDepositKeyInExchange(
            account_name,
            input_coin_type,
            output_coin_type
        );
        wallet.deposit_keys[exchange_name][index] =
            wallet.deposit_keys[exchange_name][index] || [];

        const number_of_keys = wallet.deposit_keys[exchange_name][index].length;
        if (number_of_keys)
            return wallet.deposit_keys[exchange_name][index][
                number_of_keys - 1
            ];
        return null;
    }

    cacheInputAddress(
        exchange_name: string,
        account_name: string,
        input_coin_type: string,
        output_coin_type: string,
        address: string,
        memo: string | null | undefined
    ) {
        const wallet: any = (WalletDb as any).getWallet();
        if (!wallet) return null;
        wallet.deposit_keys = wallet.deposit_keys || {};
        wallet.deposit_keys[exchange_name] =
            wallet.deposit_keys[exchange_name] || {};
        const index = this.getIndexForDepositKeyInExchange(
            account_name,
            input_coin_type,
            output_coin_type
        );
        wallet.deposit_keys[exchange_name][index] =
            wallet.deposit_keys[exchange_name][index] || [];
        wallet.deposit_keys[exchange_name][index].push({
            address: address,
            memo: memo
        });
        (WalletDb as any)._updateWallet();
    }
} // XbtsxDepositAddressCache

export default XbtsxDepositAddressCache;
