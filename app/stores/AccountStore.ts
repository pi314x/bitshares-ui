// Redux-backed replacement for the Alt.js AccountStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
//
// Part of a genuinely circular cluster that could not be split into
// smaller batches - see `./IntlStore.ts`'s header for the full
// explanation. This store is itself a member via two cross-bindings:
// `SettingsActions.changeSetting` (also bound by `SettingsStore`/
// `WalletUnlockStore`) and `WalletActions.setWallet` (also bound by
// `WalletManagerStore`).
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()`, and every method the original
// `_export()`ed (`loadDbData`, `tryToSetCurrentAccount`, `onCreateAccount`,
// `getMyAccounts`, `isMyAccount`, `getMyAuthorityForAccount`, `isMyKey`,
// `reset`, `setWallet`) - plus every other `onXxx` handler, now plain
// public methods (rather than bindListeners-private) so
// `../actions/SettingsActions.ts`/`../actions/WalletActions.ts` can call
// them directly.
//
// A real asymmetry preserved from the original: the constructor's own
// initial state (11 fields: no `wallet_name`/`accountsLoaded`/
// `refsLoaded`/`neverShowBrowsingModeNotice`/`update`/`searchTerm`) is
// DIFFERENT from `_getInitialState()`'s return value (15 fields, missing
// `linkedAccounts`/`passwordLogin`) - `reset()` dispatches the latter via
// a MERGE (matching Alt's own shallow-merge `setState`, not a full
// replace), so `reset()` deliberately leaves `linkedAccounts`/
// `passwordLogin` untouched. `account_refs`/`initial_account_refs_load`/
// `addAccountRefsInProgress` stay as plain instance fields, never
// entering Redux state - same as the original's own class fields.
import {reduxStore} from "../store/reduxStore";
import Immutable from "immutable";
import iDB from "idb-instance";
import PrivateKeyStore from "./PrivateKeyStore";
import {ChainStore, ChainValidation, FetchChain} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";
import AccountRefsStore from "stores/AccountRefsStore";
import AddressIndex from "stores/AddressIndex";
import ls from "common/localStorage";
import {
    patchState,
    seedAccountState,
    selectAccountState,
    AccountState
} from "../store/slices/accountSlice";

const ss = (ls as any)("__graphene__");

/**
 *  This Store holds information about accounts in this wallet
 *
 */
class AccountStoreFacade {
    private account_refs: any = null;
    private initial_account_refs_load = true;
    private addAccountRefsInProgress = false;
    private unsubscribers = new Map<() => void, () => void>();

    constructor() {
        // can't use settings store due to possible initialization race conditions
        const storedSettings = ss.get("settings_v4", {});
        if (storedSettings.passwordLogin === undefined) {
            storedSettings.passwordLogin = true;
        }
        const referralAccount = this._checkReferrer();
        reduxStore.dispatch(
            seedAccountState({
                neverShowBrowsingModeNotice: undefined as any,
                update: undefined as any,
                subbed: false,
                myActiveAccounts: Immutable.Set(), // accounts for which the user controls the keys and are visible
                myHiddenAccounts: Immutable.Set(), // accounts for which the user controls the keys that have been 'hidden' in the settings
                currentAccount: null, // the currently selected account, subset of starredAccounts
                passwordAccount: null, // passwordAccount is the account used when logging in with cloud mode
                starredAccounts: Immutable.Map(), // starred accounts are 'active' accounts that can be selected using the right menu dropdown for trading/transfers etc
                searchAccounts: Immutable.Map(),
                accountContacts: Immutable.Set(),
                linkedAccounts: Immutable.Set(), // linkedAccounts are accounts for which the user controls the private keys, which are stored in a db with the wallet and automatically loaded every time the app starts
                referralAccount,
                passwordLogin: storedSettings.passwordLogin,
                accountsLoaded: undefined as any,
                refsLoaded: undefined as any,
                searchTerm: undefined as any,
                wallet_name: undefined as any
            })
        );
    }

    getState(): AccountState {
        return selectAccountState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectAccountState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectAccountState(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    private _migrateUnfollowedAccounts(state: any) {
        try {
            const unfollowed_accounts = ss.get("unfollowed_accounts", []);
            const hiddenAccounts = ss.get(
                this._getStorageKey("hiddenAccounts", state),
                []
            );
            if (unfollowed_accounts.length && !hiddenAccounts.length) {
                ss.set(
                    this._getStorageKey("hiddenAccounts", state),
                    unfollowed_accounts
                );
                ss.remove("unfollowed_accounts");
                reduxStore.dispatch(
                    patchState({
                        myHiddenAccounts: Immutable.Set(unfollowed_accounts)
                    })
                );
            }
        } catch (err) {
            console.error(err);
        }
    }

    private _checkReferrer() {
        let referralAccount: any = "";
        if (window) {
            function getQueryParam(param: string) {
                const result = window.location.search.match(
                    new RegExp("(\\?|&)" + param + "(\\[\\])?=([^&]*)")
                );

                return result ? decodeURIComponent(result[3]) : false;
            }
            const validQueries = ["r", "ref", "referrer", "referral"];
            for (let i = 0; i < validQueries.length; i++) {
                referralAccount = getQueryParam(validQueries[i]);
                if (referralAccount) break;
            }
        }

        const prevRef = ss.get("referralAccount", null);

        // Store referreral only if there is no previous referral
        if (referralAccount && !prevRef) {
            ss.set("referralAccount", referralAccount);
        }

        if (!referralAccount && !!prevRef) {
            referralAccount = prevRef;
        }

        if (referralAccount) console.log("referralAccount", referralAccount);
        return referralAccount;
    }

    reset() {
        if (this.getState().subbed)
            (ChainStore as any).unsubscribe(this.chainStoreUpdate);
        reduxStore.dispatch(patchState(this._getInitialState()));
    }

    onSetWallet({wallet_name}: {wallet_name: string}) {
        this.setWallet(wallet_name);
    }

    setWallet(wallet_name: string) {
        if (wallet_name !== this.getState().wallet_name) {
            reduxStore.dispatch(
                patchState({
                    wallet_name: wallet_name,
                    passwordAccount: ss.get(
                        this._getStorageKey("passwordAccount", {wallet_name}),
                        null
                    ),
                    starredAccounts: Immutable.Map(
                        ss.get(
                            this._getStorageKey("starredAccounts", {wallet_name})
                        )
                    ),
                    myActiveAccounts: Immutable.Set(),
                    accountContacts: Immutable.Set(
                        ss.get(
                            this._getStorageKey("accountContacts", {wallet_name}),
                            []
                        )
                    ),
                    myHiddenAccounts: Immutable.Set(
                        ss.get(
                            this._getStorageKey("hiddenAccounts", {wallet_name}),
                            []
                        )
                    )
                })
            );
            this.tryToSetCurrentAccount();

            this._migrateUnfollowedAccounts({wallet_name});
        }
    }

    private _getInitialState(): Partial<AccountState> {
        this.account_refs = null;
        this.initial_account_refs_load = true; // true until all undefined accounts are found

        const wallet_name = this.getState().wallet_name || "";
        const starredAccounts = Immutable.Map(
            ss.get(this._getStorageKey("starredAccounts", {wallet_name}))
        );

        const accountContacts = Immutable.Set(
            ss.get(this._getStorageKey("accountContacts", {wallet_name}), [])
        );

        return {
            neverShowBrowsingModeNotice: false,
            update: false,
            subbed: false,
            accountsLoaded: false,
            refsLoaded: false,
            currentAccount: null,
            referralAccount: ss.get("referralAccount", ""),
            passwordAccount: ss.get(
                this._getStorageKey("passwordAccount", {wallet_name}),
                ""
            ),
            myActiveAccounts: Immutable.Set(),
            myHiddenAccounts: Immutable.Set(
                ss.get(this._getStorageKey("hiddenAccounts", {wallet_name}), [])
            ),
            searchAccounts: Immutable.Map(),
            searchTerm: "",
            wallet_name,
            starredAccounts,
            accountContacts
        };
    }

    onAddStarAccount(account: string) {
        const state = this.getState();
        if (!state.starredAccounts.has(account)) {
            const starredAccounts = state.starredAccounts.set(account, {
                name: account
            });
            reduxStore.dispatch(patchState({starredAccounts}));

            ss.set(this._getStorageKey("starredAccounts"), starredAccounts.toJS());
        } else {
            return false;
        }
    }

    onRemoveStarAccount(account: string) {
        const starredAccounts = this.getState().starredAccounts.delete(account);
        reduxStore.dispatch(patchState({starredAccounts}));
        ss.set(this._getStorageKey("starredAccounts"), starredAccounts.toJS());
    }

    onSetPasswordAccount(account: string | null) {
        const key = this._getStorageKey("passwordAccount");
        if (!account) {
            ss.remove(key);
        } else {
            ss.set(key, account);
        }
        if (this.getState().passwordAccount !== account) {
            reduxStore.dispatch(patchState({passwordAccount: account}));
        }
    }

    onToggleHideAccount({account, hide}: {account: string; hide: boolean}) {
        const state = this.getState();
        let myHiddenAccounts = state.myHiddenAccounts;
        let myActiveAccounts = state.myActiveAccounts;
        if (hide && !myHiddenAccounts.has(account)) {
            myHiddenAccounts = myHiddenAccounts.add(account);
            myActiveAccounts = myActiveAccounts.delete(account);
        } else if (myHiddenAccounts.has(account)) {
            myHiddenAccounts = myHiddenAccounts.delete(account);
            myActiveAccounts = myActiveAccounts.add(account);
        }
        reduxStore.dispatch(patchState({myHiddenAccounts, myActiveAccounts}));
    }

    loadDbData(): Promise<void> {
        const myActiveAccounts: any = (Immutable as any).Set().asMutable();
        const chainId = (Apis as any).instance().chain_id;
        return new Promise((resolve, reject) => {
            (iDB as any)
                .load_data("linked_accounts")
                .then((data: any) => {
                    const linkedAccounts = Immutable.fromJS(data || []).toSet();
                    reduxStore.dispatch(patchState({linkedAccounts} as any));

                    /*
                     * If we're in cloud wallet mode, only fetch the currently
                     * used cloud mode account, if in wallet mode fetch all the
                     * accounts of that wallet for the current chain
                     */
                    const state = this.getState();
                    const accountPromises =
                        !!state.passwordLogin && !!state.passwordAccount
                            ? [FetchChain("getAccount", state.passwordAccount)]
                            : !!state.passwordLogin
                            ? []
                            : data
                                  .filter((a: any) => {
                                      if (a.chainId) {
                                          return a.chainId === chainId;
                                      } else {
                                          return true;
                                      }
                                  })
                                  .map((a: any) => {
                                      return FetchChain("getAccount", a.name);
                                  });

                    Promise.all(accountPromises as any)
                        .then((accounts: any) => {
                            accounts.forEach((a: any) => {
                                if (
                                    !!a &&
                                    this.isMyAccount(a) &&
                                    !this.getState().myHiddenAccounts.has(
                                        a.get("name")
                                    )
                                ) {
                                    myActiveAccounts.add(a.get("name"));
                                } else if (!!a && !this.isMyAccount(a)) {
                                    // Remove accounts not owned by the user from the linked_accounts db
                                    this._unlinkAccount(a.get("name"));
                                }
                            });
                            const immutableAccounts = myActiveAccounts.asImmutable();
                            if (
                                this.getState().myActiveAccounts !==
                                immutableAccounts
                            ) {
                                reduxStore.dispatch(
                                    patchState({
                                        myActiveAccounts: myActiveAccounts.asImmutable()
                                    })
                                );
                            }

                            if (this.getState().accountsLoaded === false) {
                                reduxStore.dispatch(
                                    patchState({accountsLoaded: true})
                                );
                            }

                            if (!this.getState().subbed)
                                (ChainStore as any).subscribe(this.chainStoreUpdate);
                            reduxStore.dispatch(patchState({subbed: true} as any));
                            this.chainStoreUpdate();
                            resolve();
                        })
                        .catch((err: any) => {
                            if (!this.getState().subbed)
                                (ChainStore as any).subscribe(this.chainStoreUpdate);
                            reduxStore.dispatch(patchState({subbed: true} as any));
                            this.chainStoreUpdate();
                            reject(err);
                        });
                })
                .catch((err: any) => {
                    reject(err);
                });
        });
    }

    private chainStoreUpdate = () => {
        this.addAccountRefs();
    };

    private addAccountRefs() {
        //  Simply add them to the myActiveAccounts list (no need to persist them)
        const account_refs = (AccountRefsStore as any).getAccountRefs();
        const state = this.getState();
        if (
            !this.initial_account_refs_load &&
            this.account_refs === account_refs
        ) {
            if (state.refsLoaded === false) {
                reduxStore.dispatch(patchState({refsLoaded: true}));
            }
            return;
        }
        this.account_refs = account_refs;
        let pending = false;

        if (this.addAccountRefsInProgress) return;
        this.addAccountRefsInProgress = true;
        let linkedAccounts = state.linkedAccounts;
        // Mirrors the original's direct `this.state.myActiveAccounts = ...`
        // mutation inside `_linkAccount` - a SEPARATE running value from
        // the `withMutations` draft below (which captures `myActiveAccounts`
        // once, at the start, as its own base - direct reassignment of
        // the outer `this.state.myActiveAccounts` reference during the
        // loop never fed back into that draft in the original either).
        // Its only observable effect is the `.size === 1` check that
        // decides whether to auto-select a just-linked account as
        // current - preserved exactly via this separate tracker, not
        // used as the final dispatched `myActiveAccounts` value (see
        // below, matching the original: the `withMutations` result is
        // what actually gets set as state at the end of this method).
        let runningActiveAccounts = state.myActiveAccounts;
        let myActiveAccounts = state.myActiveAccounts.withMutations(
            (accounts: any) => {
                account_refs.forEach((id: any) => {
                    const account = (ChainStore as any).getAccount(id);
                    if (account === undefined) {
                        pending = true;
                        return;
                    }

                    const linkedEntry = {
                        name: account.get("name"),
                        chainId: (Apis as any).instance().chain_id
                    };
                    let isAlreadyLinked = linkedAccounts.find((a: any) => {
                        return (
                            a.get("name") === linkedEntry.name &&
                            a.get("chainId") === linkedEntry.chainId
                        );
                    });

                    /*
                     * Some wallets contain deprecated entries with no chain
                     * ids, remove these then write new entries with chain ids
                     */
                    const nameOnlyEntry = linkedAccounts.findKey((a: any) => {
                        return (
                            a.get("name") === linkedEntry.name && !a.has("chainId")
                        );
                    });
                    if (!!nameOnlyEntry) {
                        linkedAccounts = linkedAccounts.delete(nameOnlyEntry);
                        this._unlinkAccount(account.get("name"));
                        isAlreadyLinked = false;
                    }
                    if (account && this.isMyAccount(account) && !isAlreadyLinked) {
                        const linked = this._linkAccount(
                            account.get("name"),
                            linkedAccounts,
                            runningActiveAccounts
                        );
                        linkedAccounts = linked.linkedAccounts;
                        runningActiveAccounts = linked.myActiveAccounts;
                    }
                    if (
                        account &&
                        !accounts.includes(account.get("name")) &&
                        !state.myHiddenAccounts.has(account.get("name"))
                    ) {
                        accounts.add(account.get("name"));
                    }
                });
            }
        );

        /*
         * If we're in cloud wallet mode, simply set myActiveAccounts to the current
         * cloud wallet account
         */
        if (!!state.passwordLogin) {
            myActiveAccounts = Immutable.Set(
                !!state.passwordAccount ? [state.passwordAccount] : []
            );
        }
        const patch: any = {linkedAccounts};
        if (myActiveAccounts !== state.myActiveAccounts) {
            patch.myActiveAccounts = myActiveAccounts;
        }
        reduxStore.dispatch(patchState(patch));
        this.initial_account_refs_load = pending;
        this.tryToSetCurrentAccount();
        this.addAccountRefsInProgress = false;
    }

    getMyAccounts(): string[] {
        const state = this.getState();
        if (!state.subbed) {
            return [];
        }

        const accounts: string[] = [];
        for (const account_name of state.myActiveAccounts) {
            const account = (ChainStore as any).getAccount(account_name);
            if (account === undefined) {
                continue;
            }
            if (account == null) {
                console.log(
                    "WARN: non-chain account name in myActiveAccounts",
                    account_name
                );
                continue;
            }
            const auth = this.getMyAuthorityForAccount(account);

            if (auth === undefined) {
                continue;
            }

            if (auth === "full" || auth === "partial") {
                accounts.push(account_name as any);
            }
        }

        /*
         * If we're in cloud wallet mode, simply return the current
         * cloud wallet account
         */
        if (state.passwordLogin)
            return !!state.passwordAccount ? [state.passwordAccount] : [];

        /* In wallet mode, return a sorted list of all the active accounts */
        return accounts.sort();
    }

    /**
        @todo "partial"
        @return string "none", "full", "partial" or undefined (pending a chain store lookup)
    */
    getMyAuthorityForAccount(account: any, recursion_count = 1): any {
        if (!account) return undefined;

        const owner_authority = account.get("owner");
        const active_authority = account.get("active");

        const owner_pubkey_threshold = pubkeyThreshold(owner_authority);
        if (owner_pubkey_threshold == "full") return "full";
        const active_pubkey_threshold = pubkeyThreshold(active_authority);
        if (active_pubkey_threshold == "full") return "full";

        const owner_address_threshold = addressThreshold(owner_authority);
        if (owner_address_threshold == "full") return "full";
        const active_address_threshold = addressThreshold(active_authority);
        if (active_address_threshold == "full") return "full";

        let owner_account_threshold, active_account_threshold;

        if (recursion_count < 3) {
            owner_account_threshold = this._accountThreshold(
                owner_authority,
                recursion_count
            );
            if (owner_account_threshold === undefined) return undefined;
            if (owner_account_threshold == "full") return "full";

            active_account_threshold = this._accountThreshold(
                active_authority,
                recursion_count
            );
            if (active_account_threshold === undefined) return undefined;
            if (active_account_threshold == "full") return "full";
        }

        if (
            owner_pubkey_threshold === "partial" ||
            active_pubkey_threshold === "partial" ||
            owner_address_threshold === "partial" ||
            active_address_threshold === "partial" ||
            owner_account_threshold === "partial" ||
            active_account_threshold === "partial"
        )
            return "partial";
        return "none";
    }

    private _accountThreshold(authority: any, recursion_count: number): any {
        const account_auths = authority.get("account_auths");
        if (!account_auths.size) return "none";

        const auths = account_auths.map((auth: any) => {
            const account = (ChainStore as any).getAccount(auth.get(0), false);
            if (account === undefined) return undefined;
            return this.getMyAuthorityForAccount(account, ++recursion_count);
        });

        const final = auths.reduce((map: any, auth: any) => {
            return map.set(auth, true);
        }, Immutable.Map());

        return final.get("full") && final.size === 1
            ? "full"
            : final.get("partial") && final.size === 1
            ? "partial"
            : final.get("none") && final.size === 1
            ? "none"
            : final.get("full") || final.get("partial")
            ? "partial"
            : undefined;
    }

    isMyAccount(account: any): any {
        const authority = this.getMyAuthorityForAccount(account);
        if (authority === undefined) return undefined;
        return authority === "partial" || authority === "full";
    }

    onAccountSearch(payload: {searchTerm: string; accounts: any[]}) {
        let searchAccounts = this.getState().searchAccounts.clear();
        payload.accounts.forEach(account => {
            searchAccounts = searchAccounts.withMutations((map: any) => {
                map.set(account[1], account[0]);
            });
        });
        reduxStore.dispatch(
            patchState({searchTerm: payload.searchTerm, searchAccounts})
        );
    }

    private _getStorageKey(key = "currentAccount", state: any = this.getState()) {
        const wallet = state.wallet_name;
        const chainId = (Apis as any).instance().chain_id;
        return (
            key +
            (chainId ? `_${chainId.substr(0, 8)}` : "") +
            (wallet ? `_${wallet}` : "")
        );
    }

    tryToSetCurrentAccount() {
        const passwordAccountKey = this._getStorageKey("passwordAccount");
        const currentAccountKey = this._getStorageKey("currentAccount");
        if (ss.has(passwordAccountKey)) {
            const acc = ss.get(passwordAccountKey, null);
            if (this.getState().passwordAccount !== acc) {
                reduxStore.dispatch(patchState({passwordAccount: acc}));
            }
            return this.setCurrentAccount(acc);
        } else if (ss.has(currentAccountKey)) {
            return this.setCurrentAccount(ss.get(currentAccountKey, null));
        }

        const {starredAccounts} = this.getState();
        if (starredAccounts.size) {
            return this.setCurrentAccount(starredAccounts.first().name);
        }
        if (this.getState().myActiveAccounts.size) {
            return this.setCurrentAccount(this.getState().myActiveAccounts.first());
        }
    }

    setCurrentAccount(name: string | null) {
        const state = this.getState();
        if (state.passwordAccount) name = state.passwordAccount;
        const key = this._getStorageKey();
        if (!name) {
            name = null;
        }

        if (state.currentAccount !== name) {
            reduxStore.dispatch(patchState({currentAccount: name}));
        }

        ss.set(key, name || null);
    }

    onSetCurrentAccount(name: string) {
        this.setCurrentAccount(name);
    }

    onCreateAccount(name_or_account: any) {
        let account = name_or_account;
        if (typeof account === "string") {
            account = {
                name: account
            };
        }

        if (account["toJS"]) account = account.toJS();

        const state = this.getState();
        if (
            account.name == "" ||
            state.myActiveAccounts.get(account.name)
        )
            return Promise.resolve();

        if (!(ChainValidation as any).is_account_name(account.name))
            throw new Error("Invalid account name: " + account.name);

        return (iDB as any)
            .add_to_store("linked_accounts", {
                name: account.name,
                chainId: (Apis as any).instance().chain_id
            })
            .then(() => {
                console.log(
                    "[AccountStore.js] ----- Added account to store: ----->",
                    account.name
                );
                const myActiveAccounts = this.getState().myActiveAccounts.add(
                    account.name
                );
                reduxStore.dispatch(patchState({myActiveAccounts}));
                if (myActiveAccounts.size === 1) {
                    this.setCurrentAccount(account.name);
                }
            });
    }

    onAddAccountContact(name: string) {
        if (!(ChainValidation as any).is_account_name(name, true))
            throw new Error("Invalid account name: " + name);

        const state = this.getState();
        if (!state.accountContacts.has(name)) {
            const accountContacts = state.accountContacts.add(name);
            ss.set(this._getStorageKey("accountContacts"), accountContacts.toArray());
            reduxStore.dispatch(patchState({accountContacts}));
        }
    }

    onRemoveAccountContact(name: string) {
        if (!(ChainValidation as any).is_account_name(name, true))
            throw new Error("Invalid account name: " + name);

        const state = this.getState();
        if (state.accountContacts.has(name)) {
            const accountContacts = state.accountContacts.remove(name);

            ss.set(this._getStorageKey("accountContacts"), accountContacts as any);

            reduxStore.dispatch(patchState({accountContacts}));
        }
    }

    private _linkAccount(
        name: string,
        linkedAccounts: any,
        myActiveAccounts: any
    ): {linkedAccounts: any; myActiveAccounts: any} {
        if (!(ChainValidation as any).is_account_name(name, true))
            throw new Error("Invalid account name: " + name);

        // Link
        const linkedEntry = {
            name,
            chainId: (Apis as any).instance().chain_id
        };
        try {
            (iDB as any).add_to_store("linked_accounts", linkedEntry);
            linkedAccounts = linkedAccounts.add(Immutable.fromJS(linkedEntry)); // Keep the local linkedAccounts in sync with the db
            if (!this.getState().myHiddenAccounts.has(name))
                myActiveAccounts = myActiveAccounts.add(name);

            // Update current account if only one account is linked
            if (myActiveAccounts.size === 1) {
                this.setCurrentAccount(name);
            }
            return {linkedAccounts, myActiveAccounts};
        } catch (err) {
            console.error(err);
            return {linkedAccounts, myActiveAccounts};
        }
    }

    private _unlinkAccount(name: string) {
        if (!(ChainValidation as any).is_account_name(name, true))
            throw new Error("Invalid account name: " + name);

        // Unlink
        (iDB as any).remove_from_store("linked_accounts", name);
        // this.state.myActiveAccounts = this.state.myActiveAccounts.delete(name);

        // Update current account if no accounts are linked
        // if (this.state.myActiveAccounts.size === 0) {
        //     this.setCurrentAccount(null);
        // }
    }

    isMyKey(key: string) {
        return (PrivateKeyStore as any).hasKey(key);
    }

    onChangeSetting(payload: {setting: string; value: any}) {
        if (payload.setting === "passwordLogin") {
            if (payload.value === false) {
                this.onSetPasswordAccount(null);
                ss.remove(this._getStorageKey());
                this.loadDbData();
            } else {
                reduxStore.dispatch(patchState({myActiveAccounts: Immutable.Set()}));
            }
            reduxStore.dispatch(patchState({passwordLogin: payload.value}));
        }
    }
}

export default new AccountStoreFacade();

// @return 3 full, 2 partial, 0 none
function pubkeyThreshold(authority: any) {
    let available = 0;
    const required = authority.get("weight_threshold");
    const key_auths = authority.get("key_auths");
    for (const k of key_auths) {
        if ((PrivateKeyStore as any).hasKey(k.get(0))) {
            available += k.get(1);
        }
        if (available >= required) break;
    }
    return available >= required ? "full" : available > 0 ? "partial" : "none";
}

// @return 3 full, 2 partial, 0 none
function addressThreshold(authority: any) {
    let available = 0;
    const required = authority.get("weight_threshold");
    const address_auths = authority.get("address_auths");
    if (!address_auths.size) return "none";
    const addresses = (AddressIndex as any).getState().addresses;
    for (const k of address_auths) {
        const address = k.get(0);
        const pubkey = addresses.get(address);
        if ((PrivateKeyStore as any).hasKey(pubkey)) {
            available += k.get(1);
        }
        if (available >= required) break;
    }
    return available >= required ? "full" : available > 0 ? "partial" : "none";
}
