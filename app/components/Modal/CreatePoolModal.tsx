// TypeScript/functional-component port of the legacy CreatePoolModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onCreatePool` submits an on-chain
// `liquidity_pool_create` transaction via
// `ApplicationApi.liquidityPoolCreate` - transcribed verbatim, including
// its exact fee-percent (`* 100.0`) and asset-ordering (lower `1.3.x` id
// first) logic.
//
// This file is a plain class (no `connect`/`BindToChainState`), so the
// port is a direct class-to-hooks translation, not a Container/Core
// split - `SearchListItem` and `CreatePoolModal` each become one
// function.
//
// Dropped as confirmed dead (grepped, not assumed):
// - Imports `PoolAction` (`actions/PoolActions`), `QRCode`
//   (`qrcode.react`), `Aes` (from `bitsharesjs`), `AssetName`
//   (`../Utility/AssetName`), `SearchInput` (`../Utility/SearchInput`),
//   and the `Select` re-export from `bitshares-ui-style-guide` - every
//   one of these appears only on its own `import` line, never
//   referenced anywhere else in the file.
// - `utils` (`common/utils`): its one and only use was
//   `utils.are_equal_shallow(ns, this.state)` inside
//   `shouldComponentUpdate`, which is dropped below (see that note) -
//   with the SCU gone, `utils` has no remaining readers.
// - `state.keyString`: initialized in `_getInitialState`, never read or
//   set anywhere else.
// - `state.marketsList`/`state.activeSearch`/`inputValue`
//   (`initialState()`'s returned `inputValue` field): all three are
//   write-only. `marketsList` was read only inside the now-dropped
//   `shouldComponentUpdate`; `activeSearch` is never initialized in
//   `_getInitialState` and never read anywhere (only ever assigned);
//   `inputValue` is likewise assigned by `initialState()` but never
//   read. All three, and every `setState`/`mergeState` call that wrote
//   them, are dropped.
// - Legacy string refs: all three inputs share the exact same
//   `ref="marketPicker_input"` string (a pre-existing bug: only the
//   last-rendered one would ever be reachable via `this.refs`), but
//   `this.refs.marketPicker_input` is never read anywhere in the file -
//   dropped entirely rather than replaced with a `useRef`.
// - `modalId`/`keyValue` propTypes and `modalId`'s default
//   (`"qr_code_password_modal"`): neither is ever read via
//   `this.props.modalId`/`this.props.keyValue` anywhere in the class,
//   and the real caller (`Account/AccountPools.tsx`) never passes
//   either - dropped from the props interface entirely (unlike
//   `showModal`/`name`/`assetsList` below, which that same caller DOES
//   pass, so they're kept as accepted-but-unused).
// - `onPoolNameChange`'s local `let keys = [...this.props.account
//   .keys()];`: computed, never read afterwards in that method.
// - `onFormatTakerFee(e)`/`onFormatUnstackFee(e)`'s `e` parameter: never
//   referenced in either body in the original either - dropped rather
//   than kept as an unused parameter, to satisfy this file's new
//   `@typescript-eslint/no-unused-vars` exposure (unlike function
//   *arguments*, which most lint configs ignore by default, an unused
//   named parameter with no caller-visible reason to exist is flagged
//   here); both call sites (`onBlur={...}`) still work identically
//   with a zero-arg handler.
// - `onSetAssetBArray`: an empty no-op method, bound in the constructor
//   but - unlike its sibling `onSetAssetAArray` - never actually called
//   anywhere in the file (grep-confirmed: only its own `bind`/definition
//   lines mention it). `onAssetBSearch`'s early-return branch calls
//   `onSetAssetAArray()` instead (see the preserved-bug note just
//   below), so `onSetAssetBArray` has no call site at all, unlike
//   `onSetAssetAArray` (an empty no-op too, but genuinely invoked, so
//   kept - see below). Dropping it also sidesteps an
//   `@typescript-eslint/no-unused-vars` error a never-called local
//   `const` would otherwise raise (a class method with no callers isn't
//   flagged by that rule the same way, which is why the original could
//   carry it silently).
//
// Preserved verbatim, not "fixed":
// - `showAlertChangeAssetA`/`showAlertChangeAssetB`/
//   `showAlertChangeTrankerFee`/`showAlertChangeUnstakeFee`: read in
//   `render()` to conditionally show an `<Alert>`, but never set to
//   `true` anywhere in the file - their `<Alert>`s are permanently
//   dead UI, kept as real (if inert) state exactly like this
//   migration's established `read-but-never-toggled` treatment (see
//   `DirectDebitModal.tsx`'s `feeAmount`, `ReportModal.tsx`'s
//   `loadingImage`).
// - `onSetAssetAArray`: a genuinely empty no-op function in the
//   original, kept as a no-op here, called from the exact same two
//   places - including `onAssetBSearch`'s early-return branch, which (a
//   real bug) calls `onSetAssetAArray()` there instead of the
//   (dropped, see above) `onSetAssetBArray()`.
// - `onCreatePool`'s redundant final `onCancel()` call, which re-hides
//   the modal and resets state a second time even along the branches
//   that already called `hideModal()` a few lines above - not
//   deduplicated.
// - `onCancel`'s own redundant double reset (`setState(getInitialState
//   ())` followed by `onClose()`, which resets state again) - not
//   deduplicated.
// - Every stray `console.log` (`"componentWillReceiveProps is
//   invoked."`, `"CreatePooModal marketsList: "`, the asset-swap-order
//   pair in `onCreatePool`, `"onSetAssetA "`/`"takerFee: "`,
//   `"onSetAssetB "`) - kept exactly as in the original, matching this
//   migration's precedent of keeping stray debug logs verbatim (see
//   `FeePoolOperation.tsx`) rather than treating them as removable
//   dev-only noise.
// - `onCreatePool` is wired directly as the `<form onSubmit>` handler
//   and never calls `e.preventDefault()` - a real, pre-existing quirk
//   (pressing Enter in one of the text inputs can trigger a native form
//   submission) that this port does not fix.
//
// Structural changes:
// - `shouldComponentUpdate` is a pure render-gating check (no side
//   effects beyond the boolean it returns) - dropped entirely, per this
//   migration's established `shouldComponentUpdate` convention (see
//   `ReportModal.tsx`'s header comment for the general rule).
// - `componentWillReceiveProps` becomes one dependency-less `useEffect`
//   using the usual "never fires on mount" mount-flag-ref pattern
//   (matching `DirectDebitModal.tsx`), with `prevMarketPickerAssetRef`/
//   `prevSearchListRef` standing in for the "previous props" the class
//   compared `nextProps` against. The `state.searchAssetA`/
//   `searchAssetB`/`searchPoolName`/`filterAssetA`/`filterAssetB`/
//   `poolName`/`lookupQuote` reads inside it are the *current* (already
//   -committed-by-render-time) state, read directly from the render
//   closure, exactly mirroring the original reading `this.state` (which
//   at that point in the class lifecycle is likewise the not-yet-
//   updated-by-this-props-change current state).
// - `componentWillUnmount`'s `clearInterval(this.intervalId)` becomes an
//   unmount-only cleanup effect over an `intervalIdRef`.
// - `this.getAssetList`/`this.getAssetsByIssuer` (each a `debounce(...)`
//   wrapper built once in the constructor) become lazily-initialized
//   refs (`if (!ref.current) ref.current = debounce(...)`), so the
//   debounced function - and the pending-call state it holds - is
//   created exactly once per mount, not rebuilt every render.
// - `this.timer`/`this.intervalId` become `timerRef`/`intervalIdRef`.
// - `_checkAndUpdateMarketList`'s `setInterval` callback reads
//   `this.state.searchPoolName`/`searchAssetA`/`searchAssetB` well
//   after the render that scheduled it - read through `stateRef.current`
//   here (unlike the synchronous `componentWillReceiveProps` effect
//   above) since a plain closure `state` would otherwise be stale by
//   the time the interval fires.
// - `this.setState`, passed by reference into `MarketPickerHelpers.js`'s
//   `assetFilter`/`lookupAssets`/`lookupAccountAssets` (each of which
//   calls it with a single plain patch object, never a callback), is
//   replaced by this component's own `mergeState` at every call site.
//
// TS-forced adjustment: `SearchListItem`'s `render()` read
// `this.props.key` for its own inner `<li key={...}>` - `key` is a
// reserved prop React never actually forwards into `props` for any
// component, class or function, so this always evaluated to `undefined`
// at runtime regardless (a pre-existing, harmless bug). TypeScript's
// component-prop types omit `key` entirely, so `props.key` isn't even
// nameable here - the dead `key={undefined}` on the inner `<li>` is
// dropped rather than worked around. Likewise, `SearchListItem`'s
// `marketPickerAsset`/`onClose` props (destructured in the original's
// `render()` but never referenced afterwards - `render()`'s own
// `itemData` destructure is unused too, `this.props.itemData` is read
// directly on the click handler instead) and the `tabIndex` prop passed
// by every one of `CreatePoolModal`'s three `<SearchListItem>` call
// sites (never read inside `SearchListItem` at all) are dropped, since
// keeping them would need either an unused-prop TS interface member or
// an unused destructure - the same trim `ProposalModal.tsx`'s header
// comment documents for its own lint-forced destructure trims.
import * as React from "react";
import {ChainValidation} from "bitsharesjs";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {Form} from "../../design-system/Form";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Icon as AntIcon} from "../../design-system/Icon";
import {Alert} from "../../design-system/Alert";
import {debounce} from "lodash-es";

