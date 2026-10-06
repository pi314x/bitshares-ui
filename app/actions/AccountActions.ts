// Redux-backed replacement for the Alt.js AccountActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../stores/IntlStore.ts`'s header for the cluster explanation).
// `setCurrentAccount`/`createAccount`/`accountSearch`/
// `tryToSetCurrentAccount`/`setPasswordAccount`/`addStarAccount`/
// `removeStarAccount`/`addAccountContact`/`removeAccountContact`/
// `toggleHideAccount` are the 10 methods `AccountStore` actually binds a
// listener to (confirmed via grep - no other store binds to this file) -
// each calls that store's matching `onXxx` handler directly.
//
// `transfer`/`createAccountWithPassword`/`upgradeAccount`/
// `createCommittee`/`createWitness`/`updateWitness` are NOT bound by any
// store (their `dispatch(...)`/`dispatch(true/false)` calls were already
// dead no-ops under Alt, same precedent as the `AssetActions`/
// `MarketsActions` batches) - the dispatch calls are dropped, but the
// real transaction-building (`WalletApi.new_transaction`/
// `WalletDb.process_transaction`) and promise-resolution logic is
// preserved byte-for-byte. Security-sensitive per AGENTS.md:
// `upgradeAccount`/`createCommittee`/`createWitness`/`updateWitness` all
// build and broadcast real transactions via `WalletDb.process_transaction`
// - never touches `WalletDb.ts` itself.
import accountUtils from "common/account_utils";
import AccountApi from "api/accountApi";
import WalletApi from "api/WalletApi";
import ApplicationApi from "api/ApplicationApi";
import WalletDb from "stores/WalletDb";
import WalletActions from "actions/WalletActions";
import accountStore from "../stores/AccountStore";

const accountSearchInProgress: {[key: string]: boolean} = {};

/**
 *  @brief  Actions that modify linked accounts
 *
 *  @note this class also includes accountSearch actions which keep track of search result state.  The presumption
 *  is that there is only ever one active "search result" at a time.
 */
class AccountActionsFacade {
    /**
     *  Account search results are not managed by the ChainStore cache so are
     *  tracked as part of the AccountStore.
     */
    accountSearch(start_symbol: string, limit = 50) {
        const uid = `${start_symbol}_${limit}}`;
        if (!accountSearchInProgress[uid]) {
            accountSearchInProgress[uid] = true;
            return (AccountApi as any)
                .lookupAccounts(start_symbol, limit)
                .then((result: any) => {
                    accountSearchInProgress[uid] = false;
                    (accountStore as any).onAccountSearch({
                        accounts: result,
                        searchTerm: start_symbol
                    });
                });
        }
    }

    /**
     *  TODO:  The concept of current accounts is deprecated and needs to be removed
     */
    setCurrentAccount(name: string) {
        (accountStore as any).onSetCurrentAccount(name);
        return name;
    }

    tryToSetCurrentAccount() {
        (accountStore as any).tryToSetCurrentAccount();
        return true;
    }

    addStarAccount(account: string) {
        (accountStore as any).onAddStarAccount(account);
        return account;
    }

    removeStarAccount(account: string) {
        (accountStore as any).onRemoveStarAccount(account);
        return account;
    }

    toggleHideAccount(account: string, hide: boolean) {
        (accountStore as any).onToggleHideAccount({account, hide});
        return {account, hide};
    }

    /**
     *  TODO:  This is a function of teh WalletApi and has no business being part of AccountActions
     */
    transfer(
        from_account: any,
        to_account: any,
        amount: any,
        asset: any,
        memo: any,
        propose_account: any = null,
        fee_asset_id = "1.3.0"
    ) {
        // Set the fee asset to use
        fee_asset_id = (accountUtils as any).getFinalFeeAsset(
            propose_account || from_account,
            "transfer",
            fee_asset_id
        );

        try {
            return (ApplicationApi as any)
                .transfer({
                    from_account,
                    to_account,
                    amount,
                    asset,
                    memo,
                    propose_account,
                    fee_asset_id
                })
                .then((result: any) => {
                    return result;
                });
        } catch (error) {
            console.log(
                "[AccountActions.js:90] ----- transfer error ----->",
                error
            );
            return new Promise((resolve, reject) => {
                reject(error);
            });
        }
    }

