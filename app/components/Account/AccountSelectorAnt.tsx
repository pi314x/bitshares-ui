// TypeScript/functional-component port of the legacy
// AccountSelectorAnt.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// `BindToChainState(Component)` resolves the *optional* (not
// `.isRequired`) `account` prop (a `ChainTypes.ChainAccount`) - since
// it's not required, `BindToChainState`'s render-gate never blocks on
// it, so the Container here resolves `account` (when truthy) via
// `ChainStore.getAccount` under `useChainStoreTick()` and always
// renders, matching that. `connect(Component, {listenTo: [AccountStore],
// getProps})` (providing `myActiveAccounts`/`contacts`) is replaced by
// `useAltStore(AccountStore)`.
//
// Dropped as confirmed dead (found while porting, verified by grepping
// the whole app, not just this file): `getAccount()` and the
// `this.refs.account_selector.getAccount()` parent-ref-access pattern
// its comment describes - no caller anywhere in the codebase actually
// sets a ref on this component and calls `.getAccount()` on it (the
// identical comment/method pair also exists, equally unused, on the
// sibling `AccountSelector.jsx`).
//
// The legacy string ref `ref={this.props.inputRef || "user_input"}` on
// the inner `<Input>`: `"user_input"` was only ever a fallback ref
// *name* with no reader anywhere (string refs are only reachable via
// the owning class instance's own `this.refs`, which nothing here ever
// used) - a function component has no such fallback destination to
// begin with, so `ref={props.inputRef}` (a real object ref the one
// actual caller, `WalletUnlockModal.tsx`, already supplies via
// `React.useRef()`) replaces it directly.
//
// Dropped as confirmed dead: `noPlaceHolder`/`useHR`/`labelClass`/
// `reserveErrorSpace` were destructured from `props` in the original
// `render()` but never referenced anywhere afterward - still accepted
// as props (the type interface keeps them for callers), just not bound
// to local names here.
//
// Dropped as confirmed dead (verified against the original, not just
// this port): `linked_status` and `action_class`, two `render()`-body
// locals that were computed but never referenced by the original's own
// `return` statement either (it renders only `labelWrapper(<Input
// .../>)` - none of the typeahead/scammer/contact computation reaches
// the DOM in this particular component, unlike its more fully-wired
// sibling `AccountSelector.jsx`). Their only callers, `_onAddContact`/
// `_onRemoveContact` (and the `AccountActions`/`Icon`/`Tooltip`/
// `classnames` imports they alone needed), are dropped along with them
// for the same reason - they were only ever invoked from inside
// `linked_status`'s now-removed JSX.
//
// The `labelWrapper` closure referencing `error`/`account`/`displayText`
// - local variables declared *after* `labelWrapper` itself in the
// original render body - is preserved with the same relative ordering:
// this is legal because `labelWrapper` isn't actually *called* until
// after those variables are assigned (JS closures resolve free
// variables at call time, not definition time; TDZ only matters for
// reads that happen before the binding's own initializer has run).
import * as React from "react";
import utils from "common/utils";
import AccountStore from "stores/AccountStore";
import {ChainStore, PublicKey, ChainValidation, FetchChain} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useAltStore} from "../../next/hooks/useAltStore";
import counterpart from "counterpart";
import accountUtils from "common/account_utils";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";

interface AccountSelectorState {
    inputChanged: boolean;
}

interface AccountSelectorCoreProps {
    label?: string;
    error?: any;
    placeholder?: string;
    onChange?: (value: any) => void;
    onAccountChanged?: (account: any) => void;
    onAction?: (value: any) => void;
    accountName?: string;
    account?: any;
    tabIndex?: number;
    disableActionButton?: boolean;
    allowUppercase?: boolean;
    typeahead?: boolean;
    excludeAccounts?: any[];
    autosubscribe?: boolean;
    allowPubKey?: boolean;
    contacts?: any;
    myActiveAccounts?: any;
    noPlaceHolder?: any;
    useHR?: any;
    labelClass?: any;
    reserveErrorSpace?: any;
    style?: any;
    inputRef?: any;
    [key: string]: any;
}

