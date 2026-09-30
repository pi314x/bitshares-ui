// TypeScript/functional-component port of the legacy PredictionMarkets.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onResolveMarket` calls
// `AssetActions.assetGlobalSettle(asset, account, price)`, a real
// on-chain transaction. Also dispatches `MarketsActions.cancelLimitOrders`
// (via `onCancelOpinion`) and subscribes/unsubscribes markets (via
// `getMarketOpinions`). None of these log or persist any key/password
// material - transcribed verbatim.
//
// This is the last of the 7 `PredictionMarkets/` files (Phase 8's long
// tail): the 5 "leaf" files it imports (`ResolveModal`,
// `PredictionMarketDetailsTable`, `PredictionMarketsOverviewTable`,
// `CreateMarketModal`, `AddOpinionModal`) were already ported to `.tsx` in
// two prior batches; this file and its sibling `PMAssetsContainer.tsx`
// (which imports this one) were deliberately held back from delegation
// since both import multiple already-ported siblings and needed to be
// finished only once all 5 leaves existed as `.tsx`.
//
// Structural changes:
// - `connect(PredictionMarkets, {listenTo() {return [AssetStore,
//   MarketsStore]}, getProps() {...}})` is replaced by an outer
//   `PredictionMarkets` wrapper that calls `useAltStore` once per store
//   (this migration's established multi-store pattern) and passes the
//   store-derived `assets`/`bucketSize`/`currentGroupOrderLimit`/
//   `marketLimitOrders` into the inner `PredictionMarketsCore` component,
//   spread *after* the props `PredictionMarketsCore` otherwise receives
//   (from `PMAssetsContainer.tsx`: `whitelistedIssuers`,
//   `predictionMarkets`, `loading`, `fetchAllAssets`) - alt-react's
//   `connect` renders `<Component {...this.props} {...this.getNextProps()}
//   />` (store-derived props win), so store-derived `assets` here always
//   overrides whatever `PMAssetsContainer.tsx` itself passed down as
//   `assets` (both ultimately read the same `AssetStore.getState().assets`
//   independently, so this redundant double-subscription is a no-op in
//   practice - preserved, not simplified, matching the original's
//   redundant two-file `connect()` structure). See
//   `Account/AccountPortfolioList.tsx` for the precedent of this exact
//   prop-precedence translation.
// - Wrapped with `bindToCurrentAccount` at its own export, same as the
//   original (`PredictionMarkets = bindToCurrentAccount(PredictionMarkets)`)
//   - independent of, and in addition to, `PMAssetsContainer.tsx`'s own
//   separate `bindToCurrentAccount` wrapping (see that file's header
//   comment for why this double-gating is preserved verbatim).
// - `componentDidUpdate`'s `prevProps.marketLimitOrders !==
//   this.props.marketLimitOrders` guard becomes a mount-skip `useEffect`
//   keyed on `marketLimitOrders` (this migration's established
//   `isMountRef` pattern, since `componentDidUpdate` never fires on
//   mount). `_updateOpinionsList`'s read of `this.state
//   .selectedPredictionMarket` inside that effect uses a `stateRef`
//   mirror (this migration's established pattern for reading
//   current-but-not-a-dependency state inside a callback) rather than
//   adding `selectedPredictionMarket` to the dependency array, matching
//   the original's guard which only reacted to `marketLimitOrders`
//   changing.
// - `getMarketOpinions`'s read of `this.state.subscribedMarket` (to decide
//   whether to unsubscribe a previously-subscribed market first) likewise
//   uses the `stateRef` mirror, since it is an `async` function that may
//   run across multiple ticks.
// - Every other instance method (`onMarketAction`, `onSearch`,
//   `handleUnknownHousesToggleChange`, etc.) reads/writes state
//   synchronously within a single event-handler invocation, exactly like
//   the original's `this.state`/`this.setState` calls in the same
//   handlers - these use the plain closure-captured `state`/`mergeState`
//   (this migration's established pattern), no `stateRef` needed.
// - Two `setState(update, callback)` call sites
//   (`handleUnknownHousesToggleChange`'s `() =>
//   this.props.fetchAllAssets()`, and `onMarketAction`'s row-action branch
//   `() => this.getMarketOpinions(market)`) had callbacks that never
//   actually read the just-committed state (the first calls a prop
//   function with no arguments, the second's `getMarketOpinions` takes
//   `market` as a plain parameter and only reads the *unrelated*
//   `state.subscribedMarket` field) - both are replicated by simply
//   calling the callback's body immediately after the state update,
//   preserving the same observable behavior without React's commit-order
//   guarantee (not needed here, since neither callback body was ever
//   state-dependent).
// - Dead field dropped: `state.loading` (set to `false` in the
//   constructor, never read or updated anywhere else - grepped).
// - Preserved verbatim (not "fixed"): `state.initialOpinion` is read once
//   (`this.state.initialOpinion` passed as `<AddOpinionModal opinion=
//   {...}>`) but never initialized or set anywhere in the file - always
//   `undefined`. Since `AddOpinionModal.tsx`'s own port (batch 2) already
//   confirmed this `opinion` prop is dead (not present in that file's
//   props type at all, dropped there), this always-`undefined` prop
//   assignment is dropped here too rather than kept as dead code that
//   would not even compile (there is nothing left for it to do - the
//   receiving prop no longer exists).
// - Preserved verbatim (not "fixed"): `_filterMarkets`'s search-term
//   matching is genuinely broken - it concatenates `accountName`,
//   `asset.condition`, and `asset.description` (the latter two are not
//   real fields on `asset` at all; the real description/condition text
//   lives at `asset.forPredictions.description.{condition,main}`, so both
//   are always `undefined`), uppercases the result, then checks `.indexOf
//   (this.state.searchTerm)` against the *un-uppercased* search term
//   (so it only ever matches if the user types in all caps) - and even
//   then, the resulting boolean is stored in a variable named `noMatch`
//   but actually means "a match WAS found", so `if (noMatch) return
//   false;` excludes markets on a search *hit*, backwards from the
//   evident intent. All of this is transcribed exactly.
// - `_isValidPredictionMarketAsset` uses no `this` at all (a pure
//   function of its `asset` argument) - kept as a plain local function,
//   same as the original's effectively-static instance method.
import * as React from "react";
import assetUtils from "common/asset_utils";
import AssetActions from "actions/AssetActions";
import AssetStore from "stores/AssetStore";
import MarketsActions from "actions/MarketsActions";
import counterpart from "counterpart";
import PredictionMarketsOverviewTable from "./PredictionMarketsOverviewTable";
import PredictionMarketDetailsTable from "./PredictionMarketDetailsTable";
import SearchInput from "../Utility/SearchInput";
import HelpContent from "../Utility/HelpContent";
import AddOpinionModal from "./AddOpinionModal";
import CreateMarketModal from "./CreateMarketModal";
import ResolveModal from "./ResolveModal";
import {ChainStore} from "bitsharesjs";
import {Switch, Button, Radio, Icon, Tooltip} from "bitshares-ui-style-guide";
import {Asset, Price} from "../../lib/common/MarketClasses";
import Translate from "react-translate-component";
import {bindToCurrentAccount} from "../Utility/BindToCurrentAccount";
import MarketsStore from "../../stores/MarketsStore";
import {useAltStore} from "../../next/hooks/useAltStore";

