// TypeScript/functional-component port of the legacy MyMarkets.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the starred/find markets list
// panel, used both as an Exchange screen satellite and as the Explorer's
// "Markets" tab (via MarketsContainer.tsx). Mechanical translation of the
// sort/filter/lookup logic; no chain-transaction logic here (this only
// reads market/asset data and dispatches view-setting/star toggles).
//
// Confirmed dead, dropped:
// - `MarketGroup._onToggle()`: defined, never wired to any click handler
//   anywhere (the collapsible `open` state is only ever set from its
//   initial-state derivation, never toggled interactively).
// - `MarketGroup`'s commented-out `_onSelectBase` - already inert in the
//   original source, dropped along with the comment.
// - `MarketGroup`'s `maxRows`/`allowChange` props: declared (one via
//   `defaultProps`) and passed by both call sites in `MyMarkets`, but
//   never read anywhere inside `MarketGroup` - dropped on both the
//   passing and receiving side, since this slice ports both together.
// - `MyMarkets`'s own `_inverseSort`/`_changeSort` methods and their
//   `inverseSort`/`sortBy` state fields: a copy-paste duplicate of
//   `MarketGroup`'s own (actually-used) version - never called and never
//   read anywhere in `MyMarkets.render()` (`MarketGroup`'s own column
//   headers already own this sorting; `MyMarkets` never renders its own
//   sortable headers).
// - `MyMarkets._goMarkets()`: defined, never called from anywhere.
// - `MyMarkets.clearInput()`: defined, never called from anywhere.
// - `MyMarkets`'s `assetNameError` state: read once in `render()` behind
//   a ternary, but never `setState`-assigned anywhere in the class, so
//   the branch it gates is provably always `null` - dropped along with
//   the always-dead branch.
// - `UNSAFE_componentWillMount`'s `if (this.props.currrent) {...}` block
//   (note the typo - three r's): no caller anywhere in the app ever
//   passes a prop literally named `currrent`, so this block never ran -
//   confirmed via a whole-app grep. Dropped rather than "fixed" into
//   reading the correctly-spelled `current` prop, since that would be a
//   behavior change beyond a mechanical port.
// - `UNSAFE_componentWillReceiveProps`'s `if (this.props.myMarketTab &&
//   ...) { this.refs.findSearchInput.focus(); }`: `myMarketTab` (as a
//   *prop*) is never passed by either real caller (`Exchange.jsx`,
//   `MarketsContainer.tsx`) - confirmed via a whole-app grep - only
//   `MyMarkets`'s own internally-derived `const myMarketTab = activeTab
//   === "my-market"` exists. Dropped along with the now-unused
//   `findSearchInput` ref (nothing else reads it - no external `ref=` is
//   ever attached to `<MyMarkets>` either).
// - The `MyMarketsWrapper` passthrough class (`render() { return
//   <MyMarkets {...this.props} />; }`): added no logic, collapsed away -
//   `connect()` now wraps the debounced component directly.
// - The render-time `const translator = require("counterpart");` (used
//   only for the two `data-intro` walkthrough strings): the same
//   `counterpart` singleton is already imported at module scope and used
//   elsewhere in this file - replaced with that import directly rather
//   than re-requiring the same module on every render.
//
// Preserved verbatim (not "fixed"), pre-existing bugs:
// - `MarketGroup`'s `_inverseSort()` (the real, used one) called
//   `SettingsActions.changeViewSetting({myMarketsInvert:
//   !this.state.myMarketsInvert})` - but the actual state field is named
//   `inverseSort`, not `myMarketsInvert`, so `this.state.myMarketsInvert`
//   is always `undefined` and this persisted setting is always sent as
//   `true`, regardless of the real toggled direction (which the local
//   `inverseSort` state - set correctly right below it - does track).
//
// Structural changes:
// - `MarketGroup`'s real `shouldComponentUpdate` (checks `markets`
//   shallow-equality plus `starredMarkets`/`marketStats`/`userMarkets`
//   reference equality; state-shallow-equality needs no replication,
//   since a function component's own `useState` updates always
//   re-render it regardless of `React.memo`) is preserved via
//   `React.memo` with the exact logical inverse comparator.
//   `UNSAFE_componentWillReceiveProps` (re-derives `open`/`inverseSort`/
//   `sortBy` when `findMarketTab` changes) becomes a `[findMarketTab]`-
//   keyed, mount-skipped effect. Because that effect only runs when
//   `React.memo` actually re-renders the component, and the memo
//   comparator does not itself check `findMarketTab`, there is the same
//   narrow, accepted approximation gap already documented for
//   `PriceStatWithLabel.tsx`: if `findMarketTab` toggles in the exact
//   same update where every memo-checked prop is unchanged, the class
//   would still re-derive local state (since
//   `UNSAFE_componentWillReceiveProps` always ran pre-SCU) while this
//   port would skip it. In practice `markets` is a freshly recomputed
//   array whenever `findMarketTab` flips (both real call sites tie it to
//   `MyMarkets`'s own `activeTab`, which also drives `_getMarkets()`), so
//   this gap is not expected to be observable.
// - `MyMarkets`'s own `shouldComponentUpdate` both gates renders *and*
//   performs a real side effect inline (calling `_changeTab` when a
//   state or prop change makes `activeTab` stale) - a pattern with no
//   direct hooks equivalent. The side effect is split into two pieces:
//   the "local state change is pending" branch is a redundant re-
//   invocation of the very call that triggered it (confirmed by tracing
//   `_changeTab`'s own call sites - it only ever fires as a result of
//   `_changeTab` already having run), so it is dropped as a harmless,
//   idempotent, functionally-unobservable duplicate dispatch, not
//   replicated. The "the `activeTab` *prop* changed and we're not using
//   the tabHeader UI" branch is real and used live (`Exchange.jsx` drives
//   this component's tab via its own `activeTab` prop) - kept as a
//   `[activeTab prop]`-keyed, mount-skipped effect. The render-gating
//   half of the original SCU (the boolean it returns) is *not*
//   replicated via `React.memo` here - unlike `MarketGroup`'s SCU, this
//   one is entangled with the synchronous `setState`-in-SCU side effect
//   above in a way a static memo comparator can't safely reproduce, so
//   this component now re-renders somewhat more eagerly than the
//   original whenever its wrapping `debounceRender` (still applied,
//   unchanged) lets an update through - `debounceRender`'s own 50ms
//   throttle continues to bound the render rate exactly as before.
// - `componentDidMount`'s `setTimeout(() => this._changeTab(...), 100)`
//   and `_onInputName`'s lookup-debounce `setTimeout` both stay
//   uncleared on unmount, exactly like the original (only the
//   `_onInputName` timer is ever passed to `clearTimeout`, in
//   `componentWillUnmount`).
// - `location`/`history` are no longer threaded through to `<MarketRow>`
//   (via `MarketGroup`): already-confirmed dead there during the
//   `MarketRow.tsx` slice (`withRouter`'s own injected values always
//   shadowed them in react-router v5) - not part of `MarketRowProps` any
//   more, so there is nothing left to pass.
// - `connect(..., {listenTo, getProps})` becomes three `useAltStore`
//   calls (`SettingsStore`/`MarketsStore`/`AssetStore`), matching
//   `listenTo`'s store list; `getProps()`'s field list is read directly
//   off each store's state and merged with the JSX-supplied props,
//   matching `connect`'s own prop-merging behavior.
import * as React from "react";
import Immutable from "immutable";
import Ps from "perfect-scrollbar";
import utils from "common/utils";
import Translate from "react-translate-component";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import MarketRow from "./MarketRow";
import SettingsStore from "stores/SettingsStore";
import MarketsStore from "stores/MarketsStore";
import AssetStore from "stores/AssetStore";
import AssetName from "../Utility/AssetName";
import SettingsActions from "actions/SettingsActions";
import AssetActions from "actions/AssetActions";
import MarketsActions from "actions/MarketsActions";
import cnames from "classnames";
import {debounce} from "lodash-es";
import AssetSelector from "../Utility/AssetSelector";
import counterpart from "counterpart";
import LoadingIndicator from "../LoadingIndicator";
import {ChainValidation, ChainStore} from "bitsharesjs";
import debounceRender from "react-debounce-render";
import {getPossibleGatewayPrefixes, gatewayPrefixes} from "common/gateways";
import QuoteSelectionModal from "./QuoteSelectionModal";
import SearchInputUntyped from "../Utility/SearchInput";

