// TypeScript/functional-component port of the legacy MarketPicker.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the "pick a market to trade"
// modal, opened from `Exchange.jsx` (not yet ported, its only caller).
// Three components in one file, same as the original: `MarketListItem`
// (one search-result row), `MarketPickerWrapper` (the search box/results
// list), and `MarketPicker` (the modal shell, alt-react `connect`-wrapped
// in the original).
//
// Confirmed dead, dropped (verified by reading the whole file):
// - `MarketPicker`'s local `open`/`smallScreen` state - `open` is
//   initialized and never read or set again anywhere; `smallScreen` is
//   computed once in `UNSAFE_componentWillMount` from `window.innerWidth`
//   and never read anywhere either (no resize listener, no consumer).
//   With both gone, `UNSAFE_componentWillMount` itself and the
//   constructor's local state are removable in full.
// - `MarketPicker.show()` - defined, never called or bound to any
//   element anywhere in the file.
// - The `assetsLoading` prop injected by the original `connect(...,
//   {getProps() {return {searchAssets: ..., assetsLoading: ...}}})` -
//   computed from `AssetStore` but never read anywhere in this file's
//   three components.
// - The dynamic-string `ref={this.props.modalId}` on `<Modal>` - never
//   read via `this.refs[...]` anywhere.
//
// `alt-react`'s `connect(MarketPicker, {listenTo: () => [AssetStore],
// getProps: () => ({searchAssets: ..., assetsLoading: ...})})` replaced
// with `useAltStore(AssetStore)`, this migration's established Alt.js
// adapter, reading only the one field (`assets`) actually used.
//
// `MarketListItem`'s `this.props.history.push(linkTo)` - originally fed
// an explicit `history` prop threaded all the way down from
// `Exchange.jsx` (itself getting it from the route, not from its own
// `withRouter`) - is replaced with `useHistory()` read directly in
// `MarketListItem`, the same always-current router context object,
// without the prop-drilling.
//
// `MarketPickerWrapper`'s `UNSAFE_componentWillReceiveProps` has two
// independent checks, replicated as two separate effects:
// - `marketPickerAsset` changing resets all local state to its initial
//   shape - a `[marketPickerAsset]`-keyed effect, guarded to skip its
//   first (mount) run.
// - `searchAssets` changing re-runs `assetFilter` - but notably, using
//   `this.props.searchAssets`/`marketPickerAsset`/`baseAsset`/
//   `quoteAsset` (the values from *before* this update), not
//   `nextProps`. Preserved exactly via a ref tracking the previous
//   render's props, read before being updated to the new values - not
//   "fixed" to use the fresh values, since that would be a real behavior
//   change this port isn't the place to make.
//
// `MarketPickerWrapper`'s `shouldComponentUpdate` is a second confirmed-
// real (non-no-op) SCU in this migration: it only re-renders on a
// `visible`/`marketPickerAsset`/`searchAssets` prop change (deliberately
// narrower than all props, since this component receives a wide prop
// spread from `Exchange.jsx` via `MarketPicker`) or *any* state change.
// The state-change half needs no replication - a functional component's
// own `useState` updates always trigger its re-render regardless of
// `React.memo`, which only gates re-renders triggered by the parent - so
// only the props half is given to `React.memo` as a custom comparator.
//
// `componentDidMount`/`componentDidUpdate` both call the same
// `.focus()` on the search input - collapsed into one
// no-dependency-array effect (runs after every render, mount included),
// which is exactly the union of when the two original methods fired.
import * as React from "react";
import {ChainValidation} from "bitsharesjs";
import counterpart from "counterpart";
import {debounce} from "lodash-es";
import Translate from "react-translate-component";
import {Link, LinkProps, useHistory} from "react-router-dom";
import AssetActions from "actions/AssetActions";
import AssetStore from "stores/AssetStore";
import {Form, Input, Modal, Icon as AntIcon} from "bitshares-ui-style-guide";
import AssetName from "../Utility/AssetName";
import {
    lookupAssets,
    assetFilter,
    fetchIssuerName
} from "./MarketPickerHelpers";
import {useAltStore} from "../../next/hooks/useAltStore";

const TypedLink = Link as React.ComponentType<LinkProps>;

interface MarketListItemProps {
    onClose: (...args: any[]) => any;
    quoteSymbol: string;
    baseSymbol: string;
    market: any;
    marketPickerAsset: string;
    tabIndex: number;
}