interface PredictionMarketsState {
    searchTerm: string;
    detailsSearchTerm: string;
    selectedPredictionMarket: any;
    opinions: any[];
    preselectedOpinion: string;
    preselectedAmount: number;
    preselectedProbability: number;
    isCreateMarketModalOpen: boolean;
    isAddOpinionModalOpen: boolean;
    isResolveModalOpen: boolean;
    isHideUnknownHousesChecked: boolean;
    isHideInvalidAssetsChecked: boolean;
    opinionFilter: string;
    predictionMarketAssetFilter: string;
    subscribedMarket?: {base: any; quote: any};
}

interface PredictionMarketsProps {
    assets?: any;
    whitelistedIssuers?: any[];
    predictionMarkets?: any[];
    loading?: boolean;
    fetchAllAssets?: () => void;
    bucketSize?: any;
    currentGroupOrderLimit?: any;
    marketLimitOrders?: any;
    currentAccount?: any;
}

function _isValidPredictionMarketAsset(asset: any): boolean {
    // must have valid date
    const resolutionDate = new Date(asset.forPredictions.description.expiry);
    if (resolutionDate instanceof Date && isNaN(resolutionDate.getTime())) {
        return false;
    }
    // must have description and prediction filled
    if (!asset.forPredictions.description.condition) {
        return false;
    }
    if (!asset.forPredictions.description.main) {
        return false;
    }
    // must have meaningfull description and prediction
    if (asset.forPredictions.description.condition.length < 10) {
        return false;
    }
    if (asset.forPredictions.description.main.length < 20) {
        return false;
    }
    // market fee may not be crazy
    if (asset.options.market_fee_percent / 100 >= 10) {
        return false;
    }
    return true;
}