// SearchInput.jsx declares its optional props only via a separate
// `SearchInput.defaultProps` (a pattern TS's JS inference doesn't treat
// as making them optional), so TS would otherwise demand every one of
// them at every call site - pre-existing, out of scope to touch here.
const SearchInput: any = SearchInputUntyped;
import {useAltStore} from "../../next/hooks/useAltStore";

interface MarketGroupProps {
    markets: any[] | undefined;
    base: string;
    marketStats: any;
    starredMarkets: any;
    current?: string;
    columns: any[];
    userMarkets: any;
    defaultMarkets?: any;
    viewSettings: any;
    index: number;
    findMarketTab: boolean;
    onlyLiquid?: boolean;
}

function getInitialGroupState(props: {
    findMarketTab: boolean;
    viewSettings: any;
    index: number;
}) {
    const open = props.findMarketTab
        ? true
        : props.viewSettings.get(`myMarketsBase_${props.index}`);
    return {
        open: open !== undefined ? open : true,
        inverseSort: props.viewSettings.get("myMarketsInvert", true),
        sortBy: props.viewSettings.get("myMarketsSort", "volume")
    };
}

function MarketGroupInner(props: MarketGroupProps) {
    const {
        columns,
        markets,
        base,
        marketStats,
        starredMarkets,
        current,
        userMarkets,
        defaultMarkets,
        viewSettings,
        index,
        findMarketTab,
        onlyLiquid = false
    } = props;

    const [groupState, setGroupState] = React.useState(() =>
        getInitialGroupState({findMarketTab, viewSettings, index})
    );
    const {open, inverseSort, sortBy} = groupState;

    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setGroupState(
            getInitialGroupState({findMarketTab, viewSettings, index})
        );
    }, [findMarketTab]);

    const inverseSortFn = () => {
        // Original bug preserved: `this.state.myMarketsInvert` doesn't
        // exist (the real field is `inverseSort`), so `!undefined` is
        // always `true` here.
        SettingsActions.changeViewSetting({
            myMarketsInvert: true
        });
        setGroupState(prev => ({...prev, inverseSort: !prev.inverseSort}));
    };

    const changeSort = (type: string) => {
        if (type !== sortBy) {
            SettingsActions.changeViewSetting({
                myMarketsSort: type
            });
            setGroupState(prev => ({...prev, sortBy: type}));
        } else {
            inverseSortFn();
        }
    };

    const onToggleUserMarket = (market: string) => {
        const [marketBase, marketQuote] = market.split("_");
        const newValue = !userMarkets.get(market);
        SettingsActions.setUserMarket(marketBase, marketQuote, newValue);
    };

    if (!markets || !markets.length) {
        return null;
    }

    const headers = columns.map(header => {
        switch (header.name) {
            case "market":
                return (
                    <th
                        key={header.name}
                        className="clickable"
                        onClick={() => changeSort("name")}
                    >
                        <Translate content="exchange.market" />
                    </th>
                );

            case "vol":
                return (
                    <th
                        key={header.name}
                        className="clickable"
                        onClick={() => changeSort("volume")}
                        style={{textAlign: "right"}}
                    >
                        <Translate content="exchange.vol_short" />
                    </th>
                );

            case "price":
                return (
                    <th key={header.name} style={{textAlign: "right"}}>
                        <Translate content="exchange.price" />
                    </th>
                );

            case "quoteSupply":
                return (
                    <th key={header.name}>
                        <Translate content="exchange.base_supply" />
                    </th>
                );

            case "baseSupply":
                return (
                    <th key={header.name}>
                        <Translate content="exchange.quote_supply" />
                    </th>
                );

            case "change":
                return (
                    <th
                        key={header.name}
                        className="clickable"
                        onClick={() => changeSort("change")}
                        style={{textAlign: "right"}}
                    >
                        <Translate content="exchange.change" />
                    </th>
                );

            case "issuer":
                return (
                    <th key={header.name}>
                        <Translate content="explorer.assets.issuer" />
                    </th>
                );

            case "add":
                return (
                    <th key={header.name} style={{textAlign: "right"}}>
                        <Translate content="account.perm.confirm_add" />
                    </th>
                );

            default:
                return <th key={header.name} />;
        }
    });

    const marketRows = markets
        .map(market => {
            if (
                onlyLiquid &&
                marketStats.get(market.id) &&
                marketStats.get(market.id).volumeBase == 0
            ) {
                return null;
            }
            return (
                <MarketRow
                    key={market.id}
                    name={
                        base === "others" ? (
                            <span>
                                <AssetName name={market.quote} />:
                                <AssetName name={market.base} />
                            </span>
                        ) : (
                            <AssetName dataPlace="left" name={market.quote} />
                        )
                    }
                    quote={market.quote}
                    base={market.base}
                    columns={columns}
                    leftAlign={true}
                    compact={true}
                    noSymbols={true}
                    stats={marketStats.get(market.id)}
                    starred={starredMarkets.has(market.id)}
                    current={current === market.id}
                    isChecked={userMarkets.has(market.id)}
                    isDefault={defaultMarkets && defaultMarkets.has(market.id)}
                    onCheckMarket={onToggleUserMarket}
                />
            );
        })
        .filter(a => {
            return a !== null;
        })
        .sort((a: any, b: any) => {
            const a_symbols = a.key.split("_");
            const b_symbols = b.key.split("_");
            const aStats = marketStats.get(a_symbols[0] + "_" + a_symbols[1]);
            const bStats = marketStats.get(b_symbols[0] + "_" + b_symbols[1]);

            switch (sortBy) {
                case "name":
                    if (a_symbols[0] > b_symbols[0]) {
                        return inverseSort ? -1 : 1;
                    } else if (a_symbols[0] < b_symbols[0]) {
                        return inverseSort ? 1 : -1;
                    } else {
                        if (a_symbols[1] > b_symbols[1]) {
                            return inverseSort ? -1 : 1;
                        } else if (a_symbols[1] < b_symbols[1]) {
                            return inverseSort ? 1 : -1;
                        } else {
                            return 0;
                        }
                    }

                case "volume":
                    if (aStats && bStats) {
                        if (inverseSort) {
                            return bStats.volumeBase - aStats.volumeBase;
                        } else {
                            return aStats.volumeBase - bStats.volumeBase;
                        }
                    } else {
                        return 0;
                    }

                case "change":
                    if (aStats && bStats) {
                        if (inverseSort) {
                            return bStats.change - aStats.change;
                        } else {
                            return aStats.change - bStats.change;
                        }
                    } else {
                        return 0;
                    }

                default:
                    // The original switch had no default case, so this
                    // fell through to an implicit `undefined` return -
                    // which Array.prototype.sort treats the same as `0`.
                    // Made explicit here only because TS requires a
                    // numeric return; zero behavioral difference.
                    return 0;
            }
        });

    return (
        <div style={{paddingRight: 10}}>
            {open ? (
                <table className="table table-hover text-right">
                    <thead>
                        <tr>{headers}</tr>
                    </thead>
                    {marketRows && marketRows.length ? (
                        <tbody>{marketRows}</tbody>
                    ) : null}
                </table>
            ) : null}
        </div>
    );
}

