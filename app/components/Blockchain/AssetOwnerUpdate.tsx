// TypeScript/functional-component port of the legacy
// AssetOwnerUpdate.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes.
//
// Not security-sensitive per AGENTS.md in this file itself: grepped for
// `WalletApi`/`WalletDb`/`ApplicationApi`/`.add_type_operation`/
// `process_transaction` - none appear. `onSubmit` dispatches to
// `AssetActions.updateOwner(asset, new_issuer_account_id)`, an action
// creator defined elsewhere that builds/submits the actual
// `asset_update` transaction - transcribed verbatim as a plain call,
// same as the original.
//
// Structural change (not a behavior change): `AssetOwnerUpdate =
// BindToChainState(AssetOwnerUpdate)` (required `account:
// ChainTypes.ChainAccount`, `currentOwner: ChainTypes.ChainAccount`, no
// `defaultProps.tempComponent` and no `show_loader` option passed at the
// wrap site) becomes an `AssetOwnerUpdateContainer`/
// `AssetOwnerUpdateCore` split:
// - `resolveAccount` below re-implements `BindToChainState.jsx`'s
//   `chain_accounts` resolution branch (the "#123" shorthand rewrite to
//   "1.2.123", and the single-key-Map-with-a-"name" shortcut) for a
//   *single* `ChainAccount` prop, kept local to this file per this
//   migration's no-shared-helpers convention (distinct from the
//   `resolveAccountsList` helper in `ProposalModal.tsx`/
//   `NestedApprovalState.tsx`, which resolves the *list* variant and
//   has no such special-casing in the original HOC).
// - Both `account` and `currentOwner` gate the render on being
//   `undefined` (BindToChainState.jsx's exact "only `undefined` -
//   genuinely still-loading - blocks; a resolved `null` renders
//   through" semantics), falling back to a blank `<span/>` since
//   neither the original class nor its wrap site opts into
//   `tempComponent`/`show_loader` - this component is rendered inside a
//   `Panel` in `Asset.tsx`, not a `<table>`, so a bare `<span/>`
//   fallback is valid here (unlike `Operation.tsx`'s `Row`).
// - `account` itself is grep-confirmed dead as a *value* in the
//   original class body (only ever declared in `propTypes`, never read
//   in `render`/any method - it exists solely to make BindToChainState
//   block rendering until it resolves) - still resolved and gated on
//   for that blocking behavior, but not forwarded into
//   `AssetOwnerUpdateCore`'s props, since nothing there would read it.
//
// The class's `constructor()` took no `props` argument (didn't call
// `super(props)`) - a pre-existing harmless quirk (the constructor body
// never touched `this.props` anyway) with no equivalent to preserve in
// a function component, since there's no constructor at all.
//
// `onAccountNameChanged(key, name)`/`onAccountChanged(key, account)`
// were generic, `.bind(this, key)`-partially-applied methods, but each
// had exactly one real call site in `render()` (bound to
// `"issuer_account_name"` and `"new_issuer_account_id"` respectively,
// grep-confirmed) - inlined here as two single-purpose handlers rather
// than replicating the generic-by-key indirection, since there's only
// ever one key each could be called with.
import * as React from "react";
import AccountSelector from "../Account/AccountSelector";
import Translate from "react-translate-component";
import classnames from "classnames";
import AssetActions from "actions/AssetActions";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

function resolveAccount(prop: any, autosubscribe?: boolean): any {
    if (!prop) return undefined;
    let resolvedProp = prop;
    if (
        resolvedProp[0] === "#" &&
        Number.parseInt(resolvedProp.substring(1))
    ) {
        resolvedProp = "1.2." + resolvedProp.substring(1);
    }
    if (
        resolvedProp instanceof Map &&
        !!resolvedProp.get("name") &&
        resolvedProp.size === 1
    ) {
        resolvedProp = resolvedProp.get("name");
    }
    return (ChainStore as any).getAccount(resolvedProp, autosubscribe);
}

interface AssetOwnerUpdateState {
    new_issuer_account_id: any;
    issuer_account_name: any;
}

interface AssetOwnerUpdateCoreProps {
    currentOwner: any;
    asset?: any;
}

function AssetOwnerUpdateCore({
    currentOwner,
    asset
}: AssetOwnerUpdateCoreProps) {
    const [state, setState] = React.useState<AssetOwnerUpdateState>({
        new_issuer_account_id: null,
        issuer_account_name: null
    });

    const mergeState = (patch: Partial<AssetOwnerUpdateState>) =>
        setState(prev => ({...prev, ...patch}));

    const onAccountNameChanged = (name: any) => {
        mergeState({issuer_account_name: name});
    };

    const onAccountChanged = (account: any) => {
        mergeState({
            new_issuer_account_id: account ? account.get("id") : null
        });
    };

    const onReset = () => {
        setState({
            new_issuer_account_id: null,
            issuer_account_name: null
        });
    };

    const onSubmit = () => {
        (AssetActions as any)
            .updateOwner(asset, state.new_issuer_account_id)
            .then(() => {
                onReset();
            });
    };

    return (
        <div>
            <div style={{paddingBottom: "1rem"}}>
                <AccountSelector
                    label="account.user_issued_assets.current_issuer"
                    accountName={currentOwner.get("name")}
                    account={currentOwner.get("name")}
                    error={null}
                    tabIndex={1}
                    disabled={true}
                />
            </div>
            <AccountSelector
                label="account.user_issued_assets.new_issuer"
                accountName={state.issuer_account_name}
                onChange={onAccountNameChanged}
                onAccountChanged={onAccountChanged}
                account={state.issuer_account_name}
                error={null}
                tabIndex={1}
                typeahead={true}
                excludeAccounts={[currentOwner.get("name")]}
            />
            <div style={{paddingTop: "1rem"}} className="button-group">
                <button
                    className={classnames("button", {
                        disabled: !state.new_issuer_account_id
                    })}
                    onClick={onSubmit}
                >
                    <Translate content="account.user_issued_assets.update_owner" />
                </button>
                <button className="button outline" onClick={onReset}>
                    <Translate content="account.perm.reset" />
                </button>
            </div>
        </div>
    );
}

interface AssetOwnerUpdateContainerProps {
    account: any;
    currentOwner: any;
    asset?: any;
    [key: string]: any;
}

function AssetOwnerUpdateContainer({
    account,
    currentOwner,
    ...rest
}: AssetOwnerUpdateContainerProps) {
    useChainStoreTick();
    const resolvedAccount = resolveAccount(account);
    const resolvedCurrentOwner = resolveAccount(currentOwner);

    if (resolvedAccount === undefined || resolvedCurrentOwner === undefined) {
        return <span />;
    }

    return (
        <AssetOwnerUpdateCore
            {...(rest as any)}
            currentOwner={resolvedCurrentOwner}
        />
    );
}

export default AssetOwnerUpdateContainer;
