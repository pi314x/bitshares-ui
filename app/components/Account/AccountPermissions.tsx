// TypeScript/functional-component port of the legacy
// AccountPermissions.jsx (Phase 3, docs/UI_MIGRATION_PLAN.md). The
// account permissions editor - active/owner authority weights, memo key,
// and the password-derived-key migration tab (`AccountPermissionsMigrate`,
// ported in an earlier slice) - whose `onPublish` assembles and submits
// the real `account_update` operation via `ApplicationApi.updateAccount`.
// This is the central wallet-security-sensitive file this whole family of
// slices has been building up to; handled with the same extra care as
// this migration's wallet-tier Settings files - minimal, mechanical,
// line-for-line translation, no logic changes, per AGENTS.md's "prefer
// minimal, well-tested diffs over refactors." `ApplicationApi.updateAccount`
// itself (the actual transaction building/signing/broadcast) is reused
// completely unchanged, as is `createPaperWalletAsPDF` (the "create
// paperwallet" button, `onPdfCreate`).
//
// The legacy class kept ~25 related fields (active/owner accounts/keys/
// addresses/weights/thresholds, memo_key, a "prev_" shadow copy of each
// for change-detection, and the password-derived candidate keys) as one
// flat `this.state` object, updated via React class `setState`'s
// shallow-merge semantics - `updateAccountData`/`onReset` each replace
// many fields in one call, and `onAddItem` directly *mutates* the
// `*_weights` plain-object sub-field in place before a separate
// `setState` call for just the list array (relying on object-reference
// mutation being visible on next read, not on that specific field going
// through its own `setState`). Replicated with a single `useState<...>`
// holding the same flat object shape, plus a small `mergeState` helper
// that does the same shallow merge `this.setState(partialObject)` did -
// keeping this as one state bag (rather than decomposing into ~25
// independent hooks) preserves that mutation-then-sibling-setState
// pattern exactly, and matches how the original genuinely modeled this
// data (one cohesive object), not accidentally coupled fields split
// apart by a mechanical translation.
//
// `UNSAFE_componentWillMount` did two things: seed state from `account`
// AND pre-warm `accountUtils.getFinalFeeAsset(account, "account_update")`
// (return value discarded - almost certainly a cache-warming call, since
// `onPublish` calls the same function again by id later and needs a
// synchronous result). `UNSAFE_componentWillReceiveProps` re-seeded state
// whenever the `account` prop changed, but did *not* repeat the fee-asset
// pre-warm. Split into two effects to preserve that exact asymmetry: one
// `useEffect` on `[account]` (fires on mount and on every subsequent
// account change, matching the state-reseed behavior) and a separate
// `useEffect(() => {...}, [])` for the pre-warm (mount-only, never
// repeated on account change - even though that looks like it could be a
// pre-existing gap when navigating between two different accounts'
// permissions pages, faithfully preserved rather than "fixed").
//
// Confirmed dead, dropped: the string refs `ref="appTables"` and
// `ref="memo_key"` - neither was ever read via `this.refs` anywhere in
// the file.
//
// `validateAccount(collection, account)` is a real, actively-passed
// callback (to `AccountPermissionsList`'s `validateAccount` prop), but
// its body is `return null;` unconditionally, ignoring both parameters -
// the "already in this permission list" duplicate-account validation is
// effectively a disabled no-op stub, not something this port restores or
// removes; kept exactly as-is.
import * as React from "react";
import Immutable from "immutable";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import utils from "common/utils";
import accountUtils from "common/account_utils";
import {createPaperWalletAsPDF} from "common/paperWallet";
import ApplicationApi from "api/ApplicationApi";
import {PublicKey} from "bitsharesjs";
import AccountPermissionsList from "./AccountPermissionsList";
import AccountPermissionsMigrate from "./AccountPermissionsMigrate";
import PubKeyInput from "../Forms/PubKeyInput";
import {Tabs, Tab} from "../Utility/Tabs";
import HelpContent from "../Utility/HelpContent";
import {RecentTransactions} from "./RecentTransactions";
import {Notification} from "bitshares-ui-style-guide";

function permissionsFromImmutableObj(auths: any) {
    const threshold = auths.get("weight_threshold");
    const account_auths = auths.get("account_auths");
    const key_auths = auths.get("key_auths");
    const address_auths = auths.get("address_auths");

    const accounts = account_auths.map((a: any) => a.get(0));
    const keys = key_auths.map((a: any) => a.get(0));
    const addresses = address_auths.map((a: any) => a.get(0));

    let weights: any = account_auths.reduce((res: any, a: any) => {
        res[a.get(0)] = a.get(1);
        return res;
    }, {});
    weights = key_auths.reduce((res: any, a: any) => {
        res[a.get(0)] = a.get(1);
        return res;
    }, weights);
    weights = address_auths.reduce((res: any, a: any) => {
        res[a.get(0)] = a.get(1);
        return res;
    }, weights);

    return {threshold, accounts, keys, addresses, weights};
}

