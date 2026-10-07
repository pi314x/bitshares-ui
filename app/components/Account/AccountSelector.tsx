// TypeScript/functional-component port of the legacy AccountSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `BindToChainState(Component)` (optional `account`, resolved but never
// gating render since it isn't `.isRequired`) replaced by a Container
// resolving `account` via `ChainStore.getAccount` under
// `useChainStoreTick()`. `connect(Component, {listenTo: [AccountStore],
// getProps})` replaced by `useAltStore(AccountStore)`.
//
// The class's `this.state.accountIndex` (a search-results array,
// *mutated in place* via `.push`/`.splice`/index-assignment across
// several methods, with `this.setState({accountIndex})` on the same
// reference used purely to trigger a re-render) cannot be translated to
// a plain `useState<any[]>` 1:1: React's `useState` setter bails out of
// re-rendering when given the exact same reference back (via
// `Object.is`), unlike a class's `setState`, which always re-renders
// regardless of reference equality. Replicated with a `useRef<any[]>()`
// holding the real mutable array (all mutation methods read/write
// `accountIndexRef.current`, exactly like the class read/wrote
// `this.state.accountIndex`) plus a small `renderTick` `useState`
// bumped wherever the original called `this.setState({accountIndex})`,
// whose only job is forcing the re-render the ref mutation itself can't.
//
// `componentDidUpdate` (focuses the input when `focus && editable &&
// !disabled`; notifies `onAccountChanged` when the *resolved* `account`
// prop reference changes) runs after every update but *not* after the
// initial mount - replicated with a `useEffect` (no dependency array,
// so it runs after every render) that returns early on the first render
// via a mount-flag ref, the reverse of this migration's usual
// mount+update unification (here mount is explicitly excluded, matching
// `componentDidUpdate`'s own semantics exactly). This effect uses its
// *own* mount-flag ref, separate from the mount-only effect above:
// effects run in declaration order within the same commit, so sharing
// one flag would make this effect see it already flipped to `false` on
// the very first render, wrongly firing componentDidUpdate's logic on
// mount too.
//
// The `ref="user_input"` on the plain-input branch is real and
// load-bearing here (read via `.focus()` in `componentDidUpdate`) -
// unlike the identically-named but dead ref in the sibling
// `AccountSelectorAnt.tsx` - translated to a real `useRef()` object ref.
//
// Preserved verbatim as a real bug (not "fixed"): `_fetchAccounts`'s
// `search_array.splice(account.get("name"))` / `search_array.splice(
// search_array[i])` pass a *name string* (not a numeric index) as
// `splice`'s `start` argument - `Number(name)` is `NaN`, which clamps to
// `0`, so each call actually empties the *entire* `search_array` from
// index 0 onward (almost certainly meant to be a single-element removal
// by index), not just the one matched account. Left exactly as-is.
import * as React from "react";
import utils from "common/utils";
import AccountImage from "../Account/AccountImage";
import AccountStore from "stores/AccountStore";
import AccountActions from "actions/AccountActions";
import Translate from "react-translate-component";
import {
    ChainStore,
    PublicKey,
    ChainValidation,
    FetchChain,
    FetchChainObjects
} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useAltStore} from "../../next/hooks/useAltStore";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import accountUtils from "common/account_utils";
import cnames from "classnames";
import {Tooltip} from "../../design-system/Tooltip";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Icon as AntIcon} from "../../design-system/Icon";
import {Select} from "../../design-system/Select";
import {Form} from "../../design-system/Form";

const MAX_LOOKUP_ATTEMPTS = 5;

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
    includeMyActiveAccounts?: boolean;
    focus?: boolean;
    disabled?: boolean | null;
    editable?: boolean | null;
    locked?: boolean;
    requireActiveSelect?: boolean;
    noForm?: boolean;
    autosubscribe?: boolean;
    allowPubKey?: boolean;
    myActiveAccounts?: any;
    contacts?: any;
    hideImage?: boolean;
    size?: number;
    style?: any;
    tooltip?: any;
    action_label?: any;
    children?: any;
    [key: string]: any;
}

interface AccountSelectorState {
    locked: boolean | null;
}

