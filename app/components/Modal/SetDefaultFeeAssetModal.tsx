// TypeScript/functional-component port of the legacy
// SetDefaultFeeAssetModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// `connect(Component, {listenTo: [SettingsStore, AccountStore],
// getProps})` replaced by `useAltStore` calls (the established
// multi-store pattern) plus resolving `currentAccount` the same way
// `getProps` did (caller-supplied `currentAccount`, falling back to
// `ChainStore.getAccount(AccountStore.getState().currentAccount)`).
//
// Dropped as confirmed dead (grep-verified): `componentDidUpdate`'s
// `accountChanged` check - `this.props.account` is never actually
// passed by either real caller (`FeeAssetSelector.tsx`/
// `FeeAssetSettings.tsx` both pass `currentAccount`, never `account`;
// `account` isn't even declared in `propTypes`/`defaultProps`), so
// `this.props.account &&` always short-circuits `accountChanged` to a
// falsy value before `prevProps.account.get("id")` is ever evaluated
// (which is also why this never throws despite `prevProps.account`
// being unchecked) - the whole `if (accountChanged) {...}` block, and
// the re-fetch it would have triggered, is unreachable in practice.
// One consequence worth noting as a preserved quirk, not a fix
// opportunity: with that block gone, `_updateStateForAccount()` (which
// populates `state.balances` from `props.currentAccount`) is now only
// ever called once, from the mount-only effect - `state.balances` was
// already never resynced on a later `currentAccount` prop change in
// the original either, since that dead block was its only other call
// site. `_getColumns(this.props.displayFees)`'s argument is dropped -
// the method itself takes no parameters and reads `this.props
// .displayFees` directly, so the passed value was always discarded.
// Both real callers also pass a `className` prop this component never
// read even in the original (plain JS tolerates the extra prop
// silently) - kept in the type as accepted-but-unused.
//
// `componentDidUpdate`'s second concern (resyncing `selectedAssetId`
// when `current_asset` changes) is real and becomes a `useEffect` keyed
// on `current_asset`, using the same "componentDidUpdate never fires on
// mount" mount-flag-ref pattern as `AccountSelector.tsx`/
// `JoinWitnessesModal.tsx` (earlier Modal batches) - firing this on
// mount too would be harmless (it would just re-set `selectedAssetId`
// to the same value the constructor-equivalent `useState` initializer
// already gave it), but the guard is kept for closer fidelity to the
// original's "updates only" semantics.
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import {ChainStore} from "bitsharesjs";
import {Link} from "react-router-dom";
import {Table} from "../../design-system/Table";
import {Button} from "../../design-system/Button";
import {Radio} from "../../design-system/Radio";
import {Modal} from "../../design-system/Modal";
import {Checkbox} from "../../design-system/Checkbox";
import SettingsStore from "stores/SettingsStore";
import AccountStore from "stores/AccountStore";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface SetDefaultFeeAssetModalState {
    useByDefault: boolean;
    selectedAssetId: any;
    balances: any;
}

interface SetDefaultFeeAssetModalCoreProps {
    currentAccount?: any;
    asset_types?: any[];
    displayFees?: boolean;
    forceDefault?: boolean;
    current_asset?: string;
    onChange?: (value: any) => void;
    show?: boolean;
    close: () => void;
    settings: any;
    // Accepted but unused, matching the original: both real callers
    // pass a `className` prop this component has never read.
    className?: string;
}