    /**
     *  This method exists ont he AccountActions because after creating the account via the wallet, the account needs
     *  to be linked and added to the local database.
     */
    createAccount(
        account_name: string,
        registrar: any,
        referrer: any,
        referrer_percent: any,
        refcode: any
    ) {
        return (WalletActions as any)
            .createAccount(account_name, registrar, referrer, referrer_percent, refcode)
            .then(() => {
                (accountStore as any).onCreateAccount(account_name);
                return account_name;
            });
    }

    createAccountWithPassword(
        account_name: string,
        password: any,
        registrar: any,
        referrer: any,
        referrer_percent: any,
        refcode: any
    ) {
        return (WalletActions as any)
            .createAccountWithPassword(
                account_name,
                password,
                registrar,
                referrer,
                referrer_percent,
                refcode
            )
            .then(() => {
                return account_name;
            });
    }

    /**
     *  TODO:  This is a function of the WalletApi and has no business being part of AccountActions, the account should already
     *  be linked.
     */
    upgradeAccount(account_id: any, lifetime: any) {
        // Set the fee asset to use
        const fee_asset_id = (accountUtils as any).getFinalFeeAsset(
            account_id,
            "account_upgrade"
        );

        const tr = (WalletApi as any).new_transaction();
        tr.add_type_operation("account_upgrade", {
            fee: {
                amount: 0,
                asset_id: fee_asset_id
            },
            account_to_upgrade: account_id,
            upgrade_to_lifetime_member: lifetime
        });
        return (WalletDb as any).process_transaction(tr, null, true);
    }

    addAccountContact(name: string) {
        (accountStore as any).onAddAccountContact(name);
        return name;
    }

    removeAccountContact(name: string) {
        (accountStore as any).onRemoveAccountContact(name);
        return name;
    }

    setPasswordAccount(account: any) {
        (accountStore as any).onSetPasswordAccount(account);
        return account;
    }

    createCommittee({url, account}: {url: string; account: any}) {
        const account_id = account.get("id");
        const tr = (WalletApi as any).new_transaction();

        tr.add_type_operation("committee_member_create", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            committee_member_account: account_id,
            url: url
        });
        return (WalletDb as any)
            .process_transaction(tr, null, true)
            .then(() => {})
            .catch((error: any) => {
                console.log("----- Add Committee member error ----->", error);
            });
    }

    createWitness({
        url,
        account,
        signingKey
    }: {
        url: string;
        account: any;
        signingKey: any;
    }) {
        const account_id = account.get("id");
        const tr = (WalletApi as any).new_transaction();

        tr.add_type_operation("witness_create", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            witness_account: account_id,
            url: url,
            block_signing_key: signingKey
        });
        return (WalletDb as any)
            .process_transaction(tr, null, true)
            .then(() => {})
            .catch((error: any) => {
                console.log("----- Create witness error ----->", error);
            });
    }

    updateWitness({
        url,
        account,
        witness_id,
        signingKey
    }: {
        url: string;
        account: any;
        witness_id: any;
        signingKey: any;
    }) {
        console.log("asdsa");
        const account_id = account.get("id");
        const tr = (WalletApi as any).new_transaction();
        const payload: any = {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            witness: witness_id,
            witness_account: account_id
        };
        payload.new_signing_key = signingKey;
        payload.new_url = url;
        tr.add_type_operation("witness_update", payload);
        return (WalletDb as any)
            .process_transaction(tr, null, true)
            .then(() => {})
            .catch((error: any) => {
                console.log("----- Update witness error ----->", error);
            });
    }
}

const accountActionsFacade = new AccountActionsFacade();

type Deferrable<T extends (...args: any[]) => any> = T & {
    defer: (...args: Parameters<T>) => void;
};

// Real Alt actions get a `.defer(...args)` method for free
// (`alt/src/actions/index.js`), used by real call sites
// (`Account/AccountPage.tsx`, `next/NextShellContainer.tsx`'s
// `AccountActions.setCurrentAccount.defer(...)`). Replicated for the
// one method actually called this way (grep-confirmed).
const setCurrentAccountDeferrable = accountActionsFacade.setCurrentAccount as Deferrable<
    typeof accountActionsFacade.setCurrentAccount
>;
setCurrentAccountDeferrable.defer = (...args) =>
    setTimeout(() => accountActionsFacade.setCurrentAccount(...args));

export default accountActionsFacade as typeof accountActionsFacade & {
    setCurrentAccount: Deferrable<typeof accountActionsFacade.setCurrentAccount>;
};