import {
    lookupAssets,
    assetFilter,
    fetchIssuerName,
    lookupAccountAssets
} from "./MarketPickerHelpers";

import ApplicationApi from "../../api/ApplicationApi";
import AssetActions from "actions/AssetActions";

interface SearchListItemProps {
    itemSelect: (data: any) => void;
    itemLabel: any;
    itemData: any;
}

function SearchListItem({itemSelect, itemLabel, itemData}: SearchListItemProps) {
    const onClick = () => {
        itemSelect(itemData);
    };

    return (
        <li style={{height: 20, cursor: "pointer"}} onClick={onClick}>
            {itemLabel}
        </li>
    );
}

interface CreatePoolModalState {
    poolName: string | null;
    filterAssetA: any;
    filterAssetB: any;
    lookupQuote: any;
    poolNameArray: any[];
    assetsAArray: any[];
    assetsBArray: any[];
    assetsA: any;
    assetsB: any;
    takerFee: any;
    unstakeFee: any;
    searchPoolName: boolean;
    searchAssetA: boolean;
    searchAssetB: boolean;
    showAlertChangeAssetA: boolean;
    showAlertChangeAssetB: boolean;
    showAlertChangeTrankerFee: boolean;
    showAlertChangeUnstakeFee: boolean;
    showAlertInputPool: boolean;
    showAlertInputAssetA: boolean;
    showAlertInputAssetB: boolean;
    showAlertInputTrankerFee: boolean;
    showAlertInputUnstakeFee: boolean;
}