function MarketListItem({
    onClose,
    quoteSymbol,
    baseSymbol,
    market,
    marketPickerAsset,
    tabIndex
}: MarketListItemProps) {
    const history = useHistory();
    const marketSymbol = market[1]["quote"];
    const linkTo =
        quoteSymbol == marketPickerAsset
            ? `/market/${marketSymbol}_${baseSymbol}`
            : `/market/${quoteSymbol}_${marketSymbol}`;

    function onKeyPress(e: any) {
        if (e.key == "Enter") {
            history.push(linkTo);
        }
    }

    return (
        <li
            key={market[0]}
            style={{height: 40}}
            onKeyPress={onKeyPress}
            tabIndex={tabIndex}
        >
            <TypedLink style={{display: "flex"}} onClick={onClose} to={linkTo}>
                <div style={{flex: 2}}>
                    <AssetName name={market[1]["quote"]} />
                </div>
                <div style={{flex: 3}}>{market[1].issuer}</div>
            </TypedLink>
        </li>
    );
}

function initialWrapperState() {
    return {
        marketsList: [] as any[],
        lookupQuote: null as any,
        inputValue: ""
    };
}

interface MarketPickerWrapperProps {
    visible: boolean;
    marketPickerAsset: string;
    searchAssets: any;
    baseAsset: any;
    quoteAsset: any;
    onClose: (...args: any[]) => any;
}

function MarketPickerWrapperInner({
    marketPickerAsset,
    searchAssets,
    baseAsset,
    quoteAsset,
    onClose
}: MarketPickerWrapperProps) {
    const [state, setState] = React.useState<any>(initialWrapperState());
    const inputRef = React.useRef<any>(null);
    const timerRef = React.useRef<any>(null);
    const intervalIdRef = React.useRef<any>(null);
    const getAssetListRef = React.useRef(
        debounce((AssetActions as any).getAssetList.defer, 150)
    );

    function mergeState(partial: any) {
        setState((prev: any) => ({...prev, ...partial}));
    }

    React.useEffect(() => {
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    });

    const isFirstAssetReset = React.useRef(true);
    React.useEffect(() => {
        if (isFirstAssetReset.current) {
            isFirstAssetReset.current = false;
            return;
        }
        setState(initialWrapperState());
        // eslint-disable-next-line
    }, [marketPickerAsset]);

    const prevPropsRef = React.useRef({
        searchAssets,
        marketPickerAsset,
        baseAsset,
        quoteAsset
    });
    const isFirstFilterCheck = React.useRef(true);
    React.useEffect(() => {
        if (isFirstFilterCheck.current) {
            isFirstFilterCheck.current = false;
            prevPropsRef.current = {
                searchAssets,
                marketPickerAsset,
                baseAsset,
                quoteAsset
            };
            return;
        }
        const prev = prevPropsRef.current;
        if (searchAssets !== prev.searchAssets) {
            (assetFilter as any)(
                {
                    searchAssets: prev.searchAssets,
                    marketPickerAsset: prev.marketPickerAsset,
                    baseAsset: prev.baseAsset,
                    quoteAsset: prev.quoteAsset
                },
                {
                    inputValue: state.inputValue,
                    lookupQuote: state.lookupQuote
                },
                mergeState,
                checkAndUpdateMarketList
            );
        }
        prevPropsRef.current = {
            searchAssets,
            marketPickerAsset,
            baseAsset,
            quoteAsset
        };
        // eslint-disable-next-line
    }, [searchAssets]);

    function checkAndUpdateMarketList(marketsList: any[]) {
        if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        intervalIdRef.current = setInterval(() => {
            let needFetchIssuer = 0;
            for (const [, market] of marketsList) {
                if (!market.issuer) {
                    market.issuer = (fetchIssuerName as any)(market.issuerId);
                    if (!market.issuer) needFetchIssuer++;
                }
            }
            if (needFetchIssuer) return;
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
            mergeState({
                marketsList,
                activeSearch: false
            });
        }, 300);
    }

    function onInputName(getBackedAssets: boolean, e: any) {
        const toFind = e.target.value.trim().toUpperCase();
        const isValidName = !(ChainValidation as any).is_valid_symbol_error(
            toFind,
            true
        );

        if (!isValidName) {
            /* Don't lookup invalid asset names */
            mergeState({
                inputValue: toFind,
                activeSearch: false,
                marketsList: []
            });
            return;
        } else {
            mergeState({
                inputValue: toFind,
                activeSearch: true,
                marketsList: []
            });
        }

        if (state.inputValue !== toFind) {
            if (timerRef.current) clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            (lookupAssets as any)(
                toFind,
                getBackedAssets,
                getAssetListRef.current,
                mergeState
            );
        }, 1500);
    }

    function renderSearchBar() {
        const {inputValue} = state;

        const labelKey = "exchange.market_picker.find_by_asset";
        const label = counterpart.translate(labelKey).toUpperCase();
        const placeHolderKey = "exchange.market_picker.search";
        return (
            <div id="filter">
                <Form.Item label={label}>
                    <Input
                        type="text"
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e: any) => onInputName(true, e)}
                        placeholder={counterpart.translate(placeHolderKey)}
                        maxLength={16}
                        tabIndex={2}
                    />
                </Form.Item>
            </div>
        );
    }

    function renderResults() {
        const {marketsList, activeSearch, inputValue} = state;
        const loading = activeSearch && inputValue.length != 0;

        const baseSymbol = baseAsset.get("symbol");
        const quoteSymbol = quoteAsset.get("symbol");

        if (!loading)
            return (
                <div className="results">
                    <ul style={{marginLeft: 0, minHeight: "20px"}}>
                        {marketsList.map((market: any, index: number) => {
                            return (
                                <MarketListItem
                                    key={index}
                                    tabIndex={index + 100}
                                    baseSymbol={baseSymbol}
                                    quoteSymbol={quoteSymbol}
                                    market={market}
                                    marketPickerAsset={marketPickerAsset}
                                    onClose={onClose}
                                />
                            );
                        })}
                    </ul>
                </div>
            );
        return (
            <AntIcon
                style={{marginLeft: "8px"}}
                type="loading"
                theme="outlined"
            />
        );
    }

    return (
        <div className="marketPicker">
            <div className="marketPicker__subHeader">
                <Translate content="exchange.market_picker.sub_title" />
                &nbsp;
                <TypedLink
                    to={`/asset/${marketPickerAsset}`}
                    style={{
                        cursor: "pointer",
                        color: "lightblue !important"
                    }}
                >
                    <AssetName name={marketPickerAsset} />
                </TypedLink>
            </div>
            {renderSearchBar()}
            {renderResults()}
        </div>
    );
}