function permissionsToJson(
    threshold: any,
    accounts: any,
    keys: any,
    addresses: any,
    weights: any
) {
    const res: any = {weight_threshold: threshold};
    res["account_auths"] = accounts
        .sort((utils as any).sortID)
        .map((a: any) => [a, weights[a]])
        .toJS();
    res["key_auths"] = keys
        .sort((utils as any).sortID)
        .map((a: any) => [a, weights[a]])
        .toJS();
    res["address_auths"] = addresses
        .sort((utils as any).sortID)
        .map((a: any) => [a, weights[a]])
        .toJS();
    return res;
}

interface AccountPermissionsProps {
    account: any;
}

export default function AccountPermissions({account}: AccountPermissionsProps) {
    const [state, setState] = React.useState<any>({});

    function mergeState(partial: any) {
        setState((prev: any) => ({...prev, ...partial}));
    }

    function updateAccountData(acct: any) {
        const active = permissionsFromImmutableObj(acct.get("active"));
        const owner = permissionsFromImmutableObj(acct.get("owner"));
        const memo_key = acct
            .get("options")
            .get("memo_key");
        mergeState({
            active_accounts: active.accounts,
            active_keys: active.keys,
            active_addresses: active.addresses,
            owner_accounts: owner.accounts,
            owner_keys: owner.keys,
            owner_addresses: owner.addresses,
            active_weights: active.weights,
            owner_weights: owner.weights,
            active_threshold: active.threshold,
            owner_threshold: owner.threshold,
            memo_key: memo_key,
            prev_active_accounts: active.accounts,
            prev_active_keys: active.keys,
            prev_active_addresses: active.addresses,
            prev_owner_accounts: owner.accounts,
            prev_owner_keys: owner.keys,
            prev_owner_addresses: owner.addresses,
            prev_active_weights: active.weights,
            prev_owner_weights: owner.weights,
            prev_active_threshold: active.threshold,
            prev_owner_threshold: owner.threshold,
            prev_memo_key: memo_key
        });
    }

    React.useEffect(() => {
        updateAccountData(account);
        // eslint-disable-next-line
    }, [account]);

    React.useEffect(() => {
        (accountUtils as any).getFinalFeeAsset(account, "account_update");
        // eslint-disable-next-line
    }, []);

    function isChanged() {
        const s = state;
        return (
            s.active_accounts !== s.prev_active_accounts ||
            s.active_keys !== s.prev_active_keys ||
            s.active_addresses !== s.prev_active_addresses ||
            s.owner_accounts !== s.prev_owner_accounts ||
            s.owner_keys !== s.prev_owner_keys ||
            s.owner_addresses !== s.prev_owner_addresses ||
            s.active_threshold !== s.prev_active_threshold ||
            s.owner_threshold !== s.prev_owner_threshold ||
            s.memo_key !== s.prev_memo_key
        );
    }

    function didChange(type: string, s: any = state) {
        if (type === "memo") {
            return s.memo_key !== s.prev_memo_key;
        }
        let changed = false;
        ["_keys", "_active_addresses", "_accounts", "_threshold"].forEach(
            key => {
                const current = type + key;
                if (s[current] !== s["prev_" + current]) {
                    changed = true;
                }
            }
        );
        return changed;
    }

    function isValidPubKey(value: any) {
        return !!(PublicKey as any).fromPublicKeyString(value);
    }

    function onPublish() {
        const s = state;
        const updated_account = account.toJS();

        // Set fee asset
        updated_account.fee = {
            amount: 0,
            asset_id: (accountUtils as any).getFinalFeeAsset(
                updated_account.id,
                "account_update"
            )
        };

        const updateObject: any = {
            account: updated_account.id
        };

        if (didChange("active")) {
            updateObject.active = permissionsToJson(
                s.active_threshold,
                s.active_accounts,
                s.active_keys,
                s.active_addresses,
                s.active_weights
            );
        }
        if (didChange("owner")) {
            updateObject.owner = permissionsToJson(
                s.owner_threshold,
                s.owner_accounts,
                s.owner_keys,
                s.owner_addresses,
                s.owner_weights
            );
        }
        if (
            didChange("owner") &&
            s.owner_keys.size === 0 &&
            s.owner_addresses.size === 0 &&
            s.owner_accounts.size === 1 &&
            s.owner_accounts.first() === updated_account.id
        ) {
            return (Notification as any).warning({
                message: counterpart.translate(
                    "notifications.account_permissions_update_warning"
                )
            });
        }
        if (s.memo_key && didChange("memo") && isValidPubKey(s.memo_key)) {
            updateObject.new_options = account.get("options").toJS();
            updateObject.new_options.memo_key = s.memo_key;
        }

        (ApplicationApi as any).updateAccount(updateObject);
    }

    function onReset() {
        const s = state;
        mergeState({
            active_accounts: s.prev_active_accounts,
            active_keys: s.prev_active_keys,
            active_addresses: s.prev_active_addresses,
            owner_accounts: s.prev_owner_accounts,
            owner_keys: s.prev_owner_keys,
            owner_addresses: s.prev_owner_addresses,
            active_weights: s.prev_active_weights,
            owner_weights: s.prev_owner_weights,
            active_threshold: s.prev_active_threshold,
            owner_threshold: s.prev_owner_threshold,
            memo_key: s.prev_memo_key
        });
    }

    function onAddItem(collection: string, item_value: any, weight: any) {
        const list =
            collection +
            ((utils as any).is_object_id(item_value) ? "_accounts" : "_keys");
        const updatedList = state[list].push(item_value);
        state[collection + "_weights"][item_value] = weight;
        mergeState({[list]: updatedList});
    }

    function onRemoveItem(
        collection: string,
        item_value: any,
        listSuffix: string
    ) {
        console.log("onRemoveItem", collection, item_value, listSuffix);
        const list = collection + listSuffix;
        mergeState({
            [list]: state[list].filter((i: any) => i !== item_value)
        });
    }

    function onThresholdChanged(var_name: string, event: any) {
        const value = parseInt(event.target.value.trim());
        mergeState({[var_name]: value});
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function validateAccount(collection: string, acct: any) {
        return null;
    }

    function sumUpWeights(
        accounts: any,
        keys: any,
        addresses: any,
        weights: any
    ) {
        let sum = accounts.reduce((sum: any, a: any) => sum + weights[a], 0);
        sum = keys.reduce((sum: any, a: any) => sum + weights[a], sum);
        return addresses.reduce((sum: any, a: any) => sum + weights[a], sum);
    }

    function onMemoKeyChanged(memo_key: string) {
        mergeState({memo_key});
    }

    function onSetPasswordKeys(
        keys: any,
        roles: string[] = ["active", "owner", "memo"]
    ) {
        const newState: any = {};

        roles.forEach(role => {
            newState[`password_${role}`] = keys[role];
        });

        mergeState(newState);
    }

    function onPdfCreate() {
        (createPaperWalletAsPDF as any)(account);
    }

    let error1, error2;

    const {active_accounts, active_keys, active_addresses, active_weights} =
        state;
    const {owner_accounts, owner_keys, owner_addresses, owner_weights} =
        state;

    let threshold = state.active_threshold > 0 ? state.active_threshold : 0;
    let weights_total = sumUpWeights(
        active_accounts,
        active_keys,
        active_addresses,
        active_weights
    );
    if (didChange("active") && weights_total < threshold)
        error1 = counterpart.translate("account.perm.warning1", {
            weights_total,
            threshold
        });

    threshold = state.owner_threshold > 0 ? state.owner_threshold : 0;
    weights_total = sumUpWeights(
        owner_accounts,
        owner_keys,
        owner_addresses,
        owner_weights
    );
    if (didChange("owner") && weights_total < threshold)
        error2 = counterpart.translate("account.perm.warning2", {
            weights_total,
            threshold
        });

    const publish_buttons_class =
        "button" +
        (!(error1 || error2) &&
        isChanged() &&
        isValidPubKey(state.memo_key)
            ? ""
            : " disabled");
    const reset_buttons_class = "button" + (isChanged() ? "" : " disabled");

    let accountsList = Immutable.Set();
    accountsList = accountsList.add(account.get("id"));

    if (!state.active_accounts) {
        // Initial render, before the mount effect has seeded state yet.
        return null;
    }

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <Tabs
                        defaultActiveTab={1}
                        segmented={false}
                        setting="permissionsTab"
                        className="account-tabs"
                        tabsClass="account-overview bordered-header content-block"
                        contentClass="padding"
                        actionButtons={
                            <div className="action-buttons">
                                <button
                                    className={reset_buttons_class}
                                    onClick={onReset}
                                    tabIndex={8}
                                >
                                    <Translate content="account.perm.reset" />
                                </button>

                                <button
                                    className={publish_buttons_class}
                                    onClick={onPublish}
                                    tabIndex={9}
                                >
                                    <Translate content="account.perm.publish" />
                                </button>
                                <button
                                    className={"button"}
                                    style={{marginLeft: 10}}
                                    data-tip={counterpart.translate(
                                        "account.perm.create_paperwallet_private_hint"
                                    )}
                                    onClick={() => {
                                        onPdfCreate();
                                    }}
                                    tabIndex={10}
                                >
                                    <Translate content="account.perm.create_paperwallet" />
                                </button>
                            </div>
                        }
                    >
                        <Tab title="account.perm.active">
                            <HelpContent path="components/AccountPermActive" />
                            <form className="threshold">
                                <label className="horizontal">
                                    <Translate content="account.perm.threshold" />{" "}
                                    &nbsp; &nbsp;
                                    <input
                                        type="number"
                                        placeholder="0"
                                        size={5}
                                        value={state.active_threshold}
                                        onChange={(e: any) =>
                                            onThresholdChanged(
                                                "active_threshold",
                                                e
                                            )
                                        }
                                        autoComplete="off"
                                        tabIndex={1}
                                    />
                                </label>
                            </form>
                            <AccountPermissionsList
                                label="account.perm.add_permission_label"
                                accounts={active_accounts}
                                keys={active_keys}
                                weights={active_weights}
                                addresses={active_addresses}
                                validateAccount={(acct: any) =>
                                    validateAccount("active", acct)
                                }
                                onAddItem={(item_value: any, weight: any) =>
                                    onAddItem("active", item_value, weight)
                                }
                                onRemoveItem={(
                                    item_value: any,
                                    listSuffix: string
                                ) =>
                                    onRemoveItem(
                                        "active",
                                        item_value,
                                        listSuffix
                                    )
                                }
                                placeholder={counterpart.translate(
                                    "account.perm.account_name_or_key"
                                )}
                                tabIndex={2}
                            />
                            <br />
                            {error1 ? (
                                <div className="content-block has-error">
                                    {error1}
                                </div>
                            ) : null}
                        </Tab>

                        <Tab title="account.perm.owner">
                            <HelpContent path="components/AccountPermOwner" />
                            <form className="threshold">
                                <label className="horizontal">
                                    <Translate content="account.perm.threshold" />{" "}
                                    &nbsp; &nbsp;
                                    <input
                                        type="number"
                                        placeholder="0"
                                        size={5}
                                        value={state.owner_threshold}
                                        onChange={(e: any) =>
                                            onThresholdChanged(
                                                "owner_threshold",
                                                e
                                            )
                                        }
                                        autoComplete="off"
                                        tabIndex={4}
                                    />
                                </label>
                            </form>
                            <AccountPermissionsList
                                label="account.perm.add_permission_label"
                                accounts={owner_accounts}
                                keys={owner_keys}
                                weights={owner_weights}
                                addresses={owner_addresses}
                                validateAccount={(acct: any) =>
                                    validateAccount("owner", acct)
                                }
                                onAddItem={(item_value: any, weight: any) =>
                                    onAddItem("owner", item_value, weight)
                                }
                                onRemoveItem={(
                                    item_value: any,
                                    listSuffix: string
                                ) =>
                                    onRemoveItem(
                                        "owner",
                                        item_value,
                                        listSuffix
                                    )
                                }
                                placeholder={counterpart.translate(
                                    "account.perm.account_name_or_key"
                                )}
                                tabIndex={5}
                            />
                            <br />
                            {error2 ? (
                                <div className="content-block has-error">
                                    {error2}
                                </div>
                            ) : null}
                        </Tab>

                        <Tab title="account.perm.memo_key">
                            <HelpContent
                                style={{maxWidth: "800px"}}
                                path="components/AccountPermMemo"
                            />
                            <PubKeyInput
                                value={state.memo_key}
                                label="account.perm.memo_public_key"
                                placeholder="Public Key"
                                onChange={onMemoKeyChanged}
                                tabIndex={7}
                            />
                        </Tab>

                        <Tab title="account.perm.password_model">
                            <AccountPermissionsMigrate
                                active={state.password_active}
                                owner={state.password_owner}
                                memo={state.password_memo}
                                onSetPasswordKeys={onSetPasswordKeys}
                                account={account}
                                activeKeys={state.active_keys}
                                ownerKeys={state.owner_keys}
                                memoKey={state.memo_key}
                                onAddActive={(item_value: any, weight: any) =>
                                    onAddItem("active", item_value, weight)
                                }
                                onRemoveActive={(
                                    item_value: any,
                                    listSuffix: string
                                ) =>
                                    onRemoveItem(
                                        "active",
                                        item_value,
                                        listSuffix
                                    )
                                }
                                onAddOwner={(item_value: any, weight: any) =>
                                    onAddItem("owner", item_value, weight)
                                }
                                onRemoveOwner={(
                                    item_value: any,
                                    listSuffix: string
                                ) =>
                                    onRemoveItem(
                                        "owner",
                                        item_value,
                                        listSuffix
                                    )
                                }
                                onSetMemo={onMemoKeyChanged}
                            />
                        </Tab>
                    </Tabs>

                    <div className="tab-content" style={{padding: 10}}>
                        <div className="divider" />

                        <RecentTransactions
                            accountsList={accountsList}
                            limit={25}
                            compactView={false}
                            filter="account_update"
                            style={{paddingBottom: "2rem"}}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
