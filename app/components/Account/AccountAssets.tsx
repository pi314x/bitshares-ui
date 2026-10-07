// TypeScript/functional-component port of the legacy AccountAssets.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(Component, {propNames: ["assetsList"], asList: true,
// withDynamic: true})` kept as-is (shared HOC, out of scope).
// Structural change (not a behavior change): the outer `connect
// (Component, {listenTo: [AssetStore], getProps})` is replaced by
// `useAltStore(AssetStore)`.
//
// `UNSAFE_componentWillMount` (calls `_checkAssets(props.assets, true)`)
// + `UNSAFE_componentWillReceiveProps` (calls `_checkAssets(nextProps
// .assets)`, no `force`) are unified into one `useEffect` keyed on
// `assets`, with a mount-only ref distinguishing the two `force`
// arguments. A plain `useEffect` (not a render-phase update) is used
// here since `_checkAssets` only dispatches an action/updates an
// internal counter - it never affects this render's own visible output,
// unlike the render-phase cases elsewhere in this migration.
//
// Preserved verbatim (not "fixed"): `assetsFetched` is read
// (`assets.size >= state.assetsFetched`) before it's ever set in state -
// it's `undefined` on the very first call, and `n >= undefined` is
// always `false` in JS, so that branch simply never fires on the first
// call (mount instead takes the `force`-true branch). Replicated by
// *not* including `assetsFetched` in the initial state object, so it's
// genuinely `undefined` at first, matching the original's uninitialized
// class field exactly. Also preserved: `_issueButtonClick` mutates the
// `issue` object within state directly, then calls `setState` with that
// same mutated reference (rather than building a fresh object) -
// harmless here since the surrounding state wrapper object is still
// replaced with a new reference on every merge.
//
// Dropped as confirmed dead (visible directly in the file, no grep
// needed): the `ref="appTables"` legacy string ref; the `searchTerm`
// state field (initialized, never read or written again anywhere); and
// `_onIssueInput`/`_searchAccounts` (the debounced account-search
// handler they use) - `_onIssueInput` is defined but never wired up to
// any element in `render()` (`<IssueModal>` is only ever given
// `visible`/`hideModal`/`showModal`/`asset_to_issue`), so it - and the
// `_searchAccounts` helper only it called - are unreachable.
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import AssetActions from "actions/AssetActions";
import AssetStore from "stores/AssetStore";
import FormattedAsset from "../Utility/FormattedAsset";
import LoadingIndicator from "../LoadingIndicator";
import IssueModal from "../Modal/IssueModal";
import assetUtils from "common/asset_utils";
import {Map, List} from "immutable";
import AssetWrapper from "../Utility/AssetWrapper";
import {Tabs, Tab} from "../Utility/Tabs";
import Icon from "../Icon/Icon";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface AccountAssetsIssue {
    amount: number;
    to: string;
    to_id: any;
    asset_id: any;
    symbol: string;
}

interface AccountAssetsState {
    isIssueAssetModalVisible: boolean;
    issue: AccountAssetsIssue;
    assetsFetched?: number;
}

interface AccountAssetsCoreProps {
    account: any;
    account_name?: string;
    assets: any;
    assetsList: any;
    getDynamicObject: (id: any) => any;
    history: any;
    symbol?: string;
}

