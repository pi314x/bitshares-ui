// TypeScript/functional-component port of the legacy MarketsTable.jsx
// (Dashboard/ batch 1, docs/UI_MIGRATION_PLAN.md). Renders the sortable
// market list used by `Dashboard/Markets.jsx`'s `StarredMarkets`,
// `FeaturedMarkets` and `TopMarkets` (grep-confirmed its only 3 callers,
// all in that still-`.jsx` file, out of this batch's scope per the task).
//
// Structural changes:
// - The original's `connect(MarketsTable, {listenTo, getProps})` is
//   replaced by a Container+Core split (`MarketsTableContainer` calling
//   `useAltStore` once per store, `MarketsTableCore` doing everything
//   else), this migration's established multi-store pattern. Per
//   alt-react's own `connect` (`<Component {...this.props}
//   {...this.getNextProps()} />`), store-derived props always won over
//   same-named caller-passed props - reproduced by spreading the
//   container's own `props` first and the store-derived values after.
//   `marketDirections` (destructured from `SettingsStore.getState()` in
//   the original `getProps`) is dropped: grep-confirmed it is never read
//   anywhere in this file (`this.props.marketDirections` never appears),
//   so it was a fully dead injected prop.
//
// - `UNSAFE_componentWillMount` (`this.update(); ChainStore.subscribe
//   (this.update);`) and `componentWillUnmount`
//   (`ChainStore.unsubscribe(this.update)`) become a mount-only
//   `useEffect` that calls `update()` once and subscribes/unsubscribes an
//   equivalent handler.
// - `UNSAFE_componentWillReceiveProps(nextProps)` (`this.update
//   (nextProps)`) becomes a mount-skip `useEffect` (the established
//   `isMountRef` guard) keyed on every field `update()` actually reads
//   off its props argument (`markets`, `hiddenMarkets`, `isFavorite`,
//   `allMarketStats`, `starredMarkets`, `forceDirection`) - the original
//   ran on literally every parent re-render regardless of whether these
//   changed, but since `update()`'s only observable effect
//   (`this.setState({showFlip, markets})`) is a pure function of exactly
//   those fields, an effect keyed on them produces the same final state
//   with less redundant work (same treatment `Tabs.tsx` and others in
//   this migration give an unconditional `componentWillReceiveProps`).
//
// - Preserved verbatim (not "fixed"), a subtle prop-timing bug in the
//   original `update(nextProps)`: every field of each computed market row
//   is derived from the local `props` variable (`nextProps || this.props`,
//   i.e. the *new*, incoming props when called from
//   `UNSAFE_componentWillReceiveProps`) - **except** `isStarred`, which
//   reads `this.props.starredMarkets` directly, i.e. the component's
//   *old*, not-yet-updated props (`this.props` is only reassigned by React
//   right before `render()`, after `componentWillReceiveProps` returns).
//   So whenever `starredMarkets` itself is what changed, `row.isStarred`
//   lags one update behind every other field for that single pass. This
//   is reproduced with a `prevStarredMarketsRef` that mirrors exactly what
//   `this.props.starredMarkets` would have held at that point: it is only
//   advanced to the new value *after* `update()` runs, and is left
//   untouched (still the previous render's value) on the very call that
//   observes the change. On the mount/`ChainStore`-subscription code path
//   `nextProps` was always `null` in the original, so `props` and
//   `this.props` were identical there - reproduced by passing the same
//   current-props snapshot (via a plain `propsRef` mirror, this
//   migration's established pattern for reading current-but-not-a-
//   dependency props from inside a callback) for both parameters on that
//   path.
// - Preserved verbatim (not "fixed"): `sort`'s inner `convert` helper
//   reassigns its `price` parameter from a `string` to a `number` once it
//   sees a `"k"` suffix (`price = price.replace(/k/g, "") * 1000`), then
//   immediately calls `.includes("M")` on that now-numeric value - which
//   throws (`TypeError`, numbers have no `.includes`) for any price string
//   containing `"k"`. This is reachable (`sortFunctions.priceValue`, wired
//   up as the "Price" column's `sorter`) whenever a displayed price is
//   large enough for `utils.price_text` to render it with a `"k"` suffix
//   and the user sorts that column. Left exactly as broken as the
//   original; `convert`'s parameter is typed `any` (a narrow, deliberate
//   TypeScript-forced adjustment - the reassignment doesn't type-check
//   otherwise) rather than fixed into working code.
// - Preserved verbatim (not "fixed"): `sort`'s `aPrice === null`/
//   `bPrice === null` branches are dead (`convert` never actually returns
//   `null`) - transcribed as-is. `_onError`'s `imgName` parameter, never
//   read in its body in the original, is dropped here (along with the
//   unused trailing `index` parameters on two `getHeader()` column
//   `render` callbacks) purely to satisfy `@typescript-eslint/no-unused-
//   vars`/`args: "after-used"` - a mechanical, non-behavior-changing
//   trim (nothing ever read these), not an exception to the
//   bug-preservation rule above.
// - Preserved verbatim (not "fixed"): `update()` only calls `setState`
//   (here, `mergeState`) when `props.markets && props.markets.size > 0` -
//   if a caller passes an empty/falsy `markets` prop (e.g.
//   `Markets.jsx`'s `TopMarkets`: `<MarketsTable markets={[]} />`, whose
//   plain array has no `.size`), `state.markets`/`state.showFlip` are left
//   exactly as they were (the initial `[]`/`false`, or whatever the last
//   successful update computed) rather than being cleared.
//
// Dead code dropped (grep-confirmed no call site anywhere in this file):
// `_setInterval`/`_clearInterval` (and the `statsChecked`/`statsInterval`
// instance fields they touched) were never invoked from any lifecycle
// method or event handler, and additionally referenced `MarketsActions`,
// which this file never imports - i.e. calling either would already have
// thrown `ReferenceError` in the original. Dropped rather than
// transcribed into working code, since AGENTS.md's bug-preservation
// convention only asks to preserve *reachable* behavior; this method was
// unreachable dead weight, not behavior any caller could observe.
//
// Not security-sensitive per AGENTS.md: this file only renders/sorts
// market listing rows and toggles UI-only settings (star/hide/flip a
// market via `SettingsActions`) - no wallet unlock, key handling, or
// transaction signing anywhere in it.
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import Translate from "react-translate-component";
import cnames from "classnames";
import MarketsStore from "stores/MarketsStore";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import utils from "common/utils";
import PaginatedList from "../Utility/PaginatedList";
import {Input, Tooltip} from "bitshares-ui-style-guide";
import Icon from "../Icon/Icon";
import AssetName from "../Utility/AssetName";
import {Link} from "react-router-dom";
import {Icon as AntIcon} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

