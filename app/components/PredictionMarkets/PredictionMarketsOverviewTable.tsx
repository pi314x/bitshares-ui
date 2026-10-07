// TypeScript/functional-component port of the legacy
// PredictionMarketsOverviewTable.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive check per AGENTS.md: grepped this file for
// `Actions\.`/`Api\.`/`WalletApi`/`WalletDb`/`ApplicationApi`/
// `add_type_operation`/`process_transaction`. The only `Actions.` hit is
// `MarketsActions.getTicker(...)`, a read-only market-ticker lookup (not
// a transaction-submitting call) already used to populate the
// "market confidence"/"market predicted likelihood" columns. The
// "resolve"/"details" action buttons just call the `onMarketAction` prop
// callback with `{market, action}` - they never build, sign or submit a
// transaction themselves (the real caller, `PredictionMarkets.jsx`'s
// `onMarketAction`, does that - out of scope, not touched by this
// batch). No wallet-unlock/key/password/brainkey handling anywhere in
// this file.
//
// Dropped as confirmed dead (grepped the whole file for `onRowAction` -
// only its own definition matches, never read anywhere in `render()` or
// passed to any child): the `onRowAction` class-field arrow function.
//
// `componentDidUpdate(prevProps)` (only body: if
// `prevProps.predictionMarkets.length !== this.props.predictionMarkets
// .length`, fetch tickers for any not-yet-loaded market) becomes a
// mount-skipping `useEffect` keyed on `predictionMarkets.length` - per
// this migration's established pattern, the dependency array already
// only re-fires on an actual length change, reproducing the original's
// comparison for free; the `isMountRef` guard replicates
// `componentDidUpdate` never firing on the initial mount (so, exactly as
// in the original, no ticker is fetched for the initially-rendered set
// of markets until `predictionMarkets.length` changes at least once -
// preserved verbatim, not "fixed").
//
// Preserved verbatim as a real, load-bearing bug (not "fixed"): the
// "already loaded?" guard is `!(market.asset.id in
// Object.keys(this.tickersLoaded))` - `in` on an *array* (what
// `Object.keys()` returns) tests numeric array indices, not values, so
// this is true for basically every real asset id string (e.g.
// `"1.3.100"` is never a valid index of a short keys array) - i.e. the
// "already loaded" guard never actually skips a re-fetch. Also preserved
// verbatim: the `.then()` handler's `Object.assign(this.tickersLoaded,
// this.state.ticker)` mutates `this.tickersLoaded` *in place* (it's the
// first/target argument) and returns that same object, which is then
// also handed to `setState({ticker})` - so `this.tickersLoaded` and
// `this.state.ticker` end up aliased to the exact same mutable object
// after the first ticker resolves. Replicated with a `tickersLoadedRef`
// (`useRef`, mirroring the original's plain instance field) and a
// `tickerRef` mirror of the `ticker` state (read inside the `.then()`
// so it sees the current state at resolution time, not a stale value
// captured when the effect first ran - same "read current state in an
// async callback" pattern used elsewhere in this migration), passing
// `tickersLoadedRef.current` as the mutation target to `Object.assign`
// exactly as the original passed `this.tickersLoaded`.
//
// `getHeader()` doesn't read any instance state beyond `currentAccount`/
// `ticker`/the `onMarketAction` callback, so it's ported as a plain
// function taking those as parameters (same treatment as
// `PredictionMarketDetailsTable.tsx`'s `getHeader`), rather than a
// closure recreated inline in the component body.
//
// `currentAccount` (`ChainTypes.ChainAccount.isRequired` in the
// original) is, like `PredictionMarketDetailsTable.tsx`, never resolved
// by a `BindToChainState` wrap in this file - the real caller
// (`PredictionMarkets.jsx`, wrapped in `bindToCurrentAccount`) already
// passes an already-resolved `Immutable.Map` account object, so it's
// typed loosely as `any`.
//
// The `debounceRender(PredictionMarketsOverviewTable, 150, {leading:
// false})` wrap at the bottom of the original is kept, applied to the
// ported function component, matching this migration's established
// `debounceRender` treatment (e.g. `Utility/FeeAssetSelector.tsx`,
// `Account/AccountPortfolioList.tsx`).
import * as React from "react";
import counterpart from "counterpart";
import LinkToAssetById from "../Utility/LinkToAssetById";
import LinkToAccountById from "../Utility/LinkToAccountById";
import {Button} from "../../design-system/Button";
import {ChainStore} from "bitsharesjs";
import PaginatedList from "components/Utility/PaginatedList";
import MarketsActions from "../../actions/MarketsActions";
import debounceRender from "react-debounce-render";
import FormattedAsset from "../Utility/FormattedAsset";
import utils from "common/utils";

