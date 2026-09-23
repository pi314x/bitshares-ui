// TypeScript/functional-component port of the legacy
// AccountPermissionsList.jsx (Phase 3, docs/UI_MIGRATION_PLAN.md). A
// reusable list-building UI for one authority's (active/owner/etc.)
// accounts/keys/addresses and their weights, used inside
// `AccountPermissions.jsx`. This component itself doesn't build or
// submit any transaction - it only maintains local selection/input state
// and calls back into caller-supplied `onAddItem`/`onRemoveItem`/
// `validateAccount` props, which is where `AccountPermissions.jsx` (not
// touched by this slice) actually assembles and publishes the
// `account_update` operation.
//
// The legacy `accounts` prop was typed `ChainTypes.ChainObjectsList` and
// resolved by the outer `BindToChainState(AccountPermissionsList,
// {autosubscribe: false})` wrap before this component's own render ran
// - i.e. `this.props.accounts` was already a list of resolved (or still
// -null/undefined-while-loading) chain objects, not raw ids. Replicated
// here by accepting the same raw id list `AccountPermissions.jsx`
// already computes and resolving each id via `ChainStore.getObject`
// directly (the same generic per-item resolution `ChainObjectsList`
// itself does under the hood), gated by `useChainStoreTick()`. `keys`/
// `addresses` were never chain-resolved in the original either (no
// propType declared for them at all, just plain prop arrays of pubkey/
// address strings) - unchanged here.
//
// `AccountPermissionRow`'s `shouldComponentUpdate` (shallow prop-equality
// gate) dropped, same as this migration's other legacy SCU gates
// elsewhere - perf-only, doesn't change output.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import AccountSelector from "./AccountSelector";
import Translate from "react-translate-component";
import AccountImage from "./AccountImage";
import Icon from "../Icon/Icon";
import PrivateKeyView from "components/PrivateKeyView";
import counterpart from "counterpart";
import AddressIndex from "stores/AddressIndex";
import PrivateKeyStore from "stores/PrivateKeyStore";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const TypedLink = Link as React.ComponentType<LinkProps>;

interface AccountPermissionRowProps {
    account?: any;
    pubkey?: string;
    address?: string;
    onRemoveItem: (...args: any[]) => any;
    weights: any;
}

function lookUpPubKeyForAddress(address: string) {
    const addresses = (AddressIndex as any).getState().addresses;
    return addresses.get(address);
}

function AccountPermissionRow({
    account,
    pubkey,
    address,
    onRemoveItem,
    weights
}: AccountPermissionRowProps) {
    let name: any, item_id: any, name_or_key: any;
    let suffix = "_accounts";
    let pubKey = pubkey;

    const keys = (PrivateKeyStore as any).getState().keys;

    let has_private = false;

    if (account) {
        name = account.get("name");
        item_id = account.get("id");
        name_or_key = (
            <TypedLink to={`/account/${name}/permissions`}>{name}</TypedLink>
        );
    } else if (pubKey) {
        name = item_id = pubKey;
        name_or_key = (
            <PrivateKeyView pubkey={pubKey}>{pubKey}</PrivateKeyView>
        );
        suffix = "_keys";
        has_private = keys.has(pubKey);
    } else if (address) {
        pubKey = lookUpPubKeyForAddress(address);
        item_id = address;
        name_or_key = !pubKey ? (
            address
        ) : (
            <PrivateKeyView pubkey={pubKey}>{pubKey}</PrivateKeyView>
        );
        suffix = "_addresses";
        has_private = keys.has(pubKey);
    }

    return (
        <tr key={name}>
            <td>
                {account ? (
                    <AccountImage
                        size={{height: 30, width: 30}}
                        account={name}
                    />
                ) : pubKey ? (
                    <div className="account-image">
                        <PrivateKeyView pubkey={pubKey}>
                            <Icon name="key" title="icons.key" size="4x" />
                        </PrivateKeyView>
                    </div>
                ) : null}
            </td>
            <td className={(has_private ? "my-key" : "") + " pub-key"}>
                {name_or_key}
            </td>
            <td>{weights[item_id]}</td>
            <td>
                <button
                    className="button"
                    onClick={() => onRemoveItem(item_id, suffix)}
                >
                    <Translate content="account.votes.remove_witness" />
                </button>
            </td>
        </tr>
    );
}