function PredictionMarketsCore(props: PredictionMarketsProps) {
    const [state, setState] = React.useState<PredictionMarketsState>({
        searchTerm: "",
        detailsSearchTerm: "",
        selectedPredictionMarket: null,
        opinions: [],
        preselectedOpinion: "yes",
        preselectedAmount: 0,
        preselectedProbability: 0,
        isCreateMarketModalOpen: false,
        isAddOpinionModalOpen: false,
        isResolveModalOpen: false,
        isHideUnknownHousesChecked: true,
        isHideInvalidAssetsChecked: true,
        opinionFilter: "yes",
        predictionMarketAssetFilter: "open"
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const mergeState = (patch: Partial<PredictionMarketsState>) =>
        setState(prev => ({...prev, ...patch}));

    const _isKnownIssuer = (asset: any): boolean => {
        return (props.whitelistedIssuers || []).includes(asset.issuer);
    };

    const _updateOpinionsList = (fetchedOpinions: any) => {
        const orders: any[] = [];
        const selectedMarket = stateRef.current.selectedPredictionMarket;
        fetchedOpinions.forEach((order: any, order_id: any) => {
            const opinion =
                order.market_base === order.sell_price.base.asset_id
                    ? "no"
                    : "yes";
            const refPrice =
                order.market_base === order.sell_price.base.asset_id
                    ? order.sell_price.invert().toReal()
                    : order.sell_price.toReal();
            const amount =
                order.market_base === order.sell_price.base.asset_id
                    ? order.amountForSale()
                    : order.amountToReceive();
            const premium =
                order.market_base === order.sell_price.base.asset_id
                    ? order.amountToReceive()
                    : order.amountForSale();
            const flagBooleans = (assetUtils as any).getFlagBooleans(
                selectedMarket.options.flags,
                true
            );
            let fee = 0;
            if (flagBooleans["charge_market_fee"]) {
                fee = Math.min(
                    selectedMarket.options.max_market_fee,
                    (amount.amount * selectedMarket.options.market_fee_percent) /
                        10000
                );
            }

            if (refPrice < 1) {
                orders.push({
                    order_id,
                    opinionator: order.seller,
                    opinion,
                    amount,
                    likelihood: refPrice,
                    potentialProfit: new (Asset as any)({
                        amount: amount.amount,
                        asset_id: premium.asset_id,
                        precision: premium.precision
                    }),
                    premium: premium,
                    commission: new (Asset as any)({
                        amount: fee * refPrice,
                        asset_id: premium.asset_id,
                        precision: premium.precision
                    })
                });
            }
        });
        mergeState({opinions: [...orders]});
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        _updateOpinionsList(props.marketLimitOrders);
        // eslint-disable-next-line
    }, [props.marketLimitOrders]);

    const getMarketOpinions = async (market: any) => {
        if (stateRef.current.subscribedMarket) {
            await (MarketsActions as any).unSubscribeMarket(
                stateRef.current.subscribedMarket.quote.get("id"),
                stateRef.current.subscribedMarket.base.get("id")
            );
        }
        const base = (ChainStore as any).getObject(
            market.options.core_exchange_rate.base.asset_id
        );
        const quote = (ChainStore as any).getAsset(
            market.options.core_exchange_rate.quote.asset_id
        );

        await (MarketsActions as any).subscribeMarket(
            base,
            quote,
            props.bucketSize,
            props.currentGroupOrderLimit
        );
        mergeState({
            subscribedMarket: {
                base,
                quote
            }
        });
    };

    const onMarketAction = ({market, action}: {market: any; action: any}) => {
        if (typeof action === "string") {
            //on buttons action
            if (!state.selectedPredictionMarket) {
                mergeState({
                    selectedPredictionMarket: market
                });
            }

            switch (action) {
                case "resolve": {
                    mergeState({
                        preselectedAmount: 0,
                        preselectedProbability: 0
                    });
                    onResolveModalOpen();
                    break;
                }
                case "yes": {
                    if (state.subscribedMarket) {
                        mergeState({
                            preselectedAmount: 0,
                            preselectedProbability: 0,
                            preselectedOpinion: "yes"
                        });
                        onAddOpinionModalOpen();
                    }
                    break;
                }
                case "no": {
                    if (state.subscribedMarket) {
                        mergeState({
                            preselectedAmount: 0,
                            preselectedProbability: 0,
                            preselectedOpinion: "no"
                        });
                        onAddOpinionModalOpen();
                    }
                    break;
                }
                default: {
                    mergeState({
                        preselectedAmount: 0,
                        preselectedProbability: 0
                    });
                }
            }
        } else {
            //on row action
            if (state.selectedPredictionMarket) {
                mergeState({
                    selectedPredictionMarket: null
                });
            } else {
                mergeState({
                    selectedPredictionMarket: market
                });
                getMarketOpinions(market);
            }
        }
    };

    const onSearch = (event: any) => {
        mergeState({
            searchTerm: event.target.value || ""
        });
    };

    const onSearchDetails = (event: any) => {
        mergeState({
            detailsSearchTerm: event.target.value || ""
        });
    };

    const onCreatePredictionMarketModalOpen = () => {
        mergeState({
            isCreateMarketModalOpen: true
        });
    };

    const onCreatePredictionMarketModalClose = () => {
        mergeState({
            isCreateMarketModalOpen: false
        });
    };

    const onAddOpinionModalOpen = () => {
        mergeState({
            isAddOpinionModalOpen: true
        });
    };

    const onAddOpinionModalClose = () => {
        mergeState({
            isAddOpinionModalOpen: false,
            preselectedOpinion: "no",
            preselectedAmount: 0,
            preselectedProbability: 0
        });
    };

    const onResolveModalOpen = () => {
        mergeState({
            isResolveModalOpen: true
        });
    };

    const onResolveModalClose = () => {
        mergeState({
            isResolveModalOpen: false
        });
    };

    const handleUnknownHousesToggleChange = () => {
        const isHideUnknownHousesChecked = !state.isHideUnknownHousesChecked;
        mergeState({
            isHideUnknownHousesChecked,
            selectedPredictionMarket: null
        });
        if (props.fetchAllAssets) props.fetchAllAssets();
    };

    const handleInvalidAssetsChecked = () => {
        mergeState({
            isHideInvalidAssetsChecked: !state.isHideInvalidAssetsChecked,
            selectedPredictionMarket: null
        });
    };

    const onOppose = (opinion: any) => {
        mergeState({
            preselectedOpinion: opinion.opinion === "no" ? "yes" : "no",
            preselectedAmount: opinion.amount,
            preselectedProbability: opinion.probability
        });
        onAddOpinionModalOpen();
    };

    const onCancelOpinion = (opinion: any) => {
        (MarketsActions as any)
            .cancelLimitOrders(props.currentAccount.get("id"), [
                opinion.order_id
            ])
            .catch((err: any) => {
                console.log("cancel orders error:", err);
            });
    };

    const updateAsset = (symbol: string) => {
        (AssetActions as any).getAssetList.defer(symbol, 1);
    };

    const onResolveMarket = (market: any) => {
        const account = props.currentAccount.get("id");
        const globalSettlementPrice = market.result === "yes" ? 1 : 0;
        const asset = (ChainStore as any).getAsset(market.asset_id).toJS();
        const base = new (Asset as any)({
            real: 1,
            asset_id: asset.id,
            precision: asset.precision
        });
        const quoteAsset = (ChainStore as any).getAsset(
            asset.bitasset.options.short_backing_asset
        );
        const quote = new (Asset as any)({
            real: globalSettlementPrice,
            asset_id: asset.bitasset.options.short_backing_asset,
            precision: quoteAsset.get("precision")
        });
        const price = new (Price as any)({
            quote,
            base
        });

        (AssetActions as any)
            .assetGlobalSettle(asset, account, price)
            .then(() => {
                const pause = new Promise(resolve => setTimeout(resolve, 1000));
                pause.then(() => {
                    updateAsset(asset.symbol);
                });
            });
        mergeState({
            isResolveModalOpen: false
        });
    };

    const _filterMarkets = () => {
        const filter = state.predictionMarketAssetFilter;
        const markets = (props.predictionMarkets || []).filter(
            (assetInfo: any) => {
                const asset = assetInfo.asset;
                if (!asset) {
                    return false;
                }
                const bitassetData =
                    asset.bitasset_data || asset.bitasset || {};
                if (
                    state.isHideUnknownHousesChecked &&
                    !_isKnownIssuer(asset)
                ) {
                    return false;
                } else if (
                    state.isHideInvalidAssetsChecked &&
                    !_isValidPredictionMarketAsset(asset)
                ) {
                    return false;
                } else {
                    const accountName = (ChainStore as any).getAccount(
                        asset.issuer
                    )
                        ? (ChainStore as any)
                              .getAccount(asset.issuer)
                              .get("name")
                        : null;
                    if (accountName && state.searchTerm) {
                        const noMatch =
                            (
                                accountName +
                                "\0" +
                                asset.condition +
                                "\0" +
                                asset.description
                            )
                                .toUpperCase()
                                .indexOf(state.searchTerm) !== -1;
                        if (noMatch) {
                            return false;
                        }
                    }
                    if (filter && filter !== "all") {
                        const resolutionDate = new Date(
                            asset.forPredictions.description.expiry
                        );
                        const settlementFund =
                            bitassetData.settlement_fund || 0;
                        const isExpiredOrResolved =
                            settlementFund > 0 || resolutionDate < new Date();
                        if (filter === "open") {
                            return !isExpiredOrResolved;
                        } else if (filter === "past_resolution_date") {
                            return isExpiredOrResolved;
                        } else {
                            return false;
                        }
                    } else {
                        return true;
                    }
                }
            }
        );
        return markets;
    };

    const getOverviewSection = () => {
        const setPredictionMarketAssetFilter = (e: any) => {
            mergeState({
                predictionMarketAssetFilter: e.target.value
            });
        };
        const predictionMarketsToShow = _filterMarkets();
        return (
            <div>
                <div
                    className="header-selector"
                    style={{display: "inline-block", width: "100%"}}
                >
                    <div className="filter-block">
                        <SearchInput onChange={onSearch} value={state.searchTerm} />
                        <Radio.Group
                            style={{marginLeft: "20px"}}
                            value={state.predictionMarketAssetFilter}
                            onChange={setPredictionMarketAssetFilter}
                        >
                            <Radio value={"all"}>
                                {counterpart.translate(
                                    "prediction.overview.all"
                                )}
                            </Radio>
                            <Radio value={"open"}>
                                {counterpart.translate(
                                    "prediction.overview.open"
                                )}
                            </Radio>
                            <Radio value={"past_resolution_date"}>
                                {counterpart.translate(
                                    "prediction.overview.past_resolution_date"
                                )}
                            </Radio>
                        </Radio.Group>
                        <span>
                            <Switch
                                style={{marginLeft: "20px", cursor: "pointer"}}
                                onChange={handleUnknownHousesToggleChange}
                                checked={state.isHideUnknownHousesChecked}
                            />
                            <Translate
                                onClick={handleUnknownHousesToggleChange}
                                content="prediction.overview.hide_unknown_houses"
                                style={{
                                    marginLeft: "10px",
                                    cursor: "pointer"
                                }}
                            />
                            <Tooltip
                                title={counterpart.translate(
                                    "prediction.tooltips.hide_unknown_houses"
                                )}
                            >
                                <Icon
                                    style={{
                                        marginLeft: "0.5rem"
                                    }}
                                    type="question-circle"
                                    theme="filled"
                                />
                            </Tooltip>
                            <Switch
                                style={{marginLeft: "20px", cursor: "pointer"}}
                                onChange={handleInvalidAssetsChecked}
                                checked={state.isHideInvalidAssetsChecked}
                            />
                            <Translate
                                onClick={handleInvalidAssetsChecked}
                                content="prediction.overview.hide_invalid_asset"
                                style={{
                                    marginLeft: "10px",
                                    cursor: "pointer"
                                }}
                            />
                            <Tooltip
                                title={counterpart.translate(
                                    "prediction.tooltips.hide_invalid_asset"
                                )}
                            >
                                <Icon
                                    style={{
                                        marginLeft: "0.5rem"
                                    }}
                                    type="question-circle"
                                    theme="filled"
                                />
                            </Tooltip>
                        </span>
                    </div>
                    <div className="filter-status">
                        {counterpart.translate("utility.x_assets_hidden", {
                            count:
                                (props.predictionMarkets || []).length -
                                predictionMarketsToShow.length,
                            total: (props.predictionMarkets || []).length
                        })}
                    </div>
                </div>
                <div
                    className="header-selector"
                    style={{
                        display: "inline-block",
                        width: "100%",
                        paddingTop: "0rem"
                    }}
                >
                    <span className="action-buttons">
                        <Tooltip
                            title={counterpart.translate(
                                "prediction.tooltips.create_prediction_market_asset"
                            )}
                        >
                            <Icon
                                style={{
                                    fontSize: "1.3rem",
                                    marginRight: "0.5rem"
                                }}
                                type="question-circle"
                                theme="filled"
                            />
                        </Tooltip>
                        <Button onClick={onCreatePredictionMarketModalOpen}>
                            {counterpart.translate(
                                "prediction.overview.create_market"
                            )}
                        </Button>
                    </span>
                </div>
                <PredictionMarketsOverviewTable
                    predictionMarkets={predictionMarketsToShow}
                    currentAccount={props.currentAccount}
                    onMarketAction={onMarketAction}
                    selectedPredictionMarket={state.selectedPredictionMarket}
                    loading={props.loading}
                />
            </div>
        );
    };

    const getDetailsSection = () => {
        const setOpinionFilter = (e: any) => {
            mergeState({
                opinionFilter: e.target.value
            });
        };
        return (
            <div>
                <h3>
                    {counterpart.translate(
                        "prediction.details.list_of_current_prediction_offers"
                    )}
                    <Tooltip
                        title={counterpart.translate(
                            "prediction.tooltips.what_is_a_prediction_offer"
                        )}
                    >
                        <Icon
                            style={{
                                marginLeft: "0.5rem"
                            }}
                            type="question-circle"
                            theme="filled"
                        />
                    </Tooltip>
                </h3>
                <div
                    className="header-selector"
                    style={{display: "inline-block", width: "100%"}}
                >
                    <div className="filter-block">
                        <SearchInput
                            onChange={onSearchDetails}
                            value={state.detailsSearchTerm}
                            autoComplete="off"
                        />
                        <Radio.Group
                            style={{marginLeft: "20px"}}
                            value={state.opinionFilter}
                            onChange={setOpinionFilter}
                        >
                            <Radio value={"all"}>
                                {counterpart.translate(
                                    "prediction.details.all"
                                )}
                            </Radio>
                            <Radio value={"yes"}>
                                {counterpart.translate(
                                    "prediction.details.proves_true"
                                )}
                            </Radio>
                            <Radio value={"no"}>
                                {counterpart.translate(
                                    "prediction.details.incorrect"
                                )}
                            </Radio>
                        </Radio.Group>
                    </div>
                    <span className="action-buttons">
                        <Tooltip
                            title={counterpart.translate(
                                "prediction.tooltips.add_prediction"
                            )}
                        >
                            <Icon
                                style={{
                                    fontSize: "1.3rem",
                                    marginRight: "0.5rem"
                                }}
                                type="question-circle"
                                theme="filled"
                            />
                        </Tooltip>
                        <Button onClick={onAddOpinionModalOpen}>
                            {counterpart.translate(
                                "prediction.details.add_prediction"
                            )}
                        </Button>
                    </span>
                </div>
                {state.opinions ? (
                    <PredictionMarketDetailsTable
                        predictionMarketData={{
                            predictionMarket: state.selectedPredictionMarket,
                            opinions: state.opinions
                        }}
                        currentAccount={props.currentAccount}
                        onOppose={onOppose}
                        onCancel={onCancelOpinion}
                        detailsSearchTerm={state.detailsSearchTerm.toUpperCase()}
                        opinionFilter={state.opinionFilter}
                    />
                ) : null}
            </div>
        );
    };

    const symbols = [...(props.assets || [])].map(
        (item: any) => item[1].symbol
    );
    return (
        <div
            className="prediction-markets grid-block vertical"
            style={{overflow: "visible", margin: "15px"}}
        >
            <div
                className="grid-block small-12 shrink"
                style={{overflow: "visible"}}
            >
                <HelpContent path={"components/PredictionMarkets"} />
            </div>
            {getOverviewSection()}
            {state.selectedPredictionMarket ? getDetailsSection() : null}
            {state.isCreateMarketModalOpen ? (
                <CreateMarketModal
                    visible={state.isCreateMarketModalOpen}
                    onClose={onCreatePredictionMarketModalClose}
                    currentAccount={props.currentAccount.get("id")}
                    symbols={symbols}
                    onMarketCreated={updateAsset}
                />
            ) : null}
            {state.isAddOpinionModalOpen ? (
                <AddOpinionModal
                    visible={state.isAddOpinionModalOpen}
                    onClose={onAddOpinionModalClose}
                    predictionMarket={state.selectedPredictionMarket}
                    currentAccount={props.currentAccount}
                    preselectedOpinion={state.preselectedOpinion}
                    preselectedAmount={state.preselectedAmount}
                    preselectedProbability={state.preselectedProbability}
                    baseAsset={(state.subscribedMarket as any).base}
                    quoteAsset={(state.subscribedMarket as any).quote}
                />
            ) : null}
            {state.isResolveModalOpen ? (
                <ResolveModal
                    visible={state.isResolveModalOpen}
                    onClose={onResolveModalClose}
                    predictionMarket={state.selectedPredictionMarket}
                    onResolveMarket={onResolveMarket}
                />
            ) : null}
        </div>
    );
}

function PredictionMarkets(props: PredictionMarketsProps) {
    const assetState = useAltStore<any>(AssetStore);
    const marketsState = useAltStore<any>(MarketsStore);

    return (
        <PredictionMarketsCore
            {...props}
            assets={assetState.assets}
            bucketSize={marketsState.bucketSize}
            currentGroupOrderLimit={marketsState.currentGroupLimit}
            marketLimitOrders={marketsState.marketLimitOrders}
        />
    );
}

export default bindToCurrentAccount(PredictionMarkets as any);