import "./prediction.scss";

function getHeader(
    currentAccount: any,
    ticker: any,
    onMarketAction: (dataItem: any, option?: any) => void
): any[] {
    const isOwnedByCurrent = (id: any) => currentAccount.get("id") === id;
    return [
        {
            title: counterpart.translate("account.asset"),
            dataIndex: "asset_id",
            align: "left",
            defaultSortOrder: "ascend",
            sorter: (a: any, b: any) => {
                return a.symbol > b.symbol ? 1 : a.symbol < b.symbol ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <LinkToAssetById asset={item} />
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.overview.issuer"),
            dataIndex: "issuer",
            align: "left",
            sorter: (a: any, b: any) => {
                const a_issuer = (ChainStore as any).getAccount(a.issuer);
                const b_issuer = (ChainStore as any).getAccount(b.issuer);
                let a_name = null,
                    b_name = null;
                if (a_issuer && b_issuer) {
                    a_name = a_issuer.get("name");
                    b_name = b_issuer.get("name");
                }
                return a_name > b_name ? 1 : a_name < b_name ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <LinkToAccountById account={item} />
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.overview.prediction"),
            dataIndex: "condition",
            align: "left",
            sorter: (a: any, b: any) => {
                if (!a.condition || a.condition === "") return -1;
                if (!b.condition || b.condition === "") return 1;
                return a.condition.localeCompare(b.condition);
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "normal"
                        }}
                    >
                        <span>{item}</span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate(
                "prediction.overview.market_confidence"
            ),
            dataIndex: "marketConfidence",
            align: "left",
            sorter: (a: any, b: any) => {
                return a.marketConfidence > b.marketConfidence
                    ? 1
                    : a.marketConfidence < b.marketConfidence
                        ? -1
                        : 0;
            },
            render: (item: any, row: any) => {
                const rowTicker = Object.assign({}, ticker[row.asset_id]);

                if (ticker[row.asset_id]) {
                    if (
                        !rowTicker.quote_volume ||
                        rowTicker.quote_volume === "0" ||
                        rowTicker.quote_volume === "1" ||
                        rowTicker.quote_volume === "NaN" ||
                        rowTicker.quote_volume === "-NaN"
                    ) {
                        rowTicker.quote_volume = 0;
                    } else {
                        rowTicker.quote_volume = (utils as any).convert_typed_to_satoshi(
                            parseFloat(rowTicker.quote_volume),
                            (ChainStore as any).getAsset(
                                row.short_backing_asset
                            )
                        );
                    }
                    if (
                        !rowTicker.percent_change ||
                        rowTicker.percent_change === "NaN" ||
                        rowTicker.percent_change === "-NaN"
                    ) {
                        rowTicker.percent_change = "-";
                    } else {
                        if (rowTicker.percent_change == "0") {
                            rowTicker.percent_change = "0%";
                        } else {
                            rowTicker.percent_change =
                                (parseFloat(rowTicker.latest) > 0
                                    ? "+"
                                    : "-") +
                                rowTicker.percent_change +
                                "%";
                        }
                    }
                    return (
                        <span>
                            {counterpart.translate("exchange.vol_short")}
                            &nbsp;
                            <FormattedAsset
                                amount={rowTicker.quote_volume}
                                asset={row.short_backing_asset}
                            />
                            &nbsp;
                            {/*({ticker.percent_change})&nbsp;*/}
                        </span>
                    );
                } else {
                    return null;
                }
            }
        },
        {
            title: counterpart.translate(
                "prediction.overview.market_predicated_likelihood"
            ),
            dataIndex: "marketLikelihood",
            align: "left",
            sorter: (a: any, b: any) => {
                return a.marketLikelihood > b.marketLikelihood
                    ? 1
                    : a.marketLikelihood < b.marketLikelihood
                        ? -1
                        : 0;
            },
            render: (item: any, row: any) => {
                const rowTicker = Object.assign({}, ticker[row.asset_id]);

                if (ticker[row.asset_id]) {
                    if (
                        !rowTicker.latest ||
                        rowTicker.latest === "0" ||
                        rowTicker.latest === "1" ||
                        rowTicker.latest === "NaN" ||
                        rowTicker.latest === "-NaN"
                    ) {
                        rowTicker.latest = "-";
                    } else {
                        rowTicker.latest =
                            (parseFloat(rowTicker.latest) * 100).toPrecision(
                                3
                            ) + "%";
                    }
                    if (
                        !rowTicker.highest_bid ||
                        rowTicker.highest_bid === "0" ||
                        rowTicker.highest_bid === "1" ||
                        rowTicker.highest_bid === "NaN" ||
                        rowTicker.highest_bid === "-NaN"
                    ) {
                        rowTicker.highest_bid = "-";
                    } else {
                        rowTicker.highest_bid =
                            (
                                parseFloat(rowTicker.highest_bid) * 100
                            ).toPrecision(3) + "%";
                    }
                    if (
                        !rowTicker.lowest_ask ||
                        rowTicker.lowest_ask === "0" ||
                        rowTicker.lowest_ask === "1" ||
                        rowTicker.lowest_ask === "NaN" ||
                        rowTicker.lowest_ask === "-NaN"
                    ) {
                        rowTicker.lowest_ask = "-";
                    } else {
                        rowTicker.lowest_ask =
                            (
                                parseFloat(rowTicker.lowest_ask) * 100
                            ).toPrecision(3) + "%";
                    }
                    return rowTicker.latest !== "-" ? (
                        <React.Fragment>
                            <span>
                                {rowTicker.latest}
                                &nbsp;
                            </span>
                            <span className="supsub">
                                <sup className="superscript">
                                    {rowTicker.highest_bid}
                                </sup>
                                <sub className="subscript">
                                    {rowTicker.lowest_ask}
                                </sub>
                            </span>
                            &nbsp;&nbsp;&nbsp;
                        </React.Fragment>
                    ) : (
                        "-"
                    );
                } else {
                    return null;
                }
            }
        },
        {
            title: counterpart.translate("prediction.overview.description"),
            dataIndex: "description",
            align: "left",
            sorter: (a: any, b: any) => {
                if (!a.description || a.description === "") return -1;
                if (!b.description || b.description === "") return 1;
                return a.description.localeCompare(b.description);
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "normal"
                        }}
                    >
                        <span>{item}</span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.overview.expiry"),
            dataIndex: "expiry",
            align: "left",
            sorter: (a: any, b: any) => {
                if (!a.expiry || a.expiry === "") return -1;
                if (!b.expiry || b.expiry === "") return 1;
                return a.expiry.localeCompare(b.expiry);
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "normal"
                        }}
                    >
                        <span>{item}</span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.overview.action"),
            align: "center",
            render: (dataItem: any) => {
                return (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center"
                        }}
                    >
                        {isOwnedByCurrent(dataItem.issuer) ? (
                            <Button
                                style={{width: "170px"}}
                                className="align-middle"
                                onClick={() =>
                                    onMarketAction(dataItem, "resolve")
                                }
                            >
                                {counterpart.translate(
                                    "prediction.overview.resolve"
                                )}
                            </Button>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center"
                                }}
                            >
                                <Button
                                    style={{marginRight: "5px"}}
                                    className="align-middle"
                                    onClick={() =>
                                        onMarketAction(dataItem, "yes")
                                    }
                                >
                                    Details
                                </Button>
                                {/*<Button*/}
                                {/*style={{marginLeft: "5px"}}*/}
                                {/*className="align-middle"*/}
                                {/*onClick={() =>*/}
                                {/*this.onMarketAction(dataItem, "no")*/}
                                {/*}*/}
                                {/*>*/}
                                {/*{counterpart.translate(*/}
                                {/*"prediction.overview.no"*/}
                                {/*)}*/}
                                {/*</Button>*/}
                            </div>
                        )}
                    </div>
                );
            }
        }
    ];
}