interface AccountPermissionsListProps {
    accounts: any;
    keys: any;
    addresses: any;
    weights: any;
    onAddItem: (...args: any[]) => any;
    onRemoveItem: (...args: any[]) => any;
    validateAccount?: (...args: any[]) => any;
    label: string;
    placeholder?: string;
    tabIndex?: number;
}

export default function AccountPermissionsList({
    accounts,
    keys,
    addresses,
    weights,
    onAddItem,
    onRemoveItem,
    validateAccount,
    label,
    placeholder,
    tabIndex
}: AccountPermissionsListProps) {
    useChainStoreTick();

    const [selectedItem, setSelectedItem] = React.useState<any>(null);
    const [itemNameInput, setItemNameInput] = React.useState("");
    const [weightInput, setWeightInput] = React.useState<any>("");
    const [error, setError] = React.useState<any>(null);

    function handleItemChange(newItemNameInput: string) {
        setItemNameInput(newItemNameInput);
    }

    function handleItemAccountChange(newSelectedItem: any) {
        setSelectedItem(newSelectedItem);
        setError(null);
        if (newSelectedItem && validateAccount) {
            const res = validateAccount(newSelectedItem);
            if (res === null) return;
            if (typeof res === "string") setError(res);
            else res.then((err: any) => setError(err));
        }
    }

    function handleWeightChanged(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value.trim();
        setWeightInput(parseInt(value));
    }

    function handleAddItem(item: any) {
        if (!item) return;
        setSelectedItem(null);
        setItemNameInput("");
        setWeightInput("");
        setError(null);
        const item_value = typeof item === "string" ? item : item.get("id");
        onAddItem(item_value, weightInput);
    }

    function handleWeightKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode === 13 && weightInput && selectedItem)
            handleAddItem(selectedItem);
    }

    let key = 0;
    const resolvedAccounts = accounts.map((id: string) =>
        ChainStore.getObject(id)
    );
    const account_rows = resolvedAccounts
        .filter((i: any) => {
            if (!i) return false;
            return true;
        })
        .sort((a: any, b: any) => {
            if (a.get("name") > b.get("name")) return 1;
            else if (a.get("name") < b.get("name")) return -1;
            return 0;
        })
        .map((i: any) => {
            return (
                <AccountPermissionRow
                    key={key++}
                    account={i}
                    weights={weights}
                    onRemoveItem={onRemoveItem}
                />
            );
        });

    const key_rows = keys.map((k: string) => {
        return (
            <AccountPermissionRow
                key={key++}
                pubkey={k}
                weights={weights}
                onRemoveItem={onRemoveItem}
            />
        );
    });

    const address_rows = addresses.map((k: string) => {
        return (
            <AccountPermissionRow
                key={key++}
                address={k}
                weights={weights}
                onRemoveItem={onRemoveItem}
            />
        );
    });

    let displayError = error;
    if (
        !displayError &&
        selectedItem &&
        accounts.indexOf(selectedItem) !== -1
    )
        displayError = counterpart.translate("account.perm.warning3");
    if (
        !displayError &&
        itemNameInput &&
        keys.indexOf(itemNameInput) !== -1
    )
        displayError = counterpart.translate("account.perm.warning4");

    const cw = ["10%", "70%", "30%", "10%"];

    return (
        <div>
            <AccountSelector
                label={label}
                error={displayError}
                placeholder={placeholder}
                account={itemNameInput}
                accountName={itemNameInput}
                onChange={handleItemChange}
                onAccountChanged={handleItemAccountChange}
                onAction={handleAddItem}
                action_label="account.votes.add_witness"
                tabIndex={tabIndex}
                allowPubKey={true}
                disableActionButton={!weightInput}
                allowUppercase={true}
            >
                <input
                    value={weightInput}
                    onChange={handleWeightChanged}
                    className="weight-input"
                    type="number"
                    autoComplete="off"
                    placeholder={counterpart.translate("account.perm.weight")}
                    onKeyDown={handleWeightKeyDown}
                    tabIndex={(tabIndex as number) + 1}
                />
            </AccountSelector>

            <div style={{paddingTop: "2rem"}}>
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{width: cw[0]}} />
                            <th style={{width: cw[1]}}>
                                <Translate content="account.perm.acct_or_key" />
                            </th>
                            <th style={{width: cw[2]}}>
                                <Translate content="account.perm.weight" />
                            </th>
                            <th style={{width: cw[3]}}>
                                <Translate content="account.perm.action" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {account_rows}
                        {key_rows}
                        {address_rows}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