// `@types/react-router-dom`'s `Link` return type isn't assignable to
// `JSX.Element` under this repo's `@types/react` version (a `key: Key |
// null` vs `key: string | null` mismatch) - cast to a generic component
// type, matching this migration's established handling of the same
// friction (see `Utility/MarketLink.tsx`).
const LinkComponent = Link as React.ComponentType<any>;

interface MarketsTableProps {
    markets?: any;
    forceDirection?: boolean;
    isFavorite?: boolean;
    handleHide?: (row: any, status: boolean) => void;
    handleFlip?: (row: any, status: boolean) => void;
    onlyLiquid?: boolean;
    [key: string]: any;
}

interface MarketsTableCoreProps extends MarketsTableProps {
    hiddenMarkets: any;
    allMarketStats: any;
    starredMarkets: any;
}

interface MarketsTableState {
    filter: string;
    showFlip: boolean;
    showHidden: boolean;
    markets: any[];
}

function MarketsTableCore(props: MarketsTableCoreProps) {
    const [state, setState] = React.useState<MarketsTableState>({
        filter: "",
        showFlip: false,
        showHidden: false,
        markets: []
    });
    const mergeState = (patch: Partial<MarketsTableState>) =>
        setState(prev => ({...prev, ...patch}));

    const [imgError, setImgError] = React.useState(false);

    const propsRef = React.useRef(props);
    propsRef.current = props;

    const update = React.useCallback(
        (p: MarketsTableCoreProps, starredMarketsForIsStarred: any) => {
            const showFlip = p.forceDirection;

            if (p.markets && p.markets.size > 0) {
                const markets = p.markets
                    .valueSeq()
                    .toArray()
                    .map((market: any) => {
                        const quote = ChainStore.getAsset(market.quote);
                        const base = ChainStore.getAsset(market.base);
                        if (!base || !quote) return null;
                        const marketName = `${market.base}_${market.quote}`;

                        return {
                            key: marketName,
                            inverted: undefined,
                            quote: market.quote,
                            base: market.base,
                            basePrecision: base.get("precision"),
                            isHidden: p.hiddenMarkets.includes(marketName),
                            isFavorite: p.isFavorite,
                            marketStats: p.allMarketStats.get(marketName, {}),
                            isStarred: starredMarketsForIsStarred.has(
                                marketName
                            )
                        };
                    })
                    .filter((a: any) => a !== null);
                mergeState({showFlip, markets});
            }
        },
        []
    );

    // UNSAFE_componentWillMount + ChainStore.subscribe/componentWillUnmount
    React.useEffect(() => {
        update(propsRef.current, propsRef.current.starredMarkets);

        const onChainChange = () =>
            update(propsRef.current, propsRef.current.starredMarkets);
        ChainStore.subscribe(onChainChange);
        return () => ChainStore.unsubscribe(onChainChange);
    }, []);

    // UNSAFE_componentWillReceiveProps(nextProps) -> this.update(nextProps)
    const isMountRef = React.useRef(true);
    const prevStarredMarketsRef = React.useRef(props.starredMarkets);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevStarredMarketsRef.current = props.starredMarkets;
            return;
        }
        update(props, prevStarredMarketsRef.current);
        prevStarredMarketsRef.current = props.starredMarkets;
    }, [
        props.markets,
        props.hiddenMarkets,
        props.isFavorite,
        props.allMarketStats,
        props.starredMarkets,
        props.forceDirection
    ]);

    function toggleShowHidden(val: boolean) {
        if (state.showHidden === val) return;
        mergeState({showHidden: val});
    }

    function handleFilterInput(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();
        mergeState({filter: e.target.value.toUpperCase()});
    }

    function handleHide(row: any, status: boolean) {
        if (props.handleHide) {
            return props.handleHide(row, status);
        }
        SettingsActions.hideMarket(row.key, status);
    }

    function handleFlip(row: any, status: boolean) {
        if (props.handleFlip) {
            return props.handleFlip(row, status);
        }
        SettingsActions.changeMarketDirection({
            [row.key]: status
        });
    }

    function sort(aPriceStr: string, bPriceStr: string) {
        const convert = (price: any) => {
            price = price.replace(/\,/g, "");
            if (price.includes("k")) price = price.replace(/k/g, "") * 1000;
            if (price.includes("M"))
                price = price.replace(/M/g, "") * 1000 * 1000;
            return price;
        };
        const aPrice = convert(aPriceStr);
        const bPrice = convert(bPriceStr);

        if (aPrice === null && bPrice !== null) {
            return 1;
        } else if (aPrice !== null && bPrice === null) {
            return -1;
        } else {
            return aPrice - bPrice;
        }
    }

    const sortFunctions = {
        alphabetic: (a: any, b: any, force?: boolean) => {
            if (a.key > b.key) return force ? 1 : -1;
            if (a.key < b.key) return force ? -1 : 1;
            return 0;
        },
        priceValue: (a: any, b: any) => {
            const aPrice = a.price.props.children;
            const bPrice = b.price.props.children;
            if (aPrice && bPrice) {
                return sort(aPrice, bPrice);
            } else {
                return sortFunctions.alphabetic(a, b, true);
            }
        },
        volumeValue: (a: any, b: any) => {
            const aPrice = a.volume || 0;
            const bPrice = b.volume || 0;
            let compared = 0;
            if (aPrice && bPrice) {
                compared = aPrice - bPrice;
            }
            if (compared == 0) {
                return sortFunctions.alphabetic(a, b, true);
            } else {
                return compared;
            }
        },
        changeValue: (a: any, b: any) => {
            const aValue = parseFloat(a.hour_24);
            const bValue = parseFloat(b.hour_24);
            let compared = 0;
            if (aValue && bValue && !isNaN(aValue) && !isNaN(bValue)) {
                compared = aValue - bValue;
            }
            if (compared == 0) {
                return sortFunctions.alphabetic(a, b, true);
            } else {
                return compared;
            }
        }
    };

    function getHeader(): any[] {
        const {showFlip, showHidden} = state;
        return [
            {
                dataIndex: "star",
                align: "right",
                width: "75px",
                render: (item: any) => {
                    return (
                        <span
                            style={{whiteSpace: "nowrap", cursor: "pointer"}}
                        >
                            {item}
                        </span>
                    );
                }
            },
            {
                title: <Translate content="account.asset" />,
                dataIndex: "asset",
                render: (item: any) => {
                    return (
                        <span
                            style={{
                                whiteSpace: "nowrap"
                            }}
                        >
                            {item}
                        </span>
                    );
                }
            },
            props.isFavorite
                ? {}
                : {
                      title: (
                          <Translate content="account.user_issued_assets.quote_name" />
                      ),
                      dataIndex: "quote_name",
                      align: "right",
                      render: (item: any) => {
                          return (
                              <span style={{whiteSpace: "nowrap"}}>
                                  {item}
                              </span>
                          );
                      }
                  },
            {
                title: <Translate content="exchange.price" />,
                dataIndex: "price",
                align: "right",
                sorter: sortFunctions.priceValue,
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                title: <Translate content="account.hour_24_short" />,
                dataIndex: "hour_24",
                align: "right",
                sorter: sortFunctions.changeValue,
                render: (text: any, record: any) => {
                    const changeClass =
                        parseFloat(record.hour_24) > 0
                            ? "change-up"
                            : parseFloat(record.hour_24) < 0
                            ? "change-down"
                            : "";
                    return (
                        <span
                            style={{whiteSpace: "nowrap", textAlign: "right"}}
                            className={changeClass}
                        >
                            {record.hour_24}%
                        </span>
                    );
                }
            },
            {
                title: <Translate content="exchange.volume" />,
                dataIndex: "volume",
                align: "right",
                sorter: sortFunctions.volumeValue,
                defaultSortOrder: "descend",
                render: (text: any, record: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            {utils.format_volume(
                                record.volume,
                                record.basePrecision
                            )}
                        </span>
                    );
                }
            },
            showFlip
                ? {
                      title: <Translate content="exchange.flip" />,
                      dataIndex: "flip",
                      render: (item: any) => {
                          return (
                              <span
                                  className="column-hide-small"
                                  style={{whiteSpace: "nowrap"}}
                              >
                                  {item}
                              </span>
                          );
                      }
                  }
                : {},
            {
                title: (
                    <Translate
                        content={
                            !showHidden ? "exchange.hide" : "account.perm.show"
                        }
                    />
                ),
                dataIndex: "hide",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            }
        ];
    }

    function onError() {
        if (!imgError) {
            setImgError(true);
        }
    }

    function toggleFavoriteMarket(quote: string, base: string) {
        const marketID = `${quote}_${base}`;
        if (!props.starredMarkets.has(marketID)) {
            SettingsActions.addStarMarket(quote, base);
        } else {
            SettingsActions.removeStarMarket(quote, base);
        }
    }

    function getTableData(row: any) {
        const {
            base,
            quote,
            marketStats,
            isHidden,
            inverted,
            basePrecision
        } = row;

        function getImageName(symbol: string) {
            if (symbol === "OPEN.BTC" || symbol === "GDEX.BTC") return symbol;
            if (symbol.startsWith("RUDEX.")) return symbol;

            const imgName = symbol.split(".");
            return imgName.length === 2 ? imgName[1] : imgName[0];
        }
        const imgName = getImageName(quote);

        const marketID = `${quote}_${base}`;

        const starClass = props.starredMarkets.has(marketID)
            ? "gold-star"
            : "grey-star";

        const imageSrc = imgError
            ? `${__BASE_URL__}asset-symbols/${imgName.toLowerCase()}.png`
            : `${__BASE_URL__}asset-symbols/bts.png`;

        return {
            key: marketID,
            star: (
                <div onClick={() => toggleFavoriteMarket(quote, base)}>
                    <Icon
                        style={{cursor: "pointer"}}
                        className={starClass}
                        name="fi-star"
                        title="icons.fi_star.market"
                    />
                </div>
            ),
            asset: (
                <LinkComponent to={`/market/${quote}_${base}`}>
                    <img
                        className="column-hide-small"
                        onError={() => onError()}
                        style={{maxWidth: 20, marginRight: 10}}
                        src={imageSrc}
                    />
                    <AssetName dataPlace="top" name={quote} />
                    &nbsp;
                    {props.isFavorite ? (
                        <span>
                            :&nbsp;
                            <AssetName dataPlace="top" name={base} />
                        </span>
                    ) : null}
                </LinkComponent>
            ),
            quote_name: props.isFavorite ? null : (
                <span style={{textAlign: "right"}}>
                    <AssetName noTip name={base} />
                </span>
            ),
            price: (
                <div
                    className="column-hide-small"
                    style={{textAlign: "right"}}
                >
                    {marketStats && marketStats.price
                        ? utils.price_text(
                              marketStats.price.toReal(true),
                              ChainStore.getAsset(quote),
                              ChainStore.getAsset(base)
                          )
                        : null}
                </div>
            ),
            hour_24:
                !marketStats ||
                !marketStats.change ||
                marketStats.change === "0.00"
                    ? 0
                    : marketStats.change,
            volume:
                !marketStats || !marketStats.volumeQuote
                    ? 0
                    : marketStats.volumeQuote,
            flip:
                inverted === null || !props.isFavorite ? null : (
                    <span className="column-hide-small">
                        <a onClick={() => handleFlip(row, !row.inverted)}>
                            <Icon name="shuffle" title="icons.shuffle" />
                        </a>
                    </span>
                ),
            hide: (
                <Tooltip
                    title={
                        isHidden ? (
                            <Translate content="icons.plus_circle.show_market" />
                        ) : (
                            <Translate content="icons.cross_circle.hide_market" />
                        )
                    }
                    style={{marginRight: 0}}
                    onClick={() => handleHide(row, !row.isHidden)}
                >
                    <Icon
                        name={isHidden ? "plus-circle" : "cross-circle"}
                        title={
                            isHidden
                                ? "icons.plus_circle.show_market"
                                : "icons.cross_circle.hide_market"
                        }
                        className="icon-14px"
                    />
                </Tooltip>
            ),
            basePrecision: basePrecision
        };
    }

    const {markets, showHidden, filter} = state;

    const marketRows = markets
        .filter((m: any) => {
            if (!!filter || m.isStarred) return true;
            if (
                props.onlyLiquid ||
                (m.marketStats && "volumeBase" in m.marketStats)
            ) {
                return !!m.marketStats.volumeBase || false;
            } else {
                return true;
            }
        })
        .map((row: any) => {
            let visible = true;

            if (row.isHidden !== state.showHidden) {
                visible = false;
            } else if (filter) {
                const quoteObject = ChainStore.getAsset(row.quote);
                const baseObject = ChainStore.getAsset(row.base);

                const {isBitAsset: quoteIsBitAsset} = utils.replaceName(
                    quoteObject
                );
                const {isBitAsset: baseIsBitAsset} = utils.replaceName(
                    baseObject
                );

                let quoteSymbol = row.quote;
                let baseSymbol = row.base;

                if (quoteIsBitAsset) {
                    quoteSymbol = "bit" + quoteSymbol;
                }

                if (baseIsBitAsset) {
                    baseSymbol = "bit" + baseSymbol;
                }

                const filterPair = filter.includes(":");

                if (filterPair) {
                    const quoteFilter = filter.split(":")[0].trim();
                    const baseFilter = filter.split(":")[1].trim();

                    visible =
                        quoteSymbol
                            .toLowerCase()
                            .includes(String(quoteFilter).toLowerCase()) &&
                        baseSymbol
                            .toLowerCase()
                            .includes(String(baseFilter).toLowerCase());
                } else {
                    visible =
                        quoteSymbol
                            .toLowerCase()
                            .includes(String(filter).toLowerCase()) ||
                        baseSymbol
                            .toLowerCase()
                            .includes(String(filter).toLowerCase());
                }
            }

            if (!visible) return null;

            return getTableData({...row});
        })
        .filter((r: any) => !!r);

    return (
        <div>
            <div className="header-selector">
                <div className="filter inline-block">
                    <Input
                        type="text"
                        placeholder="Filter..."
                        onChange={handleFilterInput}
                        addonAfter={<AntIcon type="search" />}
                    />
                </div>

                <div
                    className="selector inline-block"
                    style={{position: "relative", top: "6px"}}
                >
                    <div
                        className={cnames("inline-block", {
                            inactive: showHidden
                        })}
                        onClick={() => toggleShowHidden(false)}
                    >
                        <Translate content="account.hide_hidden" />
                    </div>
                    <div
                        className={cnames("inline-block", {
                            inactive: !showHidden
                        })}
                        onClick={() => toggleShowHidden(true)}
                    >
                        <Translate content="account.show_hidden" />
                    </div>
                </div>

                <div style={{paddingTop: "0.5rem"}}>
                    <label style={{margin: "3px 0 0", width: "fit-content"}}>
                        <input
                            style={{position: "relative", top: 3}}
                            className="no-margin"
                            type="checkbox"
                            checked={props.onlyLiquid}
                            onChange={() => {
                                SettingsActions.changeViewSetting({
                                    onlyLiquid: !props.onlyLiquid
                                });
                            }}
                        />
                        <span style={{paddingLeft: "0.4rem"}}>
                            <Translate content="exchange.show_only_liquid" />
                        </span>
                    </label>
                </div>
            </div>
            <PaginatedList
                style={{paddingLeft: 0, paddingRight: 0}}
                className="table dashboard-table table-hover"
                header={getHeader()}
                rows={marketRows.length ? marketRows : []}
                pageSize={20}
                label="utility.total_x_markets"
                leftPadding="1.5rem"
            />
        </div>
    );
}

function MarketsTableContainer(props: MarketsTableProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const marketsState = useAltStore<any>(MarketsStore);

    return (
        <MarketsTableCore
            {...props}
            hiddenMarkets={settingsState.hiddenMarkets}
            allMarketStats={marketsState.allMarketStats}
            starredMarkets={settingsState.starredMarkets}
            onlyLiquid={settingsState.viewSettings.get("onlyLiquid", true)}
        />
    );
}

export default MarketsTableContainer;