interface PredictionMarketsOverviewTableProps {
    predictionMarkets?: any[];
    onMarketAction: (arg: {market: any; action: any}) => void;
    currentAccount: any;
    selectedPredictionMarket?: any;
    loading?: boolean;
}

function PredictionMarketsOverviewTable({
    predictionMarkets = [],
    onMarketAction: onMarketActionProp,
    currentAccount,
    selectedPredictionMarket,
    loading
}: PredictionMarketsOverviewTableProps) {
    const [ticker, setTicker] = React.useState<any>({});
    const tickerRef = React.useRef(ticker);
    tickerRef.current = ticker;
    const tickersLoadedRef = React.useRef<any>({});

    const onMarketAction = (dataItem: any, option: any = "yes") => {
        onMarketActionProp({
            market: dataItem,
            action: option
        });
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        predictionMarkets.forEach(market => {
            if (
                !(
                    market.asset.id in
                    Object.keys(tickersLoadedRef.current)
                )
            ) {
                tickersLoadedRef.current[market.asset.id] = {};
                MarketsActions.getTicker(
                    market.short_backing_asset,
                    market.asset.id
                )
                    .then((result: any) => {
                        const newTicker = Object.assign(
                            tickersLoadedRef.current,
                            tickerRef.current
                        );
                        newTicker[market.asset.id] = result;
                        tickersLoadedRef.current[market.asset.id] = result;
                        setTicker(newTicker);
                    })
                    .catch((err: any) => console.error(err));
            }
        });
    }, [predictionMarkets.length]);

    const decideRowClassName = () => {
        return selectedPredictionMarket ? "selected-row" : "";
    };

    const header = getHeader(currentAccount, ticker, onMarketAction);

    let filteredMarkets: any[] = [];

    if (selectedPredictionMarket) {
        filteredMarkets = [selectedPredictionMarket];
    } else {
        if (predictionMarkets) {
            filteredMarkets = predictionMarkets;
            let i = 0;
            filteredMarkets = filteredMarkets.map(item => ({
                ...item,
                key: `${item.asset_id}${i++}`
            }));
        }
    }

    const rowSelection = {
        type: selectedPredictionMarket ? undefined : "radio",
        hideDefaultSelections: true,
        // Uncomment the following line to show translated text as a cancellable column header instead of checkbox
        //columnTitle: counterpart.translate("wallet.cancel")
        onChange: (selectedRowKeys: any, selectedRows: any[]) => {
            if (selectedRows.length > 0) {
                onMarketAction(selectedRows[0], null);
            } else {
                onMarketAction(null, null);
            }
        },
        // Required in order resetSelected to work
        selectedRowKeys: selectedPredictionMarket
            ? [selectedPredictionMarket.key]
            : []
    };
    return (
        <PaginatedList
            rowSelection={rowSelection}
            rows={filteredMarkets}
            header={header}
            pageSize={10}
            rowClassName={decideRowClassName}
            loading={loading}
            totalLabel="utility.total_x_assets"
        />
    );
}

const PredictionMarketsOverviewTableDebounced: any = debounceRender(
    PredictionMarketsOverviewTable,
    150,
    {leading: false}
);

export default PredictionMarketsOverviewTableDebounced;