function arePickerWrapperPropsEqual(
    prevProps: MarketPickerWrapperProps,
    nextProps: MarketPickerWrapperProps
) {
    return (
        nextProps.visible === prevProps.visible &&
        nextProps.marketPickerAsset === prevProps.marketPickerAsset &&
        nextProps.searchAssets === prevProps.searchAssets
    );
}

const MarketPickerWrapper = React.memo(
    MarketPickerWrapperInner,
    arePickerWrapperPropsEqual
);

interface MarketPickerProps {
    visible: boolean;
    showModal: () => void;
    hideModal: () => void;
    modalId: string;
    quoteAsset: any;
    baseAsset: any;
    marketPickerAsset: string;
    onToggleMarketPicker: (...args: any[]) => any;
    [key: string]: any;
}

export default function MarketPicker(props: MarketPickerProps) {
    const {
        visible,
        hideModal,
        modalId,
        quoteAsset,
        baseAsset,
        onToggleMarketPicker
    } = props;
    const assetState = useAltStore<any>(AssetStore);
    const searchAssets = assetState.assets;

    function onClose() {
        onToggleMarketPicker(null);
        hideModal();
    }

    const isFirstAssetChangeCheck = React.useRef(true);
    React.useEffect(() => {
        if (isFirstAssetChangeCheck.current) {
            isFirstAssetChangeCheck.current = false;
            return;
        }
        onClose();
        // eslint-disable-next-line
    }, [quoteAsset.get("id"), baseAsset.get("id")]);

    return (
        <Modal
            title={counterpart.translate("exchange.market_picker.title")}
            closable={false}
            id={modalId}
            overlay={true}
            onCancel={onClose}
            noHeaderContainer
            footer={null}
            {...props}
            visible={visible}
        >
            <MarketPickerWrapper
                {...props}
                onClose={onClose}
                searchAssets={searchAssets}
            />
        </Modal>
    );
}