function SetDefaultFeeAssetModal({
    currentAccount,
    displayFees = false,
    forceDefault = false,
    current_asset = "1.3.0",
    onChange,
    show = false,
    close
}: SetDefaultFeeAssetModalCoreProps) {
    const [state, setState] = React.useState<SetDefaultFeeAssetModalState>({
        useByDefault: forceDefault ? true : false,
        selectedAssetId: current_asset,
        balances: {}
    });

    const mergeState = (partial: Partial<SetDefaultFeeAssetModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const updateStateForAccount = () => {
        const balances = currentAccount.get("balances").toJS();
        mergeState({
            balances: Object.keys(balances).reduce((result: any, asset_id) => {
                const balanceObject = ChainStore.getObject(balances[asset_id]);
                result[asset_id] = (balanceObject as any).get("balance");
                return result;
            }, {})
        });
    };

    React.useEffect(() => {
        updateStateForAccount();
    }, []);

    const isUpdateMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isUpdateMountRef.current) {
            isUpdateMountRef.current = false;
        } else if (current_asset) {
            mergeState({selectedAssetId: current_asset});
        }
    }, [current_asset]);

    const onSelectedAsset = (event: any) => {
        if (event.target.checked) {
            mergeState({selectedAssetId: event.target.value});
        }
    };

    const getAssetsRows = (assets: any) => {
        return assets
            .filter((item: any) => {
                return !!item && item.balance > 0 && !!item.asset;
            })
            .map((assetInfo: any) => {
                return {
                    id: assetInfo.asset.get("id"),
                    key: assetInfo.asset.get("id"),
                    asset: assetInfo.asset.get("symbol"),
                    link: `/asset/${assetInfo.asset.get("symbol")}`,
                    balance:
                        assetInfo.balance /
                        Math.pow(10, assetInfo.asset.get("precision")),
                    fee: assetInfo.fee
                };
            });
    };

    const onSubmit = () => {
        const {selectedAssetId, useByDefault} = state;
        if (onChange) onChange(selectedAssetId);
        if (useByDefault) {
            (SettingsActions as any).changeSetting({
                setting: "fee_asset",
                value: (ChainStore.getAsset(selectedAssetId) as any).get(
                    "symbol"
                )
            });
        }
        close();
    };

    const setSelectedAssetAsDefault = () => {
        mergeState({useByDefault: !state.useByDefault});
    };

    const getColumns = () => {
        const symbolSorter = (a: any, b: any) => {
            if (a.asset == "BTS" || b.asset == "BTS") {
                return a.asset == "BTS" ? 1 : -1;
            } else if (
                ["USD", "CNY", "EUR"].includes(a.asset) !==
                ["USD", "CNY", "EUR"].includes(b.asset)
            ) {
                return ["USD", "CNY", "EUR"].includes(a.asset) ? 1 : -1;
            }
            return a.asset < b.asset;
        };
        const columns: any[] = [
            {
                key: "id",
                title: "",
                render: (asset: any) => (
                    <Radio
                        onChange={onSelectedAsset}
                        checked={state.selectedAssetId === asset.id}
                        value={asset.id}
                    />
                )
            },
            {
                key: "asset",
                title: counterpart.translate("account.asset"),
                align: "left",
                sorter: symbolSorter,
                defaultSortOrder: "descend",
                render: (asset: any) => (
                    <LinkComponent to={asset.link}>{asset.asset}</LinkComponent>
                )
            },
            {
                key: "balance",
                title: counterpart.translate("exchange.balance"),
                align: "right",
                render: (asset: any) => <span>{asset.balance}</span>
            }
        ];
        if (displayFees) {
            columns.push({
                key: "fee",
                title: counterpart.translate("account.transactions.fee"),
                align: "right",
                render: (asset: any) => <span>{asset.fee}</span>
            });
        }
        return columns;
    };

    let assets: any[] = [];
    if (state.balances) {
        assets = Object.keys(state.balances).map(asset_id => ({
            asset: ChainStore.getAsset(asset_id),
            balance: state.balances[asset_id]
        }));
    }
    const dataSource = getAssetsRows(assets);
    const footer = (
        <div key="buttons" style={{position: "relative", left: "0px"}}>
            <Button key="cancel" onClick={close}>
                <Translate component="span" content="transfer.cancel" />
            </Button>
            <Button
                key="submit"
                variant="accent"
                disabled={!state.selectedAssetId}
                onClick={onSubmit}
            >
                <Translate
                    component="span"
                    content="explorer.asset.fee_pool.use_selected_asset"
                />
            </Button>
        </div>
    );
    return (
        <Modal
            visible={show}
            onCancel={close}
            title={counterpart.translate(
                "explorer.asset.fee_pool.select_fee_asset"
            )}
            footer={[footer]}
        >
            <Table
                columns={getColumns()}
                pagination={{
                    hideOnSinglePage: true,
                    pageSize: 20
                }}
                dataSource={dataSource}
                footer={null}
            />

            <Checkbox
                onClick={setSelectedAssetAsDefault}
                disabled={forceDefault}
                checked={state.useByDefault}
                style={{paddingTop: "30px"}}
            >
                <Translate
                    component="span"
                    content="explorer.asset.fee_pool.use_asset_as_default_fee"
                />
            </Checkbox>
        </Modal>
    );
}

interface SetDefaultFeeAssetModalContainerProps {
    currentAccount?: any;
    asset_types?: any[];
    displayFees?: boolean;
    forceDefault?: boolean;
    current_asset?: string;
    onChange?: (value: any) => void;
    show?: boolean;
    close: () => void;
    className?: string;
}

function SetDefaultFeeAssetModalContainer(
    props: SetDefaultFeeAssetModalContainerProps
) {
    const settingsState = useAltStore<any>(SettingsStore);
    const accountState = useAltStore<any>(AccountStore);

    const currentAccount =
        props.currentAccount ||
        (ChainStore as any).getAccount(accountState.currentAccount);

    return (
        <SetDefaultFeeAssetModal
            {...props}
            currentAccount={currentAccount}
            settings={settingsState.settings}
        />
    );
}

export default SetDefaultFeeAssetModalContainer;