function AccountSelector({
    excludeAccounts = [],
    includeMyActiveAccounts = true,
    disabled = null,
    editable = null,
    locked = false,
    requireActiveSelect = true, // Should not be set to false, required for fallback
    noForm = false,
    ...restProps
}: AccountSelectorCoreProps) {
    const props: AccountSelectorCoreProps = {
        excludeAccounts,
        includeMyActiveAccounts,
        disabled,
        editable,
        locked,
        requireActiveSelect,
        noForm,
        ...restProps
    };

    const [state, setState] = React.useState<AccountSelectorState>({
        locked: null
    });

    const mergeState = (partial: Partial<AccountSelectorState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const accountIndexRef = React.useRef<any[]>([]);
    const [, setRenderTick] = React.useState(0);
    const forceUpdate = () => setRenderTick(t => t + 1);

    const timerRef = React.useRef<any>(null);
    const userInputRef = React.useRef<any>(null);

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

    const getIndex = (name: any, index: any) => {
        return index.findIndex((a: any) => a.name === name);
    };

    const populateAccountIndexWithPublicKey = (publicKey: any) => {
        const accountType = getInputType(publicKey);
        const rightLabel = "Public Key";

        return {
            name: publicKey,
            attempts: 0,
            data: {
                name: publicKey,
                type: accountType,
                rightLabel: rightLabel
            }
        };
    };

    const populateAccountIndex = (accountResult: any) => {
        const {myActiveAccounts, contacts} = props;

        // Should not happen, just failsafe
        if (!accountResult) return null;

        const accountName = accountResult.get("name");
        const accountStatus = (ChainStore as any).getAccountMemberStatus(
            accountResult
        );
        const accountType = getInputType(accountName);

        const statusLabel = !(accountUtils as any).isKnownScammer(accountName)
            ? counterpart.translate("account.member." + accountStatus)
            : counterpart.translate("account.member.suspected_scammer");

        const rightLabel =
            accountType === "name"
                ? "#" + accountResult.get("id").substring(4)
                : accountType === "id"
                ? accountResult.get("name")
                : accountType == "pubkey" && props.allowPubKey
                ? "Public Key"
                : null;

        return {
            name: accountName,
            attempts: 0,
            data: {
                id: accountResult.get("id"),
                name: accountName,
                type: accountType,
                status: accountStatus,
                isOwnAccount: myActiveAccounts.has(accountName),
                isContact: contacts.has(accountName),
                isKnownScammer: (accountUtils as any).isKnownScammer(
                    accountName
                ),
                statusLabel: statusLabel,
                rightLabel: rightLabel,
                className:
                    (accountUtils as any).isKnownScammer(accountName) ||
                    !accountResult
                        ? "negative"
                        : null
            }
        };
    };

    const getSearchArray = () => {
        const accountIndex = accountIndexRef.current;

        // For all objects in search_array, query with FetchChainObjects
        // Update results for each object with returned data and remove from search_array
        // Update search_array for all remaining objects with increased attempts count
        // which is when account does not exists, but can also be if node failed to send results
        // back in time, so we query at least `MAX_LOOKUP_ATTEMPTS` times before we stop

        // Filter out what objects we still require data for
        const search_array = accountIndex
            .filter(search => {
                return !search.data && search.attempts < MAX_LOOKUP_ATTEMPTS
                    ? search.name
                    : null;
            })
            .map(search => {
                return search.name;
            });

        return search_array;
    };

    const fetchAccounts = () => {
        const accountIndex = accountIndexRef.current;

        const search_array = getSearchArray();

        if (search_array.length > 0) {
            if (__DEV__)
                console.log("Looked for " + search_array.length + " accounts");
            (FetchChainObjects as any)(
                ChainStore.getAccount,
                search_array,
                3000,
                {}
            ).then((accounts: any) => {
                for (let i = 0; i < accounts.length; i++) {
                    const account = accounts[i];
                    if (account) {
                        const objectIndex = getIndex(
                            account.get("name"),
                            accountIndex
                        );
                        const result = populateAccountIndex(account);

                        if (result) {
                            accountIndex[objectIndex] = result;
                            search_array.splice(account.get("name"));
                        }
                    } else {
                        const objectIndex = getIndex(
                            search_array[i],
                            accountIndex
                        );
                        const result = populateAccountIndexWithPublicKey(
                            search_array[i]
                        );

                        if (result) {
                            accountIndex[objectIndex] = result;
                            search_array.splice(search_array[i]);
                        }
                    }
                }
                search_array.forEach((account_to_find: any) => {
                    const objectIndex = getIndex(
                        account_to_find,
                        accountIndex
                    );
                    accountIndex[objectIndex].attempts++;
                });
                forceUpdate();

                // Run another fetch of accounts if data is still missing
                const isDataMissing = accountIndexRef.current.find(
                    a => !a.data && a.attempts < MAX_LOOKUP_ATTEMPTS
                );

                if (isDataMissing) {
                    setTimeout(() => {
                        fetchAccounts();
                    }, 500);
                }
            });
        }
    };

    const addThisToIndex = (accountName: any) => {
        const accountIndex = accountIndexRef.current;

        if (!accountName) return;

        const inAccountList = accountIndex.find(a => a.name === accountName);

        if (accountName && !inAccountList) {
            accountIndex.push({
                name: accountName,
                data: null,
                attempts: 0
            });
        }
    };

    const addToIndex = (accountName: any, noDelay = false) => {
        if (noDelay) {
            addThisToIndex(accountName);
            fetchAccounts();
        } else {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                addToIndex(accountName, true);
            }, 500);
        }
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

    const notifyOnChange = (selectedAccountName: any, inputType: any) => {
        // Clear selected account when we have new input data if we require an active select
        if (
            inputType == "input" &&
            props.typeahead &&
            props.requireActiveSelect
        ) {
            if (!!props.onAccountChanged) {
                props.onAccountChanged(null);
            }
            if (!!props.onChange) {
                props.onChange(null);
            }
        }

        const accountName = getVerifiedAccountName(selectedAccountName);

        // Synchronous onChange for input change
        if (!!props.onChange && (!!accountName || accountName === "")) {
            props.onChange(accountName);
        }

        // asynchronous onAccountChanged for checking on chain
        const onAccountChanged = props.onAccountChanged;
        if (!!onAccountChanged) {
            FetchChain("getAccount", accountName, undefined, {
                [accountName]: false
            })
                .then((account: any) => {
                    if (
                        !!account &&
                        ((props.requireActiveSelect &&
                            inputType == "select") ||
                            !props.requireActiveSelect)
                    ) {
                        onAccountChanged(account);
                    }
                })
                .catch((err: any) => {
                    console.log(err);
                });
        }
    };

    const onSelect = (selectedAccountName: any) => {
        notifyOnChange(selectedAccountName, "select");
    };

    const onInputChanged = (e: any) => {
        addToIndex(getVerifiedAccountName(e));
        notifyOnChange(e, "input");
    };

    const onAction = (e: any) => {
        const {
            onAction: onActionProp,
            disableActionButton,
            account,
            accountName
        } = props;
        e.preventDefault();
        if (!getError() && onActionProp && !disableActionButton) {
            if (account) onActionProp(account);
            else if (getInputType(accountName) === "pubkey")
                onActionProp(accountName);
        }
    };

    const onKeyDown = (e: any) => {
        if (e.keyCode === 13 || e.keyCode === 9) {
            onAction(e);
        }
    };

    const onAddContact = () => {
        (AccountActions as any).addAccountContact(props.accountName);
    };

    const onRemoveContact = () => {
        (AccountActions as any).removeAccountContact(props.accountName);
    };

    const getError = () => {
        const {account, accountName, typeahead} = props;
        let {error} = props;

        const inputType = accountName ? getInputType(accountName) : null;

        if (!typeahead) {
            if (!account && accountName && inputType !== "pubkey") {
                error = counterpart.translate("account.errors.unknown");
            }
        } else {
            // Typeahead can't select an unknown account!
            // if (
            //     !(allowPubKey && inputType === "pubkey") &&
            //     !error &&
            //     accountName &&
            //     !account
            // )
            //     error = counterpart.translate("account.errors.unknown");
        }

        if (!error && account && !inputType)
            error = counterpart.translate("account.errors.invalid");

        return error;
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            const {account, accountName} = props;

            // Populate account search array, fetch only once
            if (accountName) {
                addThisToIndex(accountName);
            }
            if (props.includeMyActiveAccounts) {
                props.myActiveAccounts.map((a: any) => {
                    addThisToIndex(a);
                });
            }
            props.contacts.map((a: any) => {
                addThisToIndex(a);
            });
            fetchAccounts();

            if (props.onAccountChanged && account)
                props.onAccountChanged(account);

            if (!props.typeahead && accountName) onInputChanged(accountName);
        }
    }, []);

    // Separate mount-flag ref from the mount-only effect above: effects
    // run in declaration order within the same commit, so sharing one
    // flag would make this effect see it already flipped to `false` on
    // the very first render, wrongly firing componentDidUpdate's logic
    // on mount too.
    const isUpdateMountRef = React.useRef(true);
    const prevAccountRef = React.useRef(props.account);
    React.useEffect(() => {
        if (isUpdateMountRef.current) {
            isUpdateMountRef.current = false;
        } else {
            if (props.focus && !!props.editable && !props.disabled) {
                userInputRef.current && userInputRef.current.focus();
            }

            if (
                prevAccountRef.current &&
                prevAccountRef.current !== props.account
            ) {
                if (props.onAccountChanged) {
                    props.onAccountChanged(props.account);
                }
            }
        }
        prevAccountRef.current = props.account;
    });

    const accountIndex = accountIndexRef.current;

    const {account, accountName, disableActionButton} = props;

    const searchInProgress = accountIndex.find(
        a => !a.data && a.attempts < MAX_LOOKUP_ATTEMPTS
    );

    const lockedState = state.locked !== null ? state.locked : props.locked;

    const error: any = getError();
    let formContainer,
        selectedAccount: any,
        linked_status;

    const editableInput = !!lockedState
        ? false
        : props.editable != null
        ? props.editable
        : undefined;

    const disabledInput = !!lockedState
        ? true
        : props.disabled != null
        ? props.disabled
        : undefined;

    // Selected Account
    if (account) {
        const objectIndex = getIndex(account.get("name"), accountIndex);

        selectedAccount =
            accountIndex && accountIndex[objectIndex]
                ? accountIndex[objectIndex].data
                : null;
    }
    if (props.allowPubKey) {
        const objectIndex = accountIndex.findIndex(
            a => a.name === accountName
        );

        selectedAccount =
            accountIndex && accountIndex[objectIndex]
                ? accountIndex[objectIndex].data
                : null;
    }
    const disabledAction =
        !(account || (selectedAccount && selectedAccount.type === "pubkey")) ||
        error ||
        disableActionButton;

    if (selectedAccount && selectedAccount.isKnownScammer) {
        linked_status = (
            <Tooltip
                placement="top"
                title={counterpart.translate("tooltip.scam_account")}
            >
                <span className="tooltip red">
                    <AntIcon type="warning" theme="filled" />
                </span>
            </Tooltip>
        );
    } else if (selectedAccount && selectedAccount.isContact) {
        linked_status = (
            <Tooltip
                placement="top"
                title={counterpart.translate("tooltip.follow_user")}
                onClick={onRemoveContact}
            >
                <span className="tooltip green">
                    <AntIcon type="star" theme="filled" />
                </span>
            </Tooltip>
        );
    } else if (selectedAccount && selectedAccount.isOwnAccount) {
        linked_status = (
            <Tooltip
                placement="top"
                title={counterpart.translate("tooltip.own_account")}
            >
                <span className="tooltip green">
                    <AntIcon type="user" />
                </span>
            </Tooltip>
        );
    } else if (selectedAccount) {
        linked_status = (
            <Tooltip
                placement="top"
                title={counterpart.translate("tooltip.follow_user_add")}
                onClick={onAddContact}
            >
                <span className="tooltip">
                    <AntIcon type="star" />
                </span>
            </Tooltip>
        );
    }

    if (props.typeahead) {
        const optionsContainer = accountIndex
            .filter(acc => {
                // Filter accounts based on
                // - Exclude without results (missing chain data at the moment)
                // - Excluded accounts (by props)
                // - Include users own accounts (isOwnAccount)
                // - Include users contacts (isContact) unless it's a previously locked input
                // - Include current input

                if (!acc.data) {
                    return null;
                }
                if ((props.excludeAccounts || []).indexOf(acc.id) !== -1) {
                    return null;
                }
                if (
                    (props.includeMyActiveAccounts && acc.data.isOwnAccount) ||
                    (!props.locked && acc.data.isContact) ||
                    (accountName && acc.data.name === accountName)
                ) {
                    return acc;
                }
            })
            .sort((a, b) => {
                if (a.data.isOwnAccount < b.data.isOwnAccount) {
                    if (a.data.name > b.data.name) {
                        return 1;
                    } else {
                        return -1;
                    }
                } else {
                    return -1;
                }
            })
            .map(acc => {
                return (
                    <Select.Option
                        key={acc.data.id}
                        value={acc.data.name}
                        disabled={acc.data.disabled ? true : undefined}
                    >
                        {acc.data.isKnownScammer ? (
                            <AntIcon type="warning" />
                        ) : acc.data.isContact ? (
                            <AntIcon type="star" />
                        ) : acc.data.isOwnAccount ? (
                            <AntIcon type="user" />
                        ) : null}
                        &nbsp;
                        {acc.data.name}
                        <span style={{float: "right"}}>
                            {acc.data.statusLabel}
                        </span>
                    </Select.Option>
                );
            });

        formContainer = (
            <Select
                showSearch
                optionLabelProp={"value"}
                onSelect={onSelect}
                onSearch={onInputChanged}
                placeholder={counterpart.translate("account.search")}
                notFoundContent={counterpart.translate("global.not_found")}
                value={selectedAccount ? selectedAccount.name : undefined}
                disabled={disabledInput ? true : undefined}
            >
                {optionsContainer}
            </Select>
        );
    } else {
        formContainer = (
            <Input
                style={{
                    textTransform:
                        selectedAccount && selectedAccount.type === "pubkey"
                            ? undefined
                            : "lowercase",
                    fontVariant: "initial"
                }}
                name="username"
                id="username"
                autoComplete={!!props.editable ? "username" : undefined}
                type="text"
                value={props.accountName || ""}
                placeholder={
                    props.placeholder || counterpart.translate("account.name")
                }
                disabled={props.disabled ? true : undefined}
                ref={userInputRef}
                onChange={onInputChanged}
                onKeyDown={onKeyDown}
                tabIndex={
                    !props.editable || !!props.disabled ? -1 : props.tabIndex
                }
                /* Dropped as confirmed dead: `editable` isn't a real HTML
                 * or antd `Input` attribute (it just rendered as an
                 * inert, non-standard DOM attribute under antd's loose
                 * typing) - never read by anything, unlike `props
                 * .editable` above/below, which is this component's own,
                 * genuinely-used prop. */
                /* Preserved verbatim, not "fixed": `.toString()` turns
                 * this into the string "true"/"false", which HTML's
                 * native readOnly attribute treats as truthy either way
                 * (any non-empty string), so this has always made the
                 * input read-only whenever editableInput is set,
                 * regardless of its actual boolean value. Cast to keep
                 * that exact (buggy) runtime behavior under the
                 * stricter native `readOnly?: boolean` typing. */
                readOnly={
                    (!!editableInput
                        ? (!editableInput).toString()
                        : undefined) as any
                }
            />
        );
    }

    const accountImageContainer = props.hideImage ? null : selectedAccount &&
      selectedAccount.type === "pubkey" ? (
        <div className="account-image">
            <Icon name="key" title="icons.key" size="4x" />
        </div>
    ) : (
        <AccountImage
            size={{
                height: props.size || 33,
                width: props.size || 33
            }}
            account={selectedAccount ? selectedAccount.name : null}
            custom_image={null}
        />
    );

    const lockedStateContainer = !lockedState ? null : (
        <Tooltip title={counterpart.translate("tooltip.unlock_account_name")}>
            <div
                style={{
                    lineHeight: "2rem",
                    marginLeft: "10px",
                    cursor: "pointer"
                }}
                onClick={() => mergeState({locked: false})}
            >
                <AntIcon style={{fontSize: "1rem"}} type={"edit"} />
            </div>
        </Tooltip>
    );

    const rightLabelContainer =
        !props.label || !selectedAccount ? null : (
            <div
                className={
                    "header-area" + (props.hideImage ? " no-margin" : "")
                }
            >
                <label
                    className={cnames(
                        "right-label",
                        selectedAccount.isKnownScammer
                            ? "negative"
                            : selectedAccount.isContact ||
                              selectedAccount.isOwnAccount
                            ? "positive"
                            : null
                    )}
                    style={{marginTop: -30}}
                >
                    <span style={{paddingRight: "0.5rem"}}>
                        {selectedAccount.rightLabel}
                    </span>
                    {linked_status}
                </label>
            </div>
        );

    const FormWrapper: any = props.noForm ? React.Fragment : Form;
    const formWrapperProps = props.noForm
        ? {}
        : {
              className: "full-width",
              layout: "vertical",
              style: props.style
          };

    return (
        <Tooltip
            className="input-area"
            title={props.tooltip}
            mouseEnterDelay={0.5}
        >
            <FormWrapper {...formWrapperProps}>
                <Form.Item
                    label={
                        props.label ? counterpart.translate(props.label) : ""
                    }
                    validateStatus={error ? "error" : ""}
                    help={error ? error : null}
                >
                    {rightLabelContainer}
                    {props.useHR && <hr />}
                    <div className="inline-label input-wrapper">
                        {accountImageContainer}
                        {formContainer}
                        {searchInProgress ? (
                            <AntIcon type="loading" style={{padding: 10}} />
                        ) : null}
                        {lockedStateContainer}
                        {props.children}
                        {props.onAction ? (
                            <Tooltip
                                title={counterpart.translate(
                                    "tooltip.required_input",
                                    {
                                        type: counterpart.translate(
                                            "global.field_type.account"
                                        )
                                    }
                                )}
                            >
                                <Button
                                    variant="accent"
                                    disabled={disabledAction}
                                    onClick={onAction}
                                >
                                    <Translate content={props.action_label} />
                                </Button>
                            </Tooltip>
                        ) : null}
                    </div>
                </Form.Item>
            </FormWrapper>
        </Tooltip>
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