function getInitialState(): CreatePoolModalState {
    return {
        poolName: null,
        filterAssetA: null,
        filterAssetB: null,
        lookupQuote: null,
        poolNameArray: [],
        assetsAArray: [],
        assetsBArray: [],
        assetsA: null,
        assetsB: null,
        takerFee: 0,
        unstakeFee: 0,
        searchPoolName: false,
        searchAssetA: false,
        searchAssetB: false,
        showAlertChangeAssetA: false,
        showAlertChangeAssetB: false,
        showAlertChangeTrankerFee: false,
        showAlertChangeUnstakeFee: false,
        showAlertInputPool: false,
        showAlertInputAssetA: false,
        showAlertInputAssetB: false,
        showAlertInputTrankerFee: false,
        showAlertInputUnstakeFee: false
    };
}

function getResetSearchState() {
    return {
        assetsAArray: [] as any[],
        assetsBArray: [] as any[],
        searchAssetA: false,
        searchAssetB: false,
        lookupQuote: null as any
    };
}

function getInitAlertState() {
    return {
        showAlertChangeAssetA: false,
        showAlertChangeAssetB: false,
        showAlertChangeTrankerFee: false,
        showAlertChangeUnstakeFee: false,
        showAlertInputAssetA: false,
        showAlertInputAssetB: false,
        showAlertInputTrankerFee: false,
        showAlertInputUnstakeFee: false,
        showAlertInputPool: false
    };
}