function marketGroupPropsAreEqual(
    prevProps: MarketGroupProps,
    nextProps: MarketGroupProps
) {
    if (!nextProps.markets || !prevProps.markets) {
        return false;
    }
    return (
        (utils as any).are_equal_shallow(nextProps.markets, prevProps.markets) &&
        nextProps.starredMarkets === prevProps.starredMarkets &&
        nextProps.marketStats === prevProps.marketStats &&
        nextProps.userMarkets === prevProps.userMarkets
    );
}

const MarketGroup = React.memo(MarketGroupInner, marketGroupPropsAreEqual);

interface MyMarketsProps {
    className?: string;
    style?: any;
    tabHeader?: boolean;
    noHeader?: boolean;
    headerStyle?: any;
    controls?: any;
    onlyLiquid?: boolean;
    onlyStars?: boolean;
    listHeight?: any;
    columns: any[];
    findColumns?: any[];
    current?: string;
    viewSettings: any;
    starredMarkets: any;
    marketStats: any;
    defaultMarkets: any;
    preferredBases: any;
    userMarkets: any;
    searchAssets: any;
    assetsLoading?: boolean;
    setMinWidth?: boolean;
    activeTab?: string;
}

function MyMarketsInner(props: MyMarketsProps) {
    const {
        className,
        style,
        tabHeader,
        noHeader,
        headerStyle,
        controls,
        onlyLiquid,
        onlyStars,
        listHeight,
        columns,
        findColumns,
        current,
        viewSettings,
        starredMarkets,
        marketStats,
        defaultMarkets,
        preferredBases: preferredBasesProp,
        userMarkets,
        searchAssets,
        assetsLoading,
        setMinWidth: setMinWidthProp = false,
        activeTab: activeTabProp = "my-market"
    } = props;

    const [isQuoteModalVisible, setIsQuoteModalVisible] = React.useState(
        false
    );
    const [activeTab, setActiveTab] = React.useState(
        viewSettings.get("favMarketTab", "my-market")
    );
    const [activeMarketTab, setActiveMarketTab] = React.useState(
        viewSettings.get("activeMarketTab", 0)
    );
    const [lookupQuote, setLookupQuote] = React.useState<string | null>(null);
    const [lookupBase, setLookupBase] = React.useState<string | null>(null);
    const [inputValue, setInputValue] = React.useState("");
    const [minWidth, setMinWidthState] = React.useState<any>("100%");
    const [findBaseInput, setFindBaseInput] = React.useState("BTS");
    const [activeFindBase, setActiveFindBase] = React.useState("BTS");
    const [myMarketFilter, setMyMarketFilter] = React.useState<
        string | undefined
    >(undefined);

    const favoritesRef = React.useRef<HTMLDivElement>(null);
    const timerRef = React.useRef<any>(null);
    const getAssetListRef = React.useRef(
        debounce((AssetActions as any).getAssetList.defer, 150)
    );
    const getAssetList = getAssetListRef.current;

    const setMinWidthFn = () => {
        if (
            setMinWidthProp &&
            favoritesRef.current &&
            activeTabProp === "my-market"
        ) {
            if (minWidth !== favoritesRef.current.offsetWidth) {
                setMinWidthState(favoritesRef.current.offsetWidth);
            }
        }
    };

    const changeTab = (tab: string) => {
        SettingsActions.changeViewSetting({
            favMarketTab: tab
        });
        setActiveTab(tab);
        setMinWidthFn();
    };

    const isFirstRender = React.useRef(true);

    // Mount-only: mirrors the original componentDidMount exactly (ref is
    // always attached by this point, since the container div is always
    // rendered unconditionally).
    React.useEffect(() => {
        Ps.initialize(favoritesRef.current as HTMLElement);
        setMinWidthFn();
        if (activeTab !== activeTabProp) {
            setTimeout(() => {
                changeTab(activeTabProp);
            }, 100);
        }
        return () => {
            clearTimeout(timerRef.current);
        };
    }, []);

    // Runs after every update (matching the original's unconditional
    // componentDidUpdate), mount-skipped.
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (favoritesRef.current) {
            Ps.update(favoritesRef.current);
        }
    });

    // Real, live behavior (Exchange.jsx drives this component's active
    // tab externally via its own `activeTab` prop when not using the
    // internal tabHeader UI) - see the file-header note on the dropped
    // "pending local state change" branch of the original SCU.
    const isFirstPropSyncRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstPropSyncRender.current) {
            isFirstPropSyncRender.current = false;
            return;
        }
        if (!tabHeader && activeTab !== activeTabProp) {
            changeTab(activeTabProp);
        }
    }, [activeTabProp]);

    const hideQuoteModal = () => {
        setIsQuoteModalVisible(false);
    };

    const showQuoteModal = () => {
        setIsQuoteModalVisible(true);
    };

    const toggleActiveMarketTab = (index: number) => {
        SettingsActions.changeViewSetting({
            activeMarketTab: index
        });
        setActiveMarketTab(index);
    };

    const onInputName = (
        getBackedAssets: boolean,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const toFind = e.target.value.trim().toUpperCase();
        const isValidName = !(ChainValidation as any).is_valid_symbol_error(
            toFind,
            true
        );

        setInputValue(toFind);
        /* Don't lookup invalid asset names */
        if (toFind && toFind.length >= 2 && !isValidName) return;

        if (inputValue !== toFind) {
            timerRef.current && clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            lookupAssets(toFind, getBackedAssets);
        }, 1500);
    };

    const lookupAssets = (value: string, gatewayAssets = false) => {
        if (!value && value !== "") return;

        const symbols = value.toUpperCase().split(":");
        const quote = symbols[0];
        const base = symbols.length === 2 ? symbols[1] : null;

        setLookupQuote(quote);
        setLookupBase(base);

        (SettingsActions.changeViewSetting as any).defer({
            marketLookupInput: value.toUpperCase()
        });

        getAssetList(quote, 50, gatewayAssets);
    };

    const onInputBaseAsset = (asset: string) => {
        setFindBaseInput(asset.toUpperCase());
    };

    const onFoundBaseAsset = (asset: any) => {
        if (asset) {
            setActiveFindBase(asset.get("symbol"));
        }
    };

    const handleSearchUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMyMarketFilter(
            e.target.value && e.target.value.toUpperCase()
        );
    };

    const getBases = () => {
        let bases = searchAssets
            .filter((a: any) => {
                if (lookupBase && lookupBase.length) {
                    return a.symbol.indexOf(lookupBase) === 0;
                }
                return a.symbol.indexOf(lookupQuote) !== -1;
            })
            .map((asset: any) => {
                if (lookupBase && lookupBase.length) {
                    if (asset.symbol.indexOf(lookupBase) === 0) {
                        return asset.symbol;
                    }
                } else if (preferredBasesProp.includes(asset.symbol)) {
                    if (
                        asset.symbol.length >= (lookupQuote as string).length &&
                        asset.symbol.length < (lookupQuote as string).length + 3
                    ) {
                        return asset.symbol;
                    }
                }
            })
            .filter((a: any) => !!a)
            .valueSeq()
            .toArray();

        bases = bases.concat(
            preferredBasesProp
                .filter((a: any) => {
                    if (!lookupBase || !lookupBase.length) {
                        return true;
                    }
                    return a.indexOf(lookupBase) === 0;
                })
                .toArray()
        );

        bases = bases.filter((base: any) => {
            if (lookupBase && lookupBase.length > 1) {
                return base.indexOf(lookupBase) === 0;
            } else {
                return true;
            }
        });

        return bases;
    };

    const getMarkets = () => {
        const possibleGatewayAssets: any[] = getPossibleGatewayPrefixes(
            preferredBasesProp
        );

        const bases = getBases();
        let allMarkets: any[] = [],
            baseGroups: any = {};
        let otherMarkets: any[] = [];

        const myMarketTab = activeTab === "my-market";

        if (searchAssets.size) {
            searchAssets
                .filter((a: any) => {
                    try {
                        if (a.options.description) {
                            const description = JSON.parse(
                                a.options.description
                            );
                            if ("visible" in description) {
                                if (!description.visible) return false;
                            }
                        }
                    } catch (e) {}

                    return (
                        a.symbol.indexOf(lookupQuote) !== -1 &&
                        a.symbol.length >= (lookupQuote as string).length
                    );
                })
                .forEach((asset: any) => {
                    bases.forEach((base: any) => {
                        const marketID = asset.symbol + "_" + base;

                        if (base !== asset.symbol) {
                            allMarkets.push([
                                marketID,
                                {quote: asset.symbol, base: base}
                            ]);
                        }
                    });
                });
        }

        allMarkets = allMarkets.filter(a => {
            // If a base asset is specified, limit the quote asset to the exact search term
            if (lookupBase) {
                return a[1].quote === lookupQuote;
            }
            return true;
        });

        let activeMarkets = myMarketTab
            ? defaultMarkets
            : Immutable.Map(allMarkets);
        if (myMarketTab && userMarkets.size) {
            userMarkets.forEach((market: any, key: any) => {
                if (!activeMarkets.has(key))
                    activeMarkets = activeMarkets.set(key, market);
            });
        }

        function filterAndSeparateMarkets(
            base: any,
            matchBases: any[],
            markets: any,
            baseGroups: any,
            otherMarkets: any[]
        ) {
            const others = markets
                .filter((a: any) => {
                    if (a.base === a.quote) return false;
                    /* Return search results in the Find Markets Tab */
                    if (!myMarketTab) {
                        if ((lookupQuote as string).length < 1) {
                            return false;
                        }

                        return a.quote.indexOf(lookupQuote) !== -1;
                    } else {
                        /* Return filtered markets if a filter is input */
                        const ID = a.quote + "_" + a.base;
                        if (!!myMarketFilter) {
                            return ID.indexOf(myMarketFilter) !== -1;
                        }
                        /* Return only starred markets if that option is checked */
                        if (onlyStars && !starredMarkets.has(ID)) {
                            return false;
                        }
                        /* Else return all markets */
                        return true;
                    }
                })
                .map((market: any) => {
                    const marketID = market.quote + "_" + market.base;
                    if (matchBases.indexOf(market.base) !== -1) {
                        if (!baseGroups[base]) {
                            baseGroups[base] = [];
                        }
                        const marketObject = {
                            id: marketID,
                            quote: market.quote,
                            base: market.base
                        };
                        if (
                            !baseGroups[base].find(
                                (m: any) => m.id === marketID
                            )
                        )
                            baseGroups[base].push(marketObject);
                        return null;
                    } else if (
                        !preferredBasesProp.includes(market.base) &&
                        possibleGatewayAssets.indexOf(market.base) === -1
                    ) {
                        return {
                            id: marketID,
                            quote: market.quote,
                            base: market.base
                        };
                    }
                })
                .filter((a: any) => !!a)
                .valueSeq()
                .take(myMarketTab ? 100 : 20)
                .toArray();
            return {otherMarkets: others.concat(otherMarkets), baseGroups};
        }

        if (activeMarkets.size > 0) {
            const currentBase = myMarketTab
                ? preferredBasesProp.get(activeMarketTab)
                : activeFindBase;

            ({otherMarkets, baseGroups} = filterAndSeparateMarkets(
                currentBase,
                [currentBase],
                activeMarkets,
                baseGroups,
                otherMarkets
            ));

            /* Check for possible gateway versions of the asset */
            gatewayPrefixes.forEach((prefix: string) => {
                const possibleGatewayAssetName = `${prefix}.${currentBase}`;
                const gatewayAsset = ChainStore.getAsset(
                    possibleGatewayAssetName
                );
                /* If the gateway offers an asset for this base, add it to the list */
                if (!!gatewayAsset) {
                    const gatewayMarkets = activeMarkets
                        .map((m: any) => {
                            if (m.quote === m.base) return null;
                            const newID = `${m.quote}_${possibleGatewayAssetName}`;
                            if (activeMarkets.has(newID)) return null;
                            return {
                                base: possibleGatewayAssetName,
                                quote: m.quote
                            };
                        }, {})
                        .filter((m: any) => !!m);
                    ({otherMarkets, baseGroups} = filterAndSeparateMarkets(
                        currentBase,
                        [currentBase, possibleGatewayAssetName],
                        gatewayMarkets,
                        baseGroups,
                        otherMarkets
                    ));
                }
            });
        }

        return {baseGroups, otherMarkets};
    };

    const myMarketTab = activeTab === "my-market";
    const defaultBases = preferredBasesProp.map((a: any) => a);

    let preferredBases = preferredBasesProp;
    if (!myMarketTab) {
        preferredBases = preferredBases.clear();
        preferredBases = preferredBases.push(activeFindBase);
    }

    /* In the find-market tab, only use market tab 0 */
    let effectiveActiveMarketTab = activeMarketTab;
    if (!myMarketTab) effectiveActiveMarketTab = 0;

    const {baseGroups, otherMarkets} = getMarkets();
    const hasOthers = otherMarkets && otherMarkets.length;
    const hc = "mymarkets-header clickable";
    const starClass = cnames(hc, {inactive: !myMarketTab});
    const allClass = cnames(hc, {inactive: myMarketTab});

    const listStyle: any = {
        minWidth: minWidth,
        minHeight: "6rem"
    };
    if (listHeight) {
        listStyle.height = listHeight;
    }

    return (
        <div className={className} style={style}>
            {tabHeader ? (
                <div
                    style={headerStyle}
                    className="grid-block shrink left-orderbook-header bottom-header"
                >
                    <div
                        className={starClass}
                        onClick={() => changeTab("my-market")}
                        data-intro={counterpart.translate(
                            "walkthrough.my_markets_tab"
                        )}
                    >
                        <Translate content="exchange.market_name" />
                    </div>
                    <div
                        className={allClass}
                        onClick={() => changeTab("find-market")}
                        data-intro={counterpart.translate(
                            "walkthrough.find_markets_tab"
                        )}
                    >
                        <Translate content="exchange.more" />
                    </div>
                </div>
            ) : null}
            {noHeader || tabHeader ? null : (
                <div style={headerStyle}>
                    <div className="exchange-content-header">
                        <span>
                            <Translate content="exchange.market_name" />
                        </span>
                    </div>
                </div>
            )}

            {controls ? (
                <div className="small-12 medium-6" style={{padding: "1rem 0"}}>
                    {controls ? (
                        <div style={{paddingBottom: "0.5rem"}}>{controls}</div>
                    ) : null}
                </div>
            ) : null}

            {myMarketTab ? (
                <div
                    className="grid-block vertical shrink"
                    style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0 0.5rem 0.75rem 0.5rem"
                    }}
                >
                    <div>
                        <label style={{margin: "3px 0 0"}}>
                            <input
                                style={{position: "relative", top: 3}}
                                className="no-margin"
                                type="checkbox"
                                checked={onlyLiquid}
                                onChange={() => {
                                    SettingsActions.changeViewSetting({
                                        onlyLiquid: !onlyLiquid
                                    });
                                }}
                            />
                            <span style={{paddingLeft: "0.4rem"}}>
                                <Translate content="exchange.show_only_liquid" />
                            </span>
                        </label>
                        <label style={{margin: "3px 0 0"}}>
                            <input
                                style={{position: "relative", top: 3}}
                                className="no-margin"
                                type="checkbox"
                                checked={onlyStars}
                                onChange={() => {
                                    MarketsActions.toggleStars();
                                }}
                            />
                            <span style={{paddingLeft: "0.4rem"}}>
                                <TranslateWithLinks
                                    string="exchange.show_only_star_formatter"
                                    keys={[
                                        {
                                            type: "icon",
                                            value: "fi-star",
                                            className: "gold-star",
                                            arg: "star_icon"
                                        }
                                    ]}
                                />
                            </span>
                        </label>
                        <br />
                    </div>
                    <div className="search-wrapper">
                        <form>
                            <div className="filter inline-block">
                                <SearchInput
                                    style={{
                                        fontSize: "0.9rem",
                                        height: "inherit",
                                        position: "relative"
                                    }}
                                    className="no-margin market-filter-input"
                                    value={myMarketFilter}
                                    onChange={handleSearchUpdate}
                                />
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <div
                    style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.75rem 0.5rem"
                    }}
                >
                    <table>
                        <tbody>
                            <tr style={{width: "100%"}}>
                                <td>
                                    <AssetSelector
                                        onAssetSelect={onFoundBaseAsset}
                                        assets={defaultBases}
                                        onChange={onInputBaseAsset}
                                        asset={findBaseInput}
                                        assetInput={findBaseInput}
                                        tabIndex={1}
                                        style={{
                                            width: "100%",
                                            paddingBottom: "1.5rem"
                                        }}
                                        onFound={onFoundBaseAsset}
                                        label="exchange.quote"
                                        noLabel
                                        inputStyle={{fontSize: "0.9rem"}}
                                    />
                                </td>
                            </tr>
                            <tr style={{width: "100%"}}>
                                <td>
                                    <label>
                                        <Translate content="account.user_issued_assets.name" />
                                        :
                                    </label>
                                    <input
                                        style={{
                                            fontSize: "0.9rem",
                                            position: "relative",
                                            top: 1
                                        }}
                                        type="text"
                                        value={inputValue}
                                        onChange={e => onInputName(true, e)}
                                        placeholder={counterpart.translate(
                                            "exchange.search"
                                        )}
                                        maxLength={16}
                                        tabIndex={2}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <ul className="mymarkets-tabs" style={{marginBottom: 0}}>
                {/* Quote edit tab */}
                {myMarketTab && (
                    <li
                        key="quote_edit"
                        style={{textTransform: "uppercase"}}
                        onClick={showQuoteModal}
                        className="mymarkets-tab"
                    >
                        &nbsp;+&nbsp;
                    </li>
                )}
                {!myMarketTab && !inputValue
                    ? null
                    : preferredBases.map((base: any, index: number) => {
                          if (!base) return null;
                          return (
                              <li
                                  key={base}
                                  onClick={() => toggleActiveMarketTab(index)}
                                  className={cnames("mymarkets-tab", {
                                      active: effectiveActiveMarketTab === index
                                  })}
                              >
                                  {base}
                              </li>
                          );
                      })}
                {myMarketTab && hasOthers ? (
                    <li
                        key={"others"}
                        style={{textTransform: "uppercase"}}
                        onClick={() =>
                            toggleActiveMarketTab(preferredBases.size + 1)
                        }
                        className={cnames("mymarkets-tab", {
                            active:
                                effectiveActiveMarketTab ===
                                preferredBases.size + 1
                        })}
                    >
                        <Translate content="exchange.others" />
                    </li>
                ) : null}
            </ul>

            <div
                style={listStyle}
                className="table-container grid-block vertical mymarkets-list"
                ref={favoritesRef}
            >
                {assetsLoading ? (
                    <div
                        style={{
                            position: "absolute",
                            paddingTop: "3rem",
                            textAlign: "center",
                            width: "100%"
                        }}
                    >
                        <LoadingIndicator type="three-bounce" />
                    </div>
                ) : null}
                {preferredBases
                    .filter((a: any) => {
                        return a === preferredBases.get(effectiveActiveMarketTab);
                    })
                    .map((base: any, index: number) => {
                        return (
                            <MarketGroup
                                userMarkets={userMarkets}
                                defaultMarkets={defaultMarkets}
                                index={index}
                                key={base}
                                current={current}
                                starredMarkets={starredMarkets}
                                marketStats={marketStats}
                                viewSettings={viewSettings}
                                columns={
                                    myMarketTab
                                        ? columns
                                        : findColumns || columns
                                }
                                markets={baseGroups[base]}
                                base={base}
                                findMarketTab={!myMarketTab}
                                onlyLiquid={onlyLiquid && myMarketTab}
                            />
                        );
                    })}
                {effectiveActiveMarketTab === preferredBases.size + 1 &&
                myMarketTab &&
                hasOthers ? (
                    <MarketGroup
                        userMarkets={userMarkets}
                        index={preferredBases.size}
                        current={current}
                        starredMarkets={starredMarkets}
                        marketStats={marketStats}
                        viewSettings={viewSettings}
                        columns={columns}
                        markets={otherMarkets}
                        base="others"
                        findMarketTab={!myMarketTab}
                    />
                ) : null}
            </div>
            <QuoteSelectionModal
                visible={isQuoteModalVisible}
                hideModal={hideQuoteModal}
                showModal={showQuoteModal}
                quotes={preferredBasesProp}
            />
        </div>
    );
}

const MyMarketsDebounced: any = debounceRender(MyMarketsInner, 50, {
    leading: false
});

export default function MyMarkets(props: any) {
    const settingsState = useAltStore<any>(SettingsStore as any);
    const marketsState = useAltStore<any>(MarketsStore as any);
    const assetState = useAltStore<any>(AssetStore as any);

    return (
        <MyMarketsDebounced
            {...props}
            starredMarkets={settingsState.starredMarkets}
            onlyLiquid={settingsState.viewSettings.get("onlyLiquid", true)}
            defaultMarkets={settingsState.defaultMarkets}
            viewSettings={settingsState.viewSettings}
            preferredBases={settingsState.preferredBases}
            marketStats={marketsState.allMarketStats}
            userMarkets={settingsState.userMarkets}
            searchAssets={assetState.assets}
            onlyStars={marketsState.onlyStars}
            assetsLoading={assetState.assetsLoading}
        />
    );
}