function AccountSelector({
    excludeAccounts = [],
    ...restProps
}: AccountSelectorCoreProps) {
    const props: AccountSelectorCoreProps = {excludeAccounts, ...restProps};

    const [state, setState] = React.useState<AccountSelectorState>({
        inputChanged: false
    });

    const mergeState = (partial: Partial<AccountSelectorState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const getInputType = (value: any) => {
        // OK
        if (!value) return null;
        if (
            value[0] === "#" &&
            (utils as any).is_object_id("1.2." + value.substring(1))
        )
            return "id";
        if ((ChainValidation as any).is_account_name(value, true))
            return "name";
        if (
            props.allowPubKey &&
            (PublicKey as any).fromPublicKeyString(value)
        )
            return "pubkey";
        return null;
    };

    const getError = () => {
        const {account} = props;
        let {error} = props;

        if (!error && account && !getInputType(account.get("name")))
            error = counterpart.translate("account.errors.invalid");

        return error;
    };

    const getVerifiedAccountName = (e: any) => {
        const {allowUppercase} = props;

        let value = null;
        if (typeof e === "string") {
            value = e;
        } else if (e && e.target) {
            value = e.target.value.trim();
        } else {
            value = "";
        }

        if (!allowUppercase) value = value.toLowerCase();

        // If regex matches ^.*#/account/account-name/.*$, parse out account-name
        const _value = value.replace("#", "").match(/(?:\/account\/)(.*)/);
        if (_value) value = _value[1];

        return value;
    };

    const notifyOnChange = (e: any) => {
        const {onChange, onAccountChanged, accountName} = props;

        const _accountName = getVerifiedAccountName(e);

        if (_accountName === accountName) {
            // nothing has changed, don't notify
            return;
        }

        // Synchronous onChange for input change
        if (!!onChange && (!!_accountName || _accountName === ""))
            onChange(_accountName);

        // asynchronous onAccountChanged for checking on chain
        if (!!onAccountChanged) {
            FetchChain("getAccount", _accountName, undefined, {
                [_accountName]: false
            })
                .then((_account: any) => {
                    if (!!_account) {
                        onAccountChanged(_account);
                    }
                })
                .catch((err: any) => {
                    // error fetching
                    console.log(err);
                });
        }
    };

    const onInputChanged = (e: any) => {
        mergeState({inputChanged: true});
        notifyOnChange(e);
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            let {account} = props;
            const {accountName} = props;

            if (typeof account === "undefined")
                account = (ChainStore as any).getAccount(accountName);

            if (props.onAccountChanged && account)
                props.onAccountChanged(account);

            if (!props.typeahead && accountName) onInputChanged(accountName);
        }
    }, []);

    const prevAccountRef = React.useRef(props.account);
    React.useEffect(() => {
        if (props.account && props.account !== prevAccountRef.current) {
            if (props.onAccountChanged) props.onAccountChanged(props.account);
        }
        prevAccountRef.current = props.account;
    }, [props.account]);

    const onKeyDown = (e: any) => {
        if (e.keyCode === 13) onAction(e);
    };

    const onAction = (e: any) => {
        const {onAction: onActionProp, disableActionButton, account, accountName} = props;
        e.preventDefault();
        if (!getError() && onActionProp && !disableActionButton) {
            if (account) onActionProp(account);
            else if (getInputType(accountName) === "pubkey")
                onActionProp(accountName);
        }
    };

    const labelWrapper = (children: any) =>
        props.label ? (
            <div>
                <Form.Item
                    label={counterpart.translate(props.label)}
                    /* Dropped: antd's `hasFeedback` (a check/cross/
                     * spinner icon derived from validateStatus) - the
                     * design-system `Form.Item` only colors its own
                     * help text, not arbitrary children, per its own
                     * header comment (see `Utility/AssetInput.tsx`'s
                     * identical drop). */
                    validateStatus={
                        error ? "error" : account ? "success" : ""
                    }
                    help={
                        error ? (
                            error
                        ) : account ? (
                            <span className="positive">
                                {account && account.statusText}{" "}
                                {!!displayText && displayText}
                            </span>
                        ) : (
                            false
                        )
                    }
                >
                    {children}
                </Form.Item>
            </div>
        ) : (
            children
        );

    const {
        accountName,
        account,
        allowPubKey,
        typeahead,
        contacts,
        myActiveAccounts
    } = props;

    const inputType = getInputType(accountName);

    const typeAheadAccounts: any[] = [];
    let error = getError();
    let linkedAccounts = myActiveAccounts;
    linkedAccounts = linkedAccounts.concat(contacts);

    // Selected Account
    let displayText: any;
    if (account) {
        account.isKnownScammer = (accountUtils as any).isKnownScammer(
            account.get("name")
        );
        account.accountType = getInputType(account.get("name"));
        account.accountStatus = (ChainStore as any).getAccountMemberStatus(
            account
        );
        account.statusText = !account.isKnownScammer
            ? counterpart.translate("account.member." + account.accountStatus)
            : counterpart.translate("account.member.suspected_scammer");
        displayText =
            account.accountType === "name"
                ? "#" + account.get("id").substring(4)
                : account.accountType === "id"
                ? account.get("name")
                : null;
    }

    // Without Typeahead Error Handling
    if (!typeahead) {
        if (!account && accountName && inputType !== "pubkey") {
            error = counterpart.translate("account.errors.unknown");
        }
    } else {
        if (
            !(allowPubKey && inputType === "pubkey") &&
            !error &&
            accountName &&
            !account
        )
            error = counterpart.translate("account.errors.unknown");
    }
    if (allowPubKey && inputType === "pubkey") displayText = "Public Key";

    if (account && linkedAccounts)
        account.isFavorite =
            myActiveAccounts.has(account.get("name")) ||
            contacts.has(account.get("name"));

    if (typeahead && linkedAccounts) {
        linkedAccounts
            .map((accName: any) => {
                if ((props.excludeAccounts || []).indexOf(accName) !== -1)
                    return null;
                const acc = (ChainStore as any).getAccount(accName);
                const account_status = (ChainStore as any).getAccountMemberStatus(
                    acc
                );
                const account_status_text = !(
                    accountUtils as any
                ).isKnownScammer(accName)
                    ? "account.member." + account_status
                    : "account.member.suspected_scammer";

                typeAheadAccounts.push({
                    id: accName,
                    label: accName,
                    status: counterpart.translate(account_status_text),
                    className: (accountUtils as any).isKnownScammer(accName)
                        ? "negative"
                        : "positive"
                });
            })
            .filter((a: any) => !!a);
    }

    const typeaheadHasAccount = !!accountName
        ? typeAheadAccounts.reduce((bool: any, a: any) => {
              return bool || a.label === accountName;
          }, false)
        : false;

    if (!!accountName && !typeaheadHasAccount && state.inputChanged) {
        const _account = (ChainStore as any).getAccount(accountName);
        const _account_status = _account
            ? (ChainStore as any).getAccountMemberStatus(_account)
            : null;
        const _account_status_text = _account
            ? !(accountUtils as any).isKnownScammer(_account.get("name"))
                ? counterpart.translate("account.member." + _account_status)
                : counterpart.translate("account.member.suspected_scammer")
            : counterpart.translate("account.errors.unknown");

        typeAheadAccounts.push({
            id: props.accountName,
            label: props.accountName,
            status: _account_status_text,
            className:
                (accountUtils as any).isKnownScammer(accountName) || !_account
                    ? "negative"
                    : null,
            disabled: !_account ? true : false
        });
    }

    typeAheadAccounts.sort((a, b) => {
        if (a.label > b.label) return 1;
        else return -1;
    });

    return (
        <div className="account-selector" style={props.style}>
            <div className="content-area">
                {labelWrapper(
                    <Input
                        style={{
                            textTransform:
                                getInputType(accountName) === "pubkey"
                                    ? undefined
                                    : "lowercase",
                            fontVariant: "initial"
                        }}
                        name="username"
                        id="username"
                        autoComplete="username"
                        type="text"
                        value={props.accountName || ""}
                        placeholder={
                            props.placeholder ||
                            counterpart.translate("account.name")
                        }
                        ref={props.inputRef}
                        onChange={onInputChanged}
                        onKeyDown={onKeyDown}
                        tabIndex={props.tabIndex}
                    />
                )}
            </div>
        </div>
    );
}

interface AccountSelectorContainerProps
    extends Omit<AccountSelectorCoreProps, "myActiveAccounts" | "contacts"> {
    account?: any;
}

function AccountSelectorContainer(props: AccountSelectorContainerProps) {
    useChainStoreTick();
    const accountState = useAltStore<any>(AccountStore);

    const resolvedAccount = props.account
        ? (ChainStore as any).getAccount(props.account, props.autosubscribe)
        : props.account;

    return (
        <AccountSelector
            {...props}
            account={resolvedAccount}
            myActiveAccounts={accountState.myActiveAccounts}
            contacts={accountState.accountContacts}
        />
    );
}

export default AccountSelectorContainer;