interface CreatePoolModalProps {
    visible: boolean;
    hideModal: () => void;
    account: any;
    searchList?: any;
    marketPickerAsset?: any;
    // Accepted-but-unused: passed by the real caller
    // (`Account/AccountPools.tsx`) but never read anywhere in this
    // component, matching the original class's behavior.
    showModal?: () => void;
    name?: any;
    assetsList?: any;
}

function CreatePoolModal({
    visible,
    hideModal,
    account,
    searchList,
    marketPickerAsset
}: CreatePoolModalProps) {
    const [state, setState] = React.useState<CreatePoolModalState>(
        getInitialState
    );
    const mergeState = (patch: Partial<CreatePoolModalState>) =>
        setState(prev => ({...prev, ...patch}));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const timerRef = React.useRef<any>(null);
    const intervalIdRef = React.useRef<any>(null);

    const getAssetListRef = React.useRef<any>(null);
    if (!getAssetListRef.current) {
        getAssetListRef.current = debounce(
            (AssetActions as any).getAssetList.defer,
            150
        );
    }
    const getAssetsByIssuerRef = React.useRef<any>(null);
    if (!getAssetsByIssuerRef.current) {
        getAssetsByIssuerRef.current = debounce(
            (AssetActions as any).getAssetsByIssuer.defer,
            150
        );
    }

    const checkAndUpdateMarketList = (marketsList: any) => {
        clearInterval(intervalIdRef.current);
        console.log("CreatePooModal marketsList: ", marketsList);
        intervalIdRef.current = setInterval(() => {
            let needFetchIssuer = 0;
            for (const [, market] of marketsList) {
                if (!market.issuer) {
                    market.issuer = fetchIssuerName(market.issuerId);
                    if (!market.issuer) needFetchIssuer++;
                }
            }
            if (needFetchIssuer) return;
            clearInterval(intervalIdRef.current);

            if (stateRef.current.searchPoolName) {
                mergeState({poolNameArray: marketsList});
            } else if (stateRef.current.searchAssetA) {
                mergeState({assetsAArray: marketsList});
            } else if (stateRef.current.searchAssetB) {
                mergeState({assetsBArray: marketsList});
            }
        }, 300);
    };

    const isMountRef = React.useRef(true);
    const prevMarketPickerAssetRef = React.useRef(marketPickerAsset);
    const prevSearchListRef = React.useRef(searchList);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevMarketPickerAssetRef.current = marketPickerAsset;
            prevSearchListRef.current = searchList;
            return;
        }

        if (marketPickerAsset !== prevMarketPickerAssetRef.current) {
            console.log("componentWillReceiveProps is invoked.");
        }

        if (searchList !== prevSearchListRef.current) {
            if (state.searchAssetA) {
                assetFilter(
                    {searchAssets: searchList, marketPickerAsset},
                    {
                        inputValue: state.filterAssetA,
                        lookupQuote: state.lookupQuote
                    },
                    mergeState,
                    checkAndUpdateMarketList
                );
            } else if (state.searchAssetB) {
                assetFilter(
                    {searchAssets: searchList, marketPickerAsset},
                    {
                        inputValue: state.filterAssetB,
                        lookupQuote: state.lookupQuote
                    },
                    mergeState,
                    checkAndUpdateMarketList
                );
            } else if (state.searchPoolName) {
                assetFilter(
                    {searchAssets: searchList, marketPickerAsset},
                    {
                        inputValue: state.poolName,
                        lookupQuote: state.lookupQuote
                    },
                    mergeState,
                    checkAndUpdateMarketList
                );
            }
        }

        prevMarketPickerAssetRef.current = marketPickerAsset;
        prevSearchListRef.current = searchList;
    });

    React.useEffect(() => {
        return () => {
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        };
    }, []);

    const onClose = () => {
        setState(getInitialState());
    };

    const onCancel = () => {
        hideModal();
        setState(getInitialState());
        onClose();
    };

    const onCreatePool = () => {
        if (!state.poolName) {
            mergeState({showAlertInputPool: true});
            return;
        } else if (!state.assetsA) {
            mergeState({showAlertInputAssetA: true});
            return;
        } else if (!state.assetsB) {
            mergeState({showAlertInputAssetB: true});
            return;
        } else if (!state.takerFee) {
            mergeState({showAlertInputTrankerFee: true});
            return;
        } else if (!state.unstakeFee) {
            mergeState({showAlertInputUnstakeFee: true});
            return;
        }

        if (
            state.assetsA &&
            state.assetsB &&
            state.takerFee &&
            state.unstakeFee
        ) {
            const assetA_id = Number(
                state.assetsA[1]["id"].replace("1.3.", "")
            );
            const assetB_id = Number(
                state.assetsB[1]["id"].replace("1.3.", "")
            );
            if (assetA_id > assetB_id) {
                console.log(
                    state.assetsB[1]["quote"],
                    state.assetsA[1]["quote"]
                );
                (ApplicationApi as any).liquidityPoolCreate(
                    account,
                    state.assetsB[1]["quote"],
                    state.assetsA[1]["quote"],
                    state.poolName,
                    state.takerFee * 100.0,
                    state.unstakeFee * 100.0
                );
                hideModal();
            } else {
                console.log(
                    state.assetsA[1]["quote"],
                    state.assetsB[1]["quote"]
                );
                (ApplicationApi as any).liquidityPoolCreate(
                    account,
                    state.assetsA[1]["quote"],
                    state.assetsB[1]["quote"],
                    state.poolName,
                    state.takerFee * 100.0,
                    state.unstakeFee * 100.0
                );
                hideModal();
            }
        }
        onCancel();
    };

    const onPoolNameChange = (getBackedAssets: boolean, e: any) => {
        mergeState(getInitAlertState());
        const toFind = e.target.value.trim().toUpperCase();
        const isValidName = !ChainValidation.is_valid_symbol_error(toFind, true);

        if (!isValidName) {
            mergeState({
                poolName: toFind,
                poolNameArray: [],
                searchPoolName: false
            });
            return;
        } else {
            mergeState({
                poolName: toFind,
                searchPoolName: true
            });
        }

        if (state.poolName !== toFind) {
            timerRef.current && clearTimeout(timerRef.current);
        }

        const account_name = account.get("name");
        const assets = [...account.get("assets")];

        timerRef.current = setTimeout(() => {
            lookupAccountAssets(
                account_name,
                toFind,
                assets[0],
                getBackedAssets,
                getAssetsByIssuerRef.current,
                mergeState
            );
        }, 1500);
    };

    const onSetAssetAArray = () => {};

    const onAssetASearch = (getBackedAssets: boolean, e: any) => {
        mergeState(getInitAlertState());
        const toFind = e.target.value.trim().toUpperCase();
        const isValidName = !ChainValidation.is_valid_symbol_error(toFind, true);

        if (!isValidName) {
            /* Don't lookup invalid asset names */
            mergeState({
                filterAssetA: toFind
            });
            onSetAssetAArray();

            return;
        } else {
            mergeState({
                filterAssetA: toFind,
                searchAssetA: true,
                searchAssetB: false
            });
        }

        if (state.filterAssetA !== toFind) {
            timerRef.current && clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            lookupAssets(
                toFind,
                getBackedAssets,
                getAssetListRef.current,
                mergeState
            );
        }, 1500);
    };

    const onAssetBSearch = (getBackedAssets: boolean, e: any) => {
        mergeState(getInitAlertState());

        const toFind = e.target.value.trim().toUpperCase();
        const isValidName = !ChainValidation.is_valid_symbol_error(toFind, true);

        if (!isValidName) {
            /* Don't lookup invalid asset names */
            mergeState({
                filterAssetB: toFind
            });
            onSetAssetAArray();

            return;
        } else {
            mergeState({
                filterAssetB: toFind,
                searchAssetA: false,
                searchAssetB: true
            });
        }

        if (state.filterAssetB !== toFind) {
            timerRef.current && clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            lookupAssets(
                toFind,
                getBackedAssets,
                getAssetListRef.current,
                mergeState
            );
        }, 1500);
    };

    const onSetPoolName = (name: any) => {
        mergeState({poolName: name, searchPoolName: false});
    };

    const onSetAssetA = (e: any) => {
        mergeState(getResetSearchState());
        console.log("onSetAssetA ", e);
        console.log("takerFee: ", state.takerFee);
        mergeState({
            assetsA: e,
            filterAssetA: e[0]
        });
    };

    const onSetAssetB = (e: any) => {
        mergeState(getResetSearchState());
        console.log("onSetAssetB ", e);
        mergeState({
            assetsB: e,
            filterAssetB: e[0]
        });
    };

    const onSetTakerFee = (e: any) => {
        mergeState(getInitAlertState());
        mergeState({
            takerFee: e.target.value
        });
    };

    const onFormatTakerFee = () => {
        const takerFee = state.takerFee;
        mergeState({
            takerFee: parseFloat(takerFee).toFixed(2)
        });
    };

    const onSetUnstackFee = (e: any) => {
        mergeState(getInitAlertState());
        mergeState({
            unstakeFee: e.target.value
        });
    };

    const onFormatUnstackFee = () => {
        const unstakeFee = state.unstakeFee;
        mergeState({
            unstakeFee: parseFloat(unstakeFee).toFixed(2)
        });
    };

    const footer = [
        <Button variant="accent" key="submit" onClick={onCreatePool}>
            {counterpart.translate("account.liquidity_pools.create_pool")}
        </Button>
    ];

    return (
        <Modal visible={visible} onCancel={onCancel} footer={footer}>
            <div className="">
                <div style={{margin: "0 0"}}>
                    <Translate
                        component="h3"
                        content="account.liquidity_pools.create_pool"
                    />
                </div>
                <form
                    className="full-width"
                    style={{margin: "0 1rem"}}
                    onSubmit={onCreatePool as any}
                    noValidate
                >
                    <div className="form-group inputAddon small-12">
                        <div id="filter">
                            <Form.Item>
                                <Input
                                    type="text"
                                    value={state.poolName ?? ""}
                                    onChange={(e: any) =>
                                        onPoolNameChange(false, e)
                                    }
                                    placeholder={counterpart.translate(
                                        "account.liquidity_pools.pool_name"
                                    )}
                                    maxLength={16}
                                    addonAfter={<AntIcon type="search" />}
                                />
                                {state.showAlertInputPool ? (
                                    <Alert
                                        message={counterpart.translate(
                                            "account.liquidity_pools.alert_request_input_pool"
                                        )}
                                        type="warning"
                                        showIcon
                                        style={{marginBottom: "2em"}}
                                    />
                                ) : null}
                            </Form.Item>
                        </div>
                        {state.searchPoolName && (
                            <div className="results">
                                {state.poolNameArray.map(
                                    (poolName: any, index: number) => {
                                        return (
                                            <SearchListItem
                                                key={index}
                                                itemLabel={poolName[0]}
                                                itemData={poolName[0]}
                                                itemSelect={onSetPoolName}
                                            />
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </div>
                    <div className="form-group inputAddon small-12">
                        <div id="assetAfilter">
                            <Form.Item>
                                <Input
                                    type="text"
                                    value={state.filterAssetA}
                                    onChange={(e: any) =>
                                        onAssetASearch(true, e)
                                    }
                                    placeholder={counterpart.translate(
                                        "account.liquidity_pools.asset_a"
                                    )}
                                    maxLength={16}
                                    addonAfter={<AntIcon type="search" />}
                                />
                                {state.showAlertChangeAssetA ? (
                                    <Alert
                                        message={counterpart.translate(
                                            "account.liquidity_pools.alert_asset_a"
                                        )}
                                        type="warning"
                                        showIcon
                                        style={{marginBottom: "2em"}}
                                    />
                                ) : null}
                                {state.showAlertInputAssetA ? (
                                    <Alert
                                        message={counterpart.translate(
                                            "account.liquidity_pools.alert_request_input_asset_a"
                                        )}
                                        type="warning"
                                        showIcon
                                        style={{marginBottom: "2em"}}
                                    />
                                ) : null}
                            </Form.Item>
                        </div>
                        {state.searchAssetA && (
                            <div className="results">
                                {state.assetsAArray.map(
                                    (asset: any, index: number) => {
                                        return (
                                            <SearchListItem
                                                key={index}
                                                itemLabel={asset[0]}
                                                itemData={asset}
                                                itemSelect={onSetAssetA}
                                            />
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </div>
                    <div className="form-group inputAddon small-12">
                        <div id="assetAfilter">
                            <Form.Item>
                                <Input
                                    type="text"
                                    value={state.filterAssetB}
                                    onChange={(e: any) =>
                                        onAssetBSearch(true, e)
                                    }
                                    placeholder={counterpart.translate(
                                        "account.liquidity_pools.asset_b"
                                    )}
                                    maxLength={16}
                                    addonAfter={<AntIcon type="search" />}
                                />
                                {state.showAlertChangeAssetB ? (
                                    <Alert
                                        message={counterpart.translate(
                                            "account.liquidity_pools.alert_asset_b"
                                        )}
                                        type="warning"
                                        showIcon
                                        style={{marginBottom: "2em"}}
                                    />
                                ) : null}
                                {state.showAlertInputAssetB ? (
                                    <Alert
                                        message={counterpart.translate(
                                            "account.liquidity_pools.alert_request_input_asset_b"
                                        )}
                                        type="warning"
                                        showIcon
                                        style={{marginBottom: "2em"}}
                                    />
                                ) : null}
                            </Form.Item>
                        </div>
                        {state.searchAssetB && (
                            <div className="results">
                                {state.assetsBArray.map(
                                    (asset: any, index: number) => {
                                        return (
                                            <SearchListItem
                                                key={index}
                                                itemLabel={asset[0]}
                                                itemData={asset}
                                                itemSelect={onSetAssetB}
                                            />
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </div>
                    <div className="form-group inputAddon small-12">
                        <Input
                            placeholder={
                                counterpart.translate(
                                    "account.liquidity_pools.taker_fee"
                                ) + " %"
                            }
                            type="number"
                            style={{width: "70%"}}
                            autoComplete="off"
                            value={state.takerFee}
                            onChange={onSetTakerFee}
                            onBlur={onFormatTakerFee}
                            addonAfter="Taker Fee %"
                            maxLength={16}
                        />
                        {state.showAlertChangeTrankerFee ? (
                            <Alert
                                message={counterpart.translate(
                                    "account.liquidity_pools.alert_taker_fee"
                                )}
                                type="warning"
                                showIcon
                                style={{marginBottom: "2em"}}
                            />
                        ) : null}
                        {state.showAlertInputTrankerFee ? (
                            <Alert
                                message={counterpart.translate(
                                    "account.liquidity_pools.alert_request_input_taker_fee"
                                )}
                                type="warning"
                                showIcon
                                style={{marginBottom: "2em"}}
                            />
                        ) : null}
                    </div>

                    <div className="form-group inputAddon small-12">
                        <Input
                            placeholder={
                                counterpart.translate(
                                    "account.liquidity_pools.unstake_fee"
                                ) + " %"
                            }
                            type="number"
                            style={{width: "70%"}}
                            autoComplete="off"
                            value={state.unstakeFee}
                            onChange={onSetUnstackFee}
                            onBlur={onFormatUnstackFee}
                            addonAfter="Unstake Fee %"
                            maxLength={16}
                        />
                        {state.showAlertChangeUnstakeFee ? (
                            <Alert
                                message={counterpart.translate(
                                    "account.liquidity_pools.alert_unstack_fee"
                                )}
                                type="warning"
                                showIcon
                                style={{marginBottom: "2em"}}
                            />
                        ) : null}
                        {state.showAlertInputUnstakeFee ? (
                            <Alert
                                message={counterpart.translate(
                                    "account.liquidity_pools.alert_request_input_unstack_fee"
                                )}
                                type="warning"
                                showIcon
                                style={{marginBottom: "2em"}}
                            />
                        ) : null}
                    </div>

                    <div className="form-group" />
                </form>
            </div>
        </Modal>
    );
}

export default CreatePoolModal;