function AccountAssets({
    account,
    account_name,
    assets: assetsProp,
    assetsList,
    getDynamicObject,
    history
}: AccountAssetsCoreProps) {
    const [state, setState] = React.useState<AccountAssetsState>({
        isIssueAssetModalVisible: false,
        issue: {
            amount: 0,
            to: "",
            to_id: "",
            asset_id: "",
            symbol: ""
        }
    });

    const mergeState = (partial: Partial<AccountAssetsState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const showIssueAssetModal = () => {
        mergeState({
            isIssueAssetModalVisible: true
        });
    };

    const hideIssueAssetModal = () => {
        mergeState({
            isIssueAssetModalVisible: false
        });
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const checkAssets = (assets: any, force?: boolean) => {
        if (account.get("assets").size) return;
        const lastAsset = assets
            .sort((a: any, b: any) => {
                if (a.symbol > b.symbol) {
                    return 1;
                } else if (a.symbol < b.symbol) {
                    return -1;
                } else {
                    return 0;
                }
            })
            .last();

        if (assets.size === 0 || force) {
            (AssetActions as any).getAssetList.defer("A", 100);
            mergeState({assetsFetched: 100});
        } else if (assets.size >= (stateRef.current.assetsFetched as any)) {
            (AssetActions as any).getAssetList.defer(lastAsset.symbol, 100);
            mergeState({
                assetsFetched: (stateRef.current.assetsFetched as any) + 99
            });
        }
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            checkAssets(assetsProp, true);
            return;
        }
        checkAssets(assetsProp);
        // eslint-disable-next-line
    }, [assetsProp]);

    const issueButtonClick = (asset_id: any, symbol: string, e: any) => {
        e.preventDefault();
        const issue = state.issue;
        issue.asset_id = asset_id;
        issue.symbol = symbol;
        mergeState({issue: issue});
        showIssueAssetModal();
    };

    const editButtonClick = (symbol: string, account_name: any, e: any) => {
        e.preventDefault();
        history.push(`/account/${account_name}/update-asset/${symbol}`);
    };

    const createButtonClick = (account_name: any) => {
        history.push(`/account/${account_name}/create-asset`);
    };

    let accountExists = true;
    if (!account) {
        return <LoadingIndicator type="circle" />;
    } else if ((account as any).notFound) {
        accountExists = false;
    }
    if (!accountExists) {
        return (
            <div className="grid-block">
                <h5>
                    <Translate
                        component="h5"
                        content="account.errors.not_found"
                        name={account_name}
                    />
                </h5>
            </div>
        );
    }

    let assets = assetsProp;
    if (assetsList.length) {
        assets = assets.clear();
        assetsList.forEach((a: any) => {
            if (a) assets = assets.set(a.get("id"), a.toJS());
        });
    }
    const myAssets = assets
        .filter((asset: any) => {
            return asset.issuer === account.get("id");
        })
        .sort((a: any, b: any) => {
            return (
                parseInt(a.id.substring(4, a.id.length), 10) -
                parseInt(b.id.substring(4, b.id.length), 10)
            );
        })
        .map((asset: any) => {
            const description = assetUtils.parseDescription(
                asset.options.description
            );
            let desc = description.short_name
                ? description.short_name
                : description.main;

            if (desc.length > 100) {
                desc = desc.substr(0, 100) + "...";
            }

            const dynamicObject = getDynamicObject(asset.dynamic_asset_data_id);

            return (
                <tr key={asset.symbol}>
                    <td style={{textAlign: "left"}}>
                        <LinkComponent to={`/asset/${asset.symbol}`}>
                            {asset.symbol}
                        </LinkComponent>
                    </td>
                    <td style={{textAlign: "left"}}>
                        {"bitasset" in asset ? (
                            asset.bitasset.is_prediction_market ? (
                                <Translate content="account.user_issued_assets.pm" />
                            ) : (
                                <Translate content="account.user_issued_assets.mpa" />
                            )
                        ) : (
                            "User Issued Asset"
                        )}
                    </td>
                    <td style={{textAlign: "right"}}>
                        {dynamicObject ? (
                            <FormattedAsset
                                hide_asset
                                amount={parseInt(
                                    dynamicObject.get("current_supply"),
                                    10
                                )}
                                asset={asset.id}
                            />
                        ) : null}
                    </td>
                    <td style={{textAlign: "right"}}>
                        <FormattedAsset
                            hide_asset
                            amount={parseInt(asset.options.max_supply, 10)}
                            asset={asset.id}
                        />
                    </td>
                    <td>
                        {!asset.bitasset_data_id ? (
                            <a
                                onClick={issueButtonClick.bind(
                                    null,
                                    asset.id,
                                    asset.symbol
                                )}
                            >
                                <Icon name="cross-circle" className="rotate45" />
                            </a>
                        ) : null}
                    </td>

                    <td>
                        <a
                            onClick={editButtonClick.bind(
                                null,
                                asset.symbol,
                                account_name
                            )}
                        >
                            <Icon name="dashboard" />
                        </a>
                    </td>
                </tr>
            );
        })
        .valueSeq()
        .toArray();

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <Tabs
                        segmented={false}
                        setting="issuedAssetsTab"
                        className="account-tabs"
                        tabsClass="account-overview bordered-header content-block"
                        contentClass="padding"
                    >
                        <Tab title="account.user_issued_assets.issued_assets">
                            <div className="content-block">
                                <table className="table dashboard-table">
                                    <thead>
                                        <tr>
                                            <th style={{textAlign: "left"}}>
                                                <Translate content="account.user_issued_assets.symbol" />
                                            </th>
                                            <th style={{textAlign: "left"}}>
                                                <Translate content="explorer.asset.summary.asset_type" />
                                            </th>
                                            <Translate
                                                component="th"
                                                content="markets.supply"
                                                style={{textAlign: "right"} as any}
                                            />
                                            <th style={{textAlign: "right"}}>
                                                <Translate content="account.user_issued_assets.max_supply" />
                                            </th>
                                            <th style={{textAlign: "center"}}>
                                                <Translate content="transaction.trxTypes.asset_issue" />
                                            </th>
                                            <th style={{textAlign: "center"}}>
                                                <Translate content="transaction.trxTypes.asset_update" />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>{myAssets}</tbody>
                                </table>
                            </div>

                            <div className="content-block">
                                <button
                                    className="button"
                                    onClick={createButtonClick.bind(
                                        null,
                                        account_name
                                    )}
                                >
                                    <Translate content="transaction.trxTypes.asset_create" />
                                </button>
                            </div>
                        </Tab>
                    </Tabs>
                </div>

                <IssueModal
                    visible={state.isIssueAssetModalVisible}
                    hideModal={hideIssueAssetModal}
                    showModal={showIssueAssetModal}
                    asset_to_issue={state.issue.asset_id}
                />
            </div>
        </div>
    );
}

const WrappedAccountAssets = AssetWrapper(AccountAssets, {
    propNames: ["assetsList"],
    asList: true,
    withDynamic: true
} as any);

interface AccountAssetsContainerProps {
    account: any;
    [key: string]: any;
}

function AccountAssetsContainer(props: AccountAssetsContainerProps) {
    const assetState = useAltStore<any>(AssetStore);

    let assets = Map();
    let assetsList = List();
    if (props.account.get("assets", []).size) {
        props.account.get("assets", []).forEach((id: any) => {
            assetsList = assetsList.push(id);
        });
    } else {
        assets = assetState.assets;
    }

    return (
        <WrappedAccountAssets {...props} assets={assets} assetsList={assetsList} />
    );
}

export default AccountAssetsContainer;
