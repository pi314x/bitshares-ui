// TypeScript/functional-component port of the legacy Asset.jsx (Phase 2,
// docs/UI_MIGRATION_PLAN.md). Renders the "/asset/:symbol" details page -
// about box, summary, permissions, fee pool, price feed, settlement,
// margin/collateral-bid tables, and an "Actions" tab. This is the
// higher-risk sibling of `Transaction.tsx` (ported in its own earlier
// slice): it computes financial figures itself (margin ratios,
// collateral-bid ordering, settlement prices, via the `CallOrder`/
// `CollateralBid`/`FeedPrice` classes from `common/MarketClasses`, fed by
// live `Apis.instance().db_api().exec(...)` calls) and its "Actions" tab
// wires five real transaction-submitting forms (`AssetOwnerUpdate`,
// `AssetPublishFeed`, `AssetResolvePrediction`, `BidCollateralOperation`,
// `FeePoolOperation` - all reused completely unchanged) via prop
// injection. Ported as a careful, mechanical, line-for-line translation
// with NO logic changes and NO restructuring/splitting - per AGENTS.md's
// "prefer minimal, well-tested diffs over refactors" for anything this
// close to transaction-submission wiring, and confirmed with the user
// before starting given the file's size (2461 lines) and risk profile.
//
// Structural change (same substitution pattern this migration has
// applied to every other legacy `BindToChainState`/`connect`/
// `AssetWrapper`-wrapped file, not a one-off redesign): the original's
// three-layer HOC chain - `AssetSymbolSplitter` -> `AssetContainer`
// (wrapped with `AssetWrapper(..., {withDynamic: true})`, resolving the
// route symbol into a live asset object and providing `getDynamicObject`)
// -> `connect(...)` + `AssetWrapper(Asset, {propNames: ["backingAsset",
// "coreAsset"]})` (resolving those two string ids into live asset
// objects, and injecting `currentAccount`) - is collapsed into two
// components: `AssetContainer` (does all the ChainStore resolution
// directly, via `ChainStore.getAsset`/`ChainStore.getObject` + `useAltStore
// (AccountStore)`, gated by `useChainStoreTick()`) and `Asset` (receives
// already-resolved props, exactly as before). `ChainStore.getAsset`'s
// null-vs-undefined contract (`null` = confirmed not found, `undefined`
// = still loading) is exactly what `BindToChainState`/`AssetWrapper`
// already relied on, so the original's `=== null` / `!x.get` guards are
// preserved verbatim.
//
// Confirmed dead, dropped (verified by reading the whole file): the
// `marginTableSort`, `collateralTableSort`, and `sortDirection` state
// fields - all initialized in the constructor, never read anywhere else
// in the file.
//
// `UNSAFE_componentWillMount`'s `this._getMarginCollateral()` call ->
// `useEffect(..., [])` (mount-only, matching the original's own
// mount-only timing exactly - it never re-ran on asset-prop changes
// either, only via `updateOnCollateralBid` after placing/canceling a
// bid). Note this means navigating between two different assets without
// an intervening full remount would - in both the original and this
// port - leave stale `callOrders`/`collateralBids` from the previous
// asset displayed against the new one; a pre-existing characteristic of
// the mount-only fetch, not something this port changes.
//
// Also confirmed dead, dropped: `renderPriceFeed`/`renderSettlement`'s
// early-return `<div header={title} />` (both functions) referenced a
// `title` variable that, in the original class, was only declared later
// in the same method via `var title = (...)` - hoisted but always
// `undefined` at that point in execution. Since React omits `undefined`
// prop values from the rendered DOM regardless of prop name, `<div
// header={undefined} />` and `<div />` render identically - simplified
// to the latter.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import {useParams} from "react-router-dom";
import Translate from "react-translate-component";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import FormattedAsset from "../Utility/FormattedAsset";
import FormattedPrice from "../Utility/FormattedPrice";
import AssetName from "../Utility/AssetName";
import TimeAgo from "../Utility/TimeAgo";
import HelpContent from "../Utility/HelpContent";
import assetUtils from "common/asset_utils";
import utils from "common/utils";
import FormattedTime from "../Utility/FormattedTime";
import {ChainStore} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";
import {CallOrder, CollateralBid, FeedPrice} from "common/MarketClasses";
import Page404 from "../Page404/Page404";
import FeePoolOperation from "../Account/FeePoolOperation";
import AccountStore from "stores/AccountStore";
import counterpart from "counterpart";
import AssetOwnerUpdate from "./AssetOwnerUpdate";
import AssetPublishFeed from "./AssetPublishFeed";
import AssetResolvePrediction from "./AssetResolvePrediction";
import BidCollateralOperation from "./BidCollateralOperation";
import {
    Tooltip,
    Icon,
    Table,
    Tabs,
    Collapse,
    Alert
} from "bitshares-ui-style-guide";
import GatewayStore from "../../stores/GatewayStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const {Panel} = Collapse as any;
const TypedLink = Link as React.ComponentType<LinkProps>;

function AssetFlag({isSet, name}: {isSet: boolean; name: string}) {
    if (!isSet) {
        return <span />;
    }

    return (
        <span className="asset-flag">
            <span className="label info">
                <Translate content={"account.user_issued_assets." + name} />
            </span>
        </span>
    );
}

function AssetPermission({isSet, name}: {isSet: boolean; name: string}) {
    if (!isSet) {
        return <span />;
    }

    return (
        <span className="asset-flag">
            <span className="label info">
                <Translate content={"account.user_issued_assets." + name} />
            </span>
        </span>
    );
}

interface AssetProps {
    asset: any;
    backingAsset: any;
    coreAsset: any;
    currentAccount: any;
    getDynamicObject: (id: string) => any;
}

function Asset({
    asset,
    backingAsset,
    coreAsset,
    currentAccount,
    getDynamicObject
}: AssetProps) {
    const [callOrders, setCallOrders] = React.useState<any[]>([]);
    const [collateralBids, setCollateralBids] = React.useState<any[]>([]);
    const [showCollateralBidInInfo, setShowCollateralBidInInfo] = React.useState(
        false
    );
    const [cumulativeGrouping, setCumulativeGrouping] = React.useState(false);
    const [activeFeedTab, setActiveFeedTab] = React.useState("margin");
    const [activeAssetTab, setActiveAssetTab] = React.useState("info");

    function getFeedPrice() {
        const assets: any = {
            [asset.get("id")]: asset.toJS(),
            [backingAsset.get("id")]: backingAsset.toJS()
        };

        const isPredictionMarket = asset.getIn(
            ["bitasset", "is_prediction_market"],
            false
        );
        let sqr = asset.getIn([
            "bitasset",
            "current_feed",
            "maximum_short_squeeze_ratio"
        ]);

        const mcfr = asset.getIn([
            "bitasset",
            "options",
            "extensions",
            "margin_call_fee_ratio"
        ]);

        let feedPriceRaw = (assetUtils as any).extractRawFeedPrice(asset);

        // if there has been no feed price, settlePrice has 0 amount
        if (
            feedPriceRaw.getIn(["base", "amount"]) == 0 &&
            feedPriceRaw.getIn(["quote", "amount"]) == 0
        ) {
            return null;
        }

        /* Prediction markets don't need feeds for shorting, so the settlement price can be set to 1:1 */
        if (
            isPredictionMarket &&
            feedPriceRaw.getIn(["base", "asset_id"]) ===
                feedPriceRaw.getIn(["quote", "asset_id"])
        ) {
            if (!assets[backingAsset.get("id")]) {
                assets[backingAsset.get("id")] = {
                    precision: asset.get("precision")
                };
            }
            feedPriceRaw = feedPriceRaw.setIn(["base", "amount"], 1);
            feedPriceRaw = feedPriceRaw.setIn(
                ["base", "asset_id"],
                backingAsset.get("id")
            );
            feedPriceRaw = feedPriceRaw.setIn(["quote", "amount"], 1);
            feedPriceRaw = feedPriceRaw.setIn(
                ["quote", "asset_id"],
                asset.get("id")
            );
            sqr = 1000;
        }

        // Catch Invalid SettlePrice object
        if (feedPriceRaw.toJS) {
            const settleObject = feedPriceRaw.toJS();
            if (!assets[settleObject.base.asset_id]) return;
        }

        const feedPrice = new (FeedPrice as any)({
            priceObject: feedPriceRaw,
            market_base: asset.get("id"),
            sqr,
            mcfr,
            assets
        });

        return feedPrice;
    }

    function getMarginCollateral() {
        if (asset.has("bitasset")) {
            const assets: any = {
                [asset.get("id")]: asset.toJS(),
                [backingAsset.get("id")]: backingAsset.toJS()
            };

            const isPredictionMarket = asset.getIn(
                ["bitasset", "is_prediction_market"],
                false
            );

            const feedPrice = getFeedPrice();

            if (!!feedPrice) {
                try {
                    const mcr = asset.getIn([
                        "bitasset",
                        "current_feed",
                        "maintenance_collateral_ratio"
                    ]);

                    (Apis as any)
                        .instance()
                        .db_api()
                        .exec("get_call_orders", [asset.get("id"), 300])
                        .then((call_orders: any) => {
                            const orders = call_orders.map((c: any) => {
                                return new (CallOrder as any)(
                                    c,
                                    assets,
                                    asset.get("id"),
                                    feedPrice,
                                    mcr,
                                    isPredictionMarket
                                );
                            });
                            setCallOrders(orders);
                        });
                } catch (e) {
                    // console.log(err);
                }
                try {
                    (Apis as any)
                        .instance()
                        .db_api()
                        .exec("get_collateral_bids", [
                            asset.get("id"),
                            100,
                            0
                        ])
                        .then((coll_orders: any) => {
                            const bids = coll_orders.map((c: any) => {
                                return new (CollateralBid as any)(
                                    c,
                                    assets,
                                    asset.get("id"),
                                    feedPrice
                                );
                            });
                            setCollateralBids(bids);
                        });
                } catch (e) {
                    console.log("get_collateral_bids Error: ", e);
                }
            }
        }
    }

    React.useEffect(() => {
        getMarginCollateral();
        // eslint-disable-next-line
    }, []);

    function updateOnCollateralBid() {
        getMarginCollateral();
    }

    function toggleCumulativeGrouping() {
        setCumulativeGrouping(!cumulativeGrouping);
    }

    function assetType(a: any) {
        return "bitasset" in a
            ? a.bitasset.is_prediction_market
                ? "Prediction"
                : "Smart"
            : "Simple";
    }

    function formattedPrice(
        price: any,
        hide_symbols = false,
        hide_value = false,
        factor = 0,
        negative_invert = false
    ) {
        if (typeof price == "number" && isNaN(price)) {
            return "-";
        }
        const base = price.base;
        const quote = price.quote;
        return (
            <FormattedPrice
                base_amount={base.amount}
                base_asset={base.asset_id}
                quote_amount={quote.amount}
                quote_asset={quote.asset_id}
                hide_value={hide_value}
                hide_symbols={hide_symbols}
                factor={factor}
                negative_invert={negative_invert}
            />
        );
    }

    function renderFlagIndicators(flags: any, names: string[]) {
        return (
            <div>
                {names.map(name => {
                    return (
                        <AssetFlag
                            key={`flag_${name}`}
                            name={name}
                            isSet={flags[name]}
                        />
                    );
                })}
            </div>
        );
    }

    function renderPermissionIndicators(permissions: any, names: string[]) {
        return (
            <div>
                {names.map(name => {
                    return (
                        <AssetPermission
                            key={`perm_${name}`}
                            name={name}
                            isSet={permissions[name]}
                        />
                    );
                })}
            </div>
        );
    }

    function renderAuthorityList(authorities: string[]) {
        return authorities.map(authority => {
            return (
                <span key={authority}>
                    <LinkToAccountById account={authority} />
                    &nbsp;
                </span>
            );
        });
    }

    function renderMarketList(assetForMarket: any, markets: string[]) {
        const symbol = assetForMarket.symbol;
        return markets.map(market => {
            if (market == symbol) return null;
            const marketID = market + "_" + symbol;
            const marketName = market + "/" + symbol;
            return (
                <span key={marketID}>
                    <TypedLink to={`/market/${marketID}`}>
                        {marketName}
                    </TypedLink>
                    &nbsp;
                </span>
            );
        });
    }

    function renderAboutBox(assetJS: any, originalAsset: any) {
        const issuer = ChainStore.getObject(assetJS.issuer, false, false);
        const issuerName = issuer ? (issuer as any).get("name") : "";

        // Add <a to any links included in the description
        const description = (assetUtils as any).parseDescription(
            assetJS.options.description
        );
        let desc = description.main;
        const short_name = description.short_name
            ? description.short_name
            : null;

        const urlTest = /(http?):\/\/(www\.)?[a-z0-9\.:].*?(?=\s)/g;

        // Regexp needs a whitespace after a url, so add one to make sure
        desc = desc && desc.length > 0 ? desc + " " : desc;
        const urls = desc.match(urlTest);

        // Add market link
        const core_asset = coreAsset;
        const core_asset_symbol = core_asset.get("symbol");
        let preferredMarket = description.market
            ? description.market
            : core_asset_symbol;
        if (assetJS.bitasset) {
            const preferredMarketAsset: any = ChainStore.getAsset(
                assetJS.bitasset.options.short_backing_asset
            );
            if (!!preferredMarketAsset && preferredMarketAsset.get) {
                preferredMarket = preferredMarketAsset.get("symbol");
            } else {
                preferredMarket = core_asset_symbol;
            }
        }
        if (assetJS.symbol === core_asset_symbol) preferredMarket = "USD";
        if (urls && urls.length) {
            urls.forEach((url: string) => {
                const markdownUrl = `<a target="_blank" class="external-link" rel="noopener noreferrer" href="${url}">${url}</a>`;
                desc = desc.replace(url, markdownUrl);
            });
        }

        const {name, prefix} = (utils as any).replaceName(originalAsset);

        let warning;
        if ((GatewayStore as any).isAssetBlacklisted(assetJS)) {
            warning = (
                <Alert
                    message={counterpart.translate(
                        "explorer.assets.blacklisted"
                    )}
                    type="error"
                    showIcon
                    style={{marginTop: "1em"}}
                />
            );
        }
        return (
            <div style={{overflow: "visible"}}>
                {assetJS &&
                    issuer &&
                    assetJS.id != "1.3.0" &&
                    (issuer as any).get("id") != "1.2.0" && (
                        <Alert
                            message={counterpart.translate(
                                "explorer.asset.asset_owner_responsible"
                            )}
                            type="info"
                            showIcon
                            style={{marginTop: "1em"}}
                        />
                    )}
                {warning}

                <HelpContent
                    path={"assets/" + assetJS.symbol}
                    alt_path="assets/Asset"
                    section="summary"
                    symbol={(prefix || "") + name}
                    description={desc}
                    issuer={issuerName}
                    hide_issuer="true"
                />
                {short_name ? <p>{short_name}</p> : null}

                <TypedLink
                    className="button market-button"
                    to={`/market/${assetJS.symbol}_${preferredMarket}`}
                >
                    <Translate content="exchange.market" />
                </TypedLink>
            </div>
        );
    }

    function renderSummary(assetJS: any) {
        // TODO: confidential_supply: 0 USD   [IF NOT ZERO OR NOT DISABLE CONFIDENTIAL]
        let dynamic = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        const options = assetJS.options;

        const flagBooleans = (assetUtils as any).getFlagBooleans(
            assetJS.options.flags,
            asset.has("bitasset_data_id")
        );

        const bitNames = Object.keys(flagBooleans);

        const isPrediction =
            "bitasset" in assetJS && assetJS.bitasset.is_prediction_market;
        let predictionRows = null;
        if (isPrediction) {
            const description = (assetUtils as any).parseDescription(
                assetJS.options.description
            );
            predictionRows = (
                <React.Fragment>
                    <tr>
                        <td>
                            <Tooltip
                                title={counterpart.translate(
                                    "explorer.asset.prediction_market_asset.tooltip_prediction"
                                )}
                            >
                                <Translate content="explorer.asset.prediction_market_asset.prediction" />
                            </Tooltip>
                        </td>
                        <td>
                            <Tooltip
                                title={counterpart.translate(
                                    "explorer.asset.prediction_market_asset.tooltip_prediction"
                                )}
                            >
                                {description.condition}
                            </Tooltip>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <Tooltip
                                title={counterpart.translate(
                                    "explorer.asset.prediction_market_asset.tooltip_resolution_date"
                                )}
                            >
                                <Translate content="explorer.asset.prediction_market_asset.resolution_date" />
                            </Tooltip>
                        </td>
                        <td>
                            <Tooltip
                                title={counterpart.translate(
                                    "explorer.asset.prediction_market_asset.tooltip_resolution_date"
                                )}
                            >
                                {description.expiry}
                            </Tooltip>
                        </td>
                    </tr>
                </React.Fragment>
            );
        }

        const currentSupply = dynamic ? (
            <tr>
                <td>
                    <Translate content="explorer.asset.summary.current_supply" />
                </td>
                <td>
                    <FormattedAsset
                        amount={dynamic.current_supply}
                        asset={assetJS.id}
                    />
                </td>
            </tr>
        ) : null;

        const stealthSupply = dynamic ? (
            <tr>
                <td>
                    <Translate content="explorer.asset.summary.stealth_supply" />
                </td>
                <td>
                    <FormattedAsset
                        amount={dynamic.confidential_supply}
                        asset={assetJS.id}
                    />
                </td>
            </tr>
        ) : null;

        const marketFee = flagBooleans["charge_market_fee"] ? (
            <tr>
                <td>
                    <Translate content="explorer.asset.summary.market_fee" />
                </td>
                <td> {options.market_fee_percent / 100.0} % </td>
            </tr>
        ) : null;

        // options.max_market_fee initially a string
        const marketFeeReferralReward =
            flagBooleans["charge_market_fee"] &&
            options.extensions &&
            options.extensions.reward_percent >= 0 ? (
                <tr>
                    <td>
                        <Tooltip
                            title={counterpart.translate(
                                "account.user_issued_assets.reward_percent_tooltip"
                            )}
                        >
                            <Translate content="explorer.asset.summary.market_fee_referral_reward_percent" />{" "}
                            <Icon type="question-circle" theme="filled" />
                        </Tooltip>
                    </td>
                    <td> {options.extensions.reward_percent / 100.0} % </td>
                </tr>
            ) : null;

        const marketFeeTaker =
            flagBooleans["charge_market_fee"] &&
            options.extensions &&
            options.extensions.taker_fee_percent >= 0 ? (
                <tr>
                    <td>
                        <Tooltip
                            title={counterpart.translate(
                                "account.user_issued_assets.taker_fee_percent_tooltip"
                            )}
                        >
                            <Translate content="explorer.asset.summary.market_fee_referral_taker_fee_percent" />{" "}
                            <Icon type="question-circle" theme="filled" />
                        </Tooltip>
                    </td>
                    <td> {options.extensions.taker_fee_percent / 100.0} % </td>
                </tr>
            ) : null;

        return (
            <div className="asset-card no-padding">
                <div className="card-divider">
                    <AssetName name={assetJS.symbol} />
                </div>
                <table className="table key-value-table table-hover">
                    <tbody>
                        <tr>
                            <td>
                                <Translate content="explorer.asset.summary.asset_type" />
                            </td>
                            <td> {assetType(assetJS)} </td>
                        </tr>
                        {isPrediction && predictionRows}
                        <tr>
                            <td>
                                <Translate content="explorer.asset.summary.issuer" />
                            </td>
                            <td>
                                <LinkToAccountById account={assetJS.issuer} />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content="explorer.assets.precision" />
                            </td>
                            <td> {assetJS.precision} </td>
                        </tr>
                        {assetJS.bitasset ? (
                            <tr>
                                <td>
                                    <Translate content="explorer.assets.backing_asset" />
                                </td>
                                <td>
                                    <LinkToAssetById
                                        asset={
                                            assetJS.bitasset.options
                                                .short_backing_asset
                                        }
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {currentSupply}
                        {stealthSupply}
                        {marketFee}
                        {marketFeeReferralReward}
                        {marketFeeTaker}
                    </tbody>
                </table>
                <br />
                {renderFlagIndicators(flagBooleans, bitNames)}
            </div>
        );
    }

    function renderMCFR(ext: any) {
        if ("margin_call_fee_ratio" in ext) {
            return (
                <tr>
                    <td>
                        <Translate content="explorer.asset.price_feed.margin_call_fee_ratio" />
                    </td>
                    <td>{ext.margin_call_fee_ratio / 10.0 + "%"}</td>
                </tr>
            );
        }
    }

    function renderPriceFeed(assetJS: any) {
        const bitAsset = assetJS.bitasset;
        if (!("current_feed" in bitAsset)) return <div />;
        const currentFeed = bitAsset.current_feed;

        const feedPrice = formattedPrice(
            (assetUtils as any).extractRawFeedPrice(assetJS)
        );

        const medianFeedPrice = formattedPrice(
            bitAsset.median_feed.settlement_price
        );

        const title = (
            <div>
                <Translate content="explorer.asset.price_feed.title" />
                <span className="float-right">{feedPrice}</span>
            </div>
        );

        let icr_item_content =
            "explorer.asset.price_feed.initial_collateral_ratio";
        if (
            "initial_collateral_ratio" in bitAsset.options.extensions &&
            bitAsset.current_feed.initial_collateral_ratio ==
                bitAsset.options.extensions.initial_collateral_ratio &&
            bitAsset.feeds.length >= bitAsset.options.minimum_feeds
        ) {
            icr_item_content =
                "explorer.asset.price_feed.initial_collateral_ratio2";
        }
        let mcr_item_content =
            "explorer.asset.price_feed.maintenance_collateral_ratio";
        if (
            "maintenance_collateral_ratio" in bitAsset.options.extensions &&
            bitAsset.current_feed.maintenance_collateral_ratio ==
                bitAsset.options.extensions.maintenance_collateral_ratio &&
            bitAsset.feeds.length >= bitAsset.options.minimum_feeds
        ) {
            mcr_item_content =
                "explorer.asset.price_feed.maintenance_collateral_ratio2";
        }
        let mssr_item_content =
            "explorer.asset.price_feed.maximum_short_squeeze_ratio";
        if (
            "maximum_short_squeeze_ratio" in bitAsset.options.extensions &&
            bitAsset.current_feed.maximum_short_squeeze_ratio ==
                bitAsset.options.extensions.maximum_short_squeeze_ratio &&
            bitAsset.feeds.length >= bitAsset.options.minimum_feeds
        ) {
            mssr_item_content =
                "explorer.asset.price_feed.maximum_short_squeeze_ratio2";
        }

        return (
            <Panel header={title}>
                <table
                    className="table key-value-table table-hover"
                    style={{padding: "1.2rem"}}
                >
                    <tbody>
                        <tr>
                            <td>
                                <Translate content="explorer.asset.price_feed.external_feed_price" />
                            </td>
                            <td>{feedPrice}</td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content="explorer.asset.price_feed.median_price_feeds" />
                            </td>
                            <td>{medianFeedPrice}</td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content="explorer.asset.price_feed.feed_lifetime" />
                            </td>
                            <td>
                                {bitAsset.options.feed_lifetime_sec / 60 / 60}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content="explorer.asset.price_feed.min_feeds" />
                            </td>
                            <td>{bitAsset.options.minimum_feeds}</td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content={icr_item_content} />
                            </td>
                            <td>
                                {currentFeed.initial_collateral_ratio / 1000}
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Translate content={mcr_item_content} />
                            </td>
                            <td>
                                {currentFeed.maintenance_collateral_ratio /
                                    1000}
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <Translate content={mssr_item_content} />
                            </td>
                            <td>
                                {currentFeed.maximum_short_squeeze_ratio /
                                    1000}
                            </td>
                        </tr>
                        {renderMCFR(bitAsset.options.extensions)}
                    </tbody>
                </table>
            </Panel>
        );
    }

    function analyzeBids(settlement_fund_debt: number) {
        // Convert supply to calculable values
        const current_supply_value = settlement_fund_debt;

        let bids_collateral_value = 0;
        let bids_debt_value = 0;

        const sorted_bids = [...collateralBids].sort((a, b) => {
            return b.bid.toReal() - a.bid.toReal();
        });

        sorted_bids.forEach(bid => {
            let collateral = bid.collateral;
            let debt = bid.debt;
            if (bids_debt_value < current_supply_value) {
                if (bids_debt_value + debt >= current_supply_value) {
                    debt = current_supply_value - bids_debt_value;
                    collateral = (debt / bid.debt) * collateral;
                    bid.consideredIfRevived = 2;
                } else {
                    bid.consideredIfRevived = 1;
                }
                bids_collateral_value = bids_collateral_value + collateral;
                bids_debt_value = bids_debt_value + debt;
            } else {
                bid.consideredIfRevived = 0;
            }
        });

        return {
            collateral: bids_collateral_value,
            debt: bids_debt_value
        };
    }

    function renderSettlement(assetJS: any) {
        const bitAsset = assetJS.bitasset;
        if (!("current_feed" in bitAsset)) return <div />;

        let dynamic: any = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        const currentSupply = dynamic ? dynamic.current_supply : 0;

        const currentFeed = bitAsset.current_feed;
        const isGlobalSettle = bitAsset.settlement_fund > 0 ? true : false;

        let settlement_fund_collateral_ratio: number | null = null;
        let total_collateral_ratio: number | null = null;
        let revive_price_with_bids = null;
        let settlementPrice, revivePrice, settlementFund;
        let globalSettlementPrice,
            globalSettlementTriggerPrice,
            currentSettled,
            settlementOffset,
            settlementDelay,
            maxSettlementVolume,
            msspPrice,
            settlePrice;

        if (isGlobalSettle) {
            /***
             * Global Settled Assets
             */
            settlementFund = bitAsset.settlement_fund;

            /**
             * In globally settled assets the force settlement offset is 0
             *
             */
            settlementPrice = formattedPrice(bitAsset.settlement_price);
            revivePrice = formattedPrice(
                bitAsset.settlement_price,
                false,
                false,
                currentFeed.maintenance_collateral_ratio / 1000,
                true
            );

            const assets: any = {
                [asset.get("id")]: asset.toJS(),
                [backingAsset.get("id")]: backingAsset.toJS()
            };

            // Convert supply to calculable values
            let current_supply_value = currentSupply;
            let current_collateral_value = bitAsset.settlement_fund;

            const bids = analyzeBids(current_supply_value);

            revive_price_with_bids = (
                <FormattedPrice
                    base_amount={bitAsset.settlement_fund / 1 + bids.collateral} // /1 is implicit type conversion
                    base_asset={assets[bitAsset.options.short_backing_asset].id}
                    quote_amount={bids.debt}
                    quote_asset={assetJS.id}
                    hide_value={false}
                    hide_symbols={false}
                    factor={currentFeed.maintenance_collateral_ratio / 1000}
                    negative_invert={true}
                />
            );

            current_supply_value =
                current_supply_value / Math.pow(10, assetJS.precision);
            current_collateral_value =
                current_collateral_value /
                Math.pow(
                    10,
                    assets[bitAsset.options.short_backing_asset].precision
                );

            const bids_collateral =
                bids.collateral /
                Math.pow(
                    10,
                    assets[bitAsset.options.short_backing_asset].precision
                );

            const feedPrice = getFeedPrice();
            if (feedPrice) {
                settlement_fund_collateral_ratio =
                    current_collateral_value /
                    feedPrice.toReal() /
                    current_supply_value;

                total_collateral_ratio =
                    (current_collateral_value + bids_collateral) /
                    feedPrice.toReal() /
                    current_supply_value;
            }
        } else {
            /***
             * Non Global Settlement Assets
             */
            globalSettlementPrice = getGlobalSettlementPrice();
            globalSettlementTriggerPrice = getGlobalSettlementPrice(
                currentFeed.maximum_short_squeeze_ratio / 1000
            );
            currentSettled = bitAsset.force_settled_volume;
            settlementOffset = bitAsset.options.force_settlement_offset_percent;
            settlementDelay = bitAsset.options.force_settlement_delay_sec;
            maxSettlementVolume =
                bitAsset.options.maximum_force_settlement_volume;

            msspPrice = formattedPrice(
                (assetUtils as any).extractRawFeedPrice(assetJS),
                false,
                false,
                currentFeed.maximum_short_squeeze_ratio / 1000
            );
            settlePrice = formattedPrice(
                (assetUtils as any).extractRawFeedPrice(assetJS),
                false,
                false,
                1 - settlementOffset / 10000
            );
        }

        const title = (
            <div>
                <Translate content="explorer.asset.settlement.title" />
                <span className="float-right">
                    {isGlobalSettle ? settlementPrice : settlePrice}
                </span>
            </div>
        );

        let individual_settlement = null;
        if (bitAsset.options.extensions.black_swan_response_method == 2) {
            individual_settlement = [
                <tr key="debt">
                    <td>
                        <Translate content="explorer.asset.settlement.individual_settlement_debt" />
                    </td>
                    <td>
                        <FormattedAsset
                            asset={assetJS.id}
                            amount={bitAsset.individual_settlement_debt}
                        />
                    </td>
                </tr>,
                <tr key="fund">
                    <td>
                        <Translate content="explorer.asset.settlement.individual_settlement_fund" />
                    </td>
                    <td>
                        <FormattedAsset
                            asset={
                                bitAsset.options.extensions.short_backing_asset
                            }
                            amount={bitAsset.individual_settlement_fund}
                        />
                    </td>
                </tr>
            ];
        }

        return (
            <Panel header={title}>
                {isGlobalSettle && (
                    <Translate
                        component="p"
                        content="explorer.asset.settlement.gs_description"
                    />
                )}
                {isGlobalSettle && (
                    <p>
                        <Translate content="explorer.asset.settlement.gs_revive" />
                        &nbsp;(
                        <Translate content="explorer.asset.settlement.gs_see_actions" />
                        , &nbsp;
                        <Translate content="explorer.asset.settlement.gs_or" />
                        &nbsp;
                        <a
                            onClick={() => {
                                setShowCollateralBidInInfo(
                                    !showCollateralBidInInfo
                                );
                            }}
                        >
                            <Translate content="explorer.asset.settlement.gs_place_bid" />
                        </a>
                        ).
                    </p>
                )}

                <table
                    className="table key-value-table table-hover"
                    style={{padding: "1.2rem"}}
                >
                    {isGlobalSettle ? (
                        <tbody>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.settlement_price" />
                                </td>
                                <td>{settlementPrice}</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.settlement_funds" />
                                </td>
                                <td>
                                    <FormattedAsset
                                        asset={
                                            bitAsset.options.short_backing_asset
                                        }
                                        amount={settlementFund}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.settlement_funds_collateral_ratio" />
                                </td>
                                <td>
                                    {settlement_fund_collateral_ratio
                                        ? settlement_fund_collateral_ratio.toFixed(
                                              6
                                          )
                                        : "-"}
                                </td>
                            </tr>
                            <tr>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate
                                        style={{
                                            fontWeight: "bold"
                                        }}
                                        content="explorer.asset.settlement.gs_revert"
                                    />
                                </td>
                                <td>&nbsp;</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.gs_auto_revive_price" />
                                </td>
                                <td>
                                    {revivePrice} / {revive_price_with_bids}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate
                                        content="explorer.asset.settlement.gs_collateral_valuation"
                                        mcr={
                                            currentFeed.maintenance_collateral_ratio /
                                            1000
                                        }
                                    />
                                </td>
                                <td>
                                    {total_collateral_ratio
                                        ? total_collateral_ratio.toFixed(6)
                                        : "-"}
                                </td>
                            </tr>
                        </tbody>
                    ) : (
                        <tbody>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.price_feed.maximum_short_squeeze_price" />
                                </td>
                                <td>{msspPrice}</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.price_feed.global_settlement_trigger" />
                                </td>
                                <td>
                                    {globalSettlementTriggerPrice
                                        ? globalSettlementTriggerPrice
                                        : "-"}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.price_feed.global_settlement_price" />
                                </td>
                                <td>
                                    {globalSettlementPrice
                                        ? globalSettlementPrice
                                        : "-"}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.black_swan_response_method" />
                                </td>
                                <td>
                                    {
                                        bitAsset.options.extensions
                                            .black_swan_response_method
                                    }
                                </td>
                            </tr>
                            <tr>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate
                                        style={{
                                            fontWeight: "bold"
                                        }}
                                        content="explorer.asset.settlement.force_settlement"
                                    />
                                </td>
                                <td>&nbsp;</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.price" />
                                    &nbsp; ({(settlementOffset as number) / 100}%{" "}
                                    <Translate content="explorer.asset.settlement.offset" />
                                    )
                                </td>
                                <td>{settlePrice}</td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.force_settle_fee_percent" />
                                </td>
                                <td>
                                    {bitAsset.options.extensions
                                        .force_settle_fee_percent /
                                        100 +
                                        "%"}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.delay" />
                                </td>
                                <td>
                                    <FormattedTime time={settlementDelay} />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.max_settle_volume" />
                                    &nbsp;(
                                    {(maxSettlementVolume as number) / 100}
                                    %)
                                </td>
                                <td>
                                    <FormattedAsset
                                        asset={assetJS.id}
                                        amount={
                                            currentSupply *
                                            ((maxSettlementVolume as number) /
                                                10000)
                                        }
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.current_settled" />
                                </td>
                                <td>
                                    <FormattedAsset
                                        asset={assetJS.id}
                                        amount={currentSettled}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.settlement.settle_remaining_volume" />
                                </td>
                                <td>
                                    {currentSettled == 0
                                        ? 100
                                        : Math.round(
                                              100 -
                                                  (currentSettled /
                                                      (currentSupply *
                                                          ((maxSettlementVolume as number) /
                                                              10000))) *
                                                      100
                                          )}
                                    %
                                </td>
                            </tr>
                            {individual_settlement
                                ? individual_settlement.map(item => item)
                                : null}
                        </tbody>
                    )}
                </table>
            </Panel>
        );
    }

    function renderFeePool(assetJS: any) {
        let dynamic: any = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        const options = assetJS.options;
        const core = coreAsset;

        return (
            <Panel
                header={
                    <div>
                        <Translate content="explorer.asset.fee_pool.title" />
                        {dynamic ? (
                            <span className="float-right">
                                <FormattedAsset
                                    asset="1.3.0"
                                    amount={dynamic.fee_pool}
                                />
                            </span>
                        ) : null}
                    </div>
                }
            >
                <div>
                    <Translate
                        component="p"
                        content="explorer.asset.fee_pool.pool_text"
                        unsafe
                        asset={assetJS.symbol}
                        core={core.get("symbol")}
                    />
                    <table
                        className="table key-value-table"
                        style={{padding: "1.2rem"}}
                    >
                        <tbody>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.fee_pool.core_exchange_rate" />
                                </td>
                                <td>
                                    {formattedPrice(
                                        options.core_exchange_rate
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.fee_pool.pool_balance" />
                                </td>
                                <td>
                                    {dynamic ? (
                                        <FormattedAsset
                                            asset="1.3.0"
                                            amount={dynamic.fee_pool}
                                        />
                                    ) : null}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <Translate content="explorer.asset.fee_pool.unclaimed_issuer_income" />
                                </td>
                                <td>
                                    {dynamic ? (
                                        <FormattedAsset
                                            asset={assetJS.id}
                                            amount={dynamic.accumulated_fees}
                                        />
                                    ) : null}
                                </td>
                            </tr>
                            {assetJS.bitasset && (
                                <tr>
                                    <td>
                                        <Translate content="explorer.asset.fee_pool.accumulated_collateral_fees" />
                                    </td>
                                    <td>
                                        {dynamic ? (
                                            <FormattedAsset
                                                asset={
                                                    assetJS.bitasset.options
                                                        .short_backing_asset
                                                }
                                                amount={
                                                    dynamic.accumulated_collateral_fees
                                                }
                                            />
                                        ) : null}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Panel>
        );
    }

    function renderAssetOwnerUpdate(assetJS: any) {
        return (
            <Panel
                header={
                    <Translate content="account.user_issued_assets.update_owner" />
                }
            >
                <Translate
                    component="p"
                    content="account.user_issued_assets.update_owner_text"
                    asset={assetJS.symbol}
                />
                <AssetOwnerUpdate
                    asset={assetJS}
                    account={currentAccount}
                    currentOwner={assetJS.issuer}
                />
            </Panel>
        );
    }

    function renderFeedPublish(assetJS: any) {
        return (
            <Panel
                header={
                    <Translate content="transaction.trxTypes.asset_publish_feed" />
                }
            >
                <Translate
                    component="p"
                    content="explorer.asset.feed_producer_text"
                />
                <AssetPublishFeed
                    asset={assetJS.id}
                    account={currentAccount}
                    currentOwner={assetJS.issuer}
                />
            </Panel>
        );
    }

    function renderCollateralBid(assetJS: any) {
        return (
            <Panel
                header={<Translate content="explorer.asset.collateral.bid" />}
            >
                <Translate
                    component="p"
                    content="explorer.asset.collateral.bid_text"
                    asset={assetJS.symbol}
                />

                <Translate
                    component="p"
                    content="explorer.asset.settlement.gs_included_on_revival"
                />

                <Translate
                    component="p"
                    content="explorer.asset.collateral.remove_bid"
                />

                <BidCollateralOperation
                    asset={assetJS.symbol}
                    core={assetJS.bitasset.options.short_backing_asset}
                    funderAccountName={currentAccount}
                    onUpdate={updateOnCollateralBid}
                    hideBalance
                />
            </Panel>
        );
    }

    function renderFeePoolFunding(assetJS: any) {
        return (
            <Panel
                header={<Translate content="explorer.asset.fee_pool.fund" />}
            >
                <Translate
                    component="p"
                    content="explorer.asset.fee_pool.fund_text"
                    asset={assetJS.symbol}
                />
                <FeePoolOperation
                    asset={assetJS.symbol}
                    funderAccountName={currentAccount}
                    hideBalance
                />
            </Panel>
        );
    }

    function renderFeePoolClaiming(assetJS: any) {
        let dynamic: any = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        return (
            <Panel
                header={
                    <Translate content="explorer.asset.fee_pool.claim_balance" />
                }
            >
                <FeePoolOperation
                    asset={assetJS.symbol}
                    funderAccountName={currentAccount}
                    dynamic={dynamic}
                    hideBalance
                    type="claim"
                />
            </Panel>
        );
    }

    function renderFeesClaiming(assetJS: any) {
        let dynamic: any = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        return (
            <Panel
                header={
                    <Translate content="transaction.trxTypes.asset_claim_fees" />
                }
            >
                <FeePoolOperation
                    asset={assetJS.symbol}
                    dynamic={dynamic}
                    funderAccountName={currentAccount}
                    hideBalance
                    type="claim_fees"
                />
            </Panel>
        );
    }
    function renderFeesCollateralClaiming(assetJS: any) {
        let dynamic: any = getDynamicObject(assetJS.dynamic_asset_data_id);
        if (dynamic) dynamic = dynamic.toJS();
        return (
            <Panel
                header={
                    <Translate content="explorer.asset.fee_pool.accumulated_collateral_fees" />
                }
            >
                <FeePoolOperation
                    asset={assetJS.symbol}
                    dynamic={dynamic}
                    funderAccountName={currentAccount}
                    hideBalance
                    type="claim_collateral_fees"
                />
            </Panel>
        );
    }
    // TODO: Blacklist Authorities: <Account list like Voting>
    // TODO: Blacklist Market: Base/Market, Base/Market
    function renderPermissions(assetJS: any) {
        const options = assetJS.options;

        const permissionBooleans = (assetUtils as any).getFlagBooleans(
            assetJS.options.issuer_permissions,
            asset.has("bitasset_data_id")
        );

        const bitNames = Object.keys(permissionBooleans);

        // options.max_market_fee initially a string
        const maxMarketFee = permissionBooleans["charge_market_fee"] ? (
            <tr>
                <td>
                    <Translate content="explorer.asset.permissions.max_market_fee" />
                </td>
                <td>
                    <FormattedAsset
                        amount={+options.max_market_fee}
                        asset={assetJS.id}
                    />
                </td>
            </tr>
        ) : null;

        // options.max_supply initially a string
        const maxSupply = (
            <tr>
                <td>
                    <Translate content="explorer.asset.permissions.max_supply" />
                </td>
                <td>
                    <FormattedAsset
                        amount={+options.max_supply}
                        asset={assetJS.id}
                    />
                </td>
            </tr>
        );

        const whiteLists = permissionBooleans["white_list"] ? (
            <div>
                <br />
                {!!options.blacklist_authorities &&
                    !!options.blacklist_authorities.length && (
                        <React.Fragment>
                            <Translate content="explorer.asset.permissions.blacklist_authorities" />
                            : &nbsp;
                            {renderAuthorityList(
                                options.blacklist_authorities
                            )}
                        </React.Fragment>
                    )}
                {!!options.blacklist_markets &&
                    !!options.blacklist_markets.length && (
                        <React.Fragment>
                            <br />
                            <Translate content="explorer.asset.permissions.blacklist_markets" />
                            : &nbsp;
                            {renderMarketList(
                                assetJS,
                                options.blacklist_markets
                            )}
                        </React.Fragment>
                    )}
                {!!options.whitelist_authorities &&
                    !!options.whitelist_authorities.length && (
                        <React.Fragment>
                            <br />
                            <Translate content="explorer.asset.permissions.whitelist_authorities" />
                            : &nbsp;
                            {renderAuthorityList(
                                options.whitelist_authorities
                            )}
                        </React.Fragment>
                    )}
                {!!options.whitelist_markets &&
                    !!options.whitelist_markets.length && (
                        <React.Fragment>
                            <br />
                            <Translate content="explorer.asset.permissions.whitelist_markets" />
                            : &nbsp;
                            {renderMarketList(
                                assetJS,
                                options.whitelist_markets
                            )}
                        </React.Fragment>
                    )}
            </div>
        ) : null;

        const whitelist_market_fee_sharing = assetJS.options.extensions
            .whitelist_market_fee_sharing && (
            <React.Fragment>
                <br />
                <Translate content="explorer.asset.permissions.accounts_in_whitelist_market_fee_sharing" />
                : &nbsp;
                {renderAuthorityList(
                    assetJS.options.extensions.whitelist_market_fee_sharing
                )}
            </React.Fragment>
        );

        return (
            <Panel
                header={
                    <Translate content="explorer.asset.permissions.title" />
                }
            >
                <div>
                    <table
                        className="table key-value-table table-hover"
                        style={{padding: "1.2rem"}}
                    >
                        <tbody>
                            {maxMarketFee}
                            {maxSupply}
                        </tbody>
                    </table>

                    <br />
                    {renderPermissionIndicators(permissionBooleans, bitNames)}
                    <br />

                    {whiteLists}
                    {whitelist_market_fee_sharing}
                </div>
            </Panel>
        );
    }

    // the global settlement price is defined as the
    // the price at which the least collateralize short's
    // collateral no longer enough to back the debt
    // he/she owes.
    function getGlobalSettlementPrice(mssr = 1) {
        if (!callOrders) {
            return null;
        }

        // first get the least collateralized short position
        let leastColShort: any = null;
        let leastColShortRatio: any = null;
        const len = callOrders.length;
        for (let i = 0; i < len; i++) {
            const call_order = callOrders[i];

            if (leastColShort == null) {
                leastColShort = call_order;
                leastColShortRatio = call_order.getRatio();
            } else if (call_order.getRatio() < leastColShortRatio) {
                leastColShortRatio = call_order.getRatio();
                leastColShort = call_order;
            }
        }

        if (leastColShort == null) {
            // couldn't find the least colshort?
            return null;
        }

        // this price will happen when the CR is 1.
        // The CR is 1 if collateral / (debt x feed_ price) == 1
        // Rearranging, this means that the CR is 1 if
        // feed_price == collateral / debt
        //
        // Default is to return the global settlement price
        // Use mssr to calculate in when an event happens
        // based on an assets MSSR

        const debt = leastColShort.debt * mssr;
        const collateral = leastColShort.collateral;

        return (
            <FormattedPrice
                base_amount={collateral}
                base_asset={leastColShort.call_price.base.asset_id}
                quote_amount={debt}
                quote_asset={leastColShort.call_price.quote.asset_id}
            />
        );
    }

    function renderFeedTable(assetJS: any) {
        const bitAsset = assetJS.bitasset;
        if (
            !("feeds" in bitAsset) ||
            bitAsset.feeds.length == 0 ||
            bitAsset.is_prediction_market ||
            !bitAsset.feeds.length
        ) {
            return null;
        }

        let feeds = bitAsset.feeds;
        const feed_price_header = (assetUtils as any).extractRawFeedPrice(
            feeds[0][1][1]
        );
        const core_exchange_rate_header = feeds[0][1][1].core_exchange_rate;

        // Filter by valid feed lifetime, Sort by published date
        const now = new Date().getTime();
        const oldestValidDate = new Date(
            now - assetJS.bitasset.options.feed_lifetime_sec * 1000
        );
        feeds = feeds
            .filter((a: any) => {
                return new Date(a[1][0]) > oldestValidDate;
            })
            .sort(function(feed1: any, feed2: any) {
                return (
                    (new Date(feed2[1][0]) as any) -
                    (new Date(feed1[1][0]) as any)
                );
            });

        const currentFeed = (assetUtils as any).extractRawFeedPrice(assetJS);
        const currentFeedPrice =
            currentFeed.base.amount / currentFeed.quote.amount;

        const dataSource: any[] = [];

        const columns = [
            {
                key: "publisher",
                fixed: "left",
                width: 150,
                title: (
                    <Translate content="explorer.asset.price_feed_data.publisher" />
                ),
                dataIndex: "publisher",
                sorter: (a: any, b: any) => {
                    let nameA: any = ChainStore.getAccount(a.publisher, false);
                    if (nameA) nameA = nameA.get("name");
                    let nameB: any = ChainStore.getAccount(b.publisher, false);
                    if (nameB) nameB = nameB.get("name");
                    if (nameA > nameB) return 1;
                    if (nameA < nameB) return -1;
                    return 0;
                },
                render: (item: any) => {
                    return <LinkToAccountById account={item} />;
                }
            },
            {
                key: "feed_price",
                title: (
                    <React.Fragment>
                        <Translate content="explorer.asset.price_feed_data.feed_price" />{" "}
                        ({formattedPrice(feed_price_header, false, true)})
                    </React.Fragment>
                ),
                dataIndex: "feed_price",
                sorter: (a: any, b: any) => {
                    const a_price = parseFloat(
                        (a.feed_price.base.amount /
                            a.feed_price.quote.amount) as any
                    );
                    const b_price = parseFloat(
                        (b.feed_price.base.amount /
                            b.feed_price.quote.amount) as any
                    );

                    if (a_price > b_price) return 1;
                    if (a_price < b_price) return -1;
                    return 0;
                },
                render: (item: any) => {
                    const price = parseFloat(
                        (item.base.amount / item.quote.amount) as any
                    );
                    const median_offset = (
                        (price / currentFeedPrice) * 100 -
                        100
                    ).toFixed(2);
                    return (
                        <React.Fragment>
                            {formattedPrice(item, true)}(
                            <span
                                className={
                                    (median_offset as any) > 0
                                        ? "txtlabel success"
                                        : (median_offset as any) < 0
                                        ? "txtlabel warning"
                                        : "txtlabel"
                                }
                            >
                                {median_offset}%
                            </span>
                            )
                        </React.Fragment>
                    );
                }
            },
            {
                key: "core_exchange_rate",
                title: (
                    <React.Fragment>
                        <Translate content="explorer.asset.price_feed_data.core_exchange_rate" />{" "}
                        (
                        {formattedPrice(
                            core_exchange_rate_header,
                            false,
                            true
                        )}
                        )
                    </React.Fragment>
                ),
                dataIndex: "core_exchange_rate",
                render: (item: any) => {
                    return formattedPrice(item, true);
                }
            },
            {
                key: "maintenance_collateral_ratio",
                title: (
                    <Translate content="explorer.asset.price_feed_data.maintenance_collateral_ratio" />
                ),
                dataIndex: "maintenance_collateral_ratio",
                render: (item: any) => {
                    return item;
                }
            },
            {
                key: "maximum_short_squeeze_ratio",
                title: (
                    <Translate content="explorer.asset.price_feed_data.maximum_short_squeeze_ratio" />
                ),
                dataIndex: "maximum_short_squeeze_ratio",
                render: (item: any) => {
                    return item;
                }
            },
            {
                key: "publishDate",
                fixed: "right",
                width: 150,
                title: (
                    <Translate content="explorer.asset.price_feed_data.published" />
                ),
                dataIndex: "publishDate",
                sorter: (a: any, b: any) => {
                    if (a.publishDate.getTime() > b.publishDate.getTime())
                        return 1;
                    if (a.publishDate.getTime() < b.publishDate.getTime())
                        return -1;
                    return 0;
                },
                render: (item: any) => {
                    return <TimeAgo time={item} />;
                }
            }
        ];

        for (let i = 0; i < feeds.length; i++) {
            const feed = feeds[i];
            const publisher = feed[0];
            const publishDate = new Date(feed[1][0] + "Z");
            const feed_price = (assetUtils as any).extractRawFeedPrice(
                feed[1][1]
            );
            const core_exchange_rate = feed[1][1].core_exchange_rate;
            const maintenance_collateral_ratio =
                "" + feed[1][1].maintenance_collateral_ratio / 1000;
            const maximum_short_squeeze_ratio =
                "" + feed[1][1].maximum_short_squeeze_ratio / 1000;

            dataSource.push({
                publisher: publisher,
                feed_price: feed_price,
                core_exchange_rate: core_exchange_rate,
                maintenance_collateral_ratio: maintenance_collateral_ratio,
                maximum_short_squeeze_ratio: maximum_short_squeeze_ratio,
                publishDate: publishDate
            });
        }

        return (
            <Table
                style={{width: "100%"}}
                rowKey="feedPublisher"
                columns={columns}
                dataSource={dataSource}
                pagination={false}
                locale={{
                    emptyText: (
                        <Translate content="explorer.asset.price_feed_data.empty" />
                    )
                }}
            />
        );
    }

    function renderMarginTable() {
        let columns: any[] = [];
        const dataSource: any[] = [];

        if (callOrders && callOrders.length > 0) {
            const cummulativeSuffix = cumulativeGrouping ? (
                <span>
                    &nbsp;(
                    <Translate content="explorer.asset.cumulative" />)
                </span>
            ) : (
                <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            );

            let debt_cum = 0;
            let coll_cum = 0;

            callOrders.map(c => {
                debt_cum += c.debt;
                coll_cum += c.collateral;

                dataSource.push({
                    borrower: c.borrower,
                    collateral: {
                        amount: cumulativeGrouping ? coll_cum : c.collateral,
                        asset: c.getCollateral().asset_id
                    },
                    debt: {
                        amount: cumulativeGrouping ? debt_cum : c.debt,
                        asset: c.amountToReceive().asset_id
                    },
                    call: c.call_price,
                    tcr: c.order.target_collateral_ratio,
                    cr: {
                        ratio: c.getRatio(),
                        status: c.getStatus()
                    }
                });
            });
            const unitInfo = (key: string) => {
                const item = (dataSource[0] as any)[key];
                return dataSource.length ? (
                    <span>
                        <br />
                        {item.base ? (
                            formattedPrice(item, false, true)
                        ) : (
                            <FormattedAsset
                                asset={item.asset}
                                amount={item.amount}
                                hide_amount={true}
                            />
                        )}
                    </span>
                ) : null;
            };

            columns = [
                {
                    key: "borrower",
                    fixed: "left",
                    width: 200,
                    title: <Translate content="transaction.borrower" />,
                    dataIndex: "borrower",
                    sorter: (a: any, b: any) => {
                        let nameA: any = ChainStore.getAccount(
                            a.borrower,
                            false
                        );
                        if (nameA) nameA = nameA.get("name");
                        let nameB: any = ChainStore.getAccount(
                            b.borrower,
                            false
                        );
                        if (nameB) nameB = nameB.get("name");
                        if (nameA > nameB) return 1;
                        if (nameA < nameB) return -1;
                        return 0;
                    },
                    render: (item: any) => {
                        return <LinkToAccountById account={item} />;
                    }
                },
                {
                    key: "collateral",
                    title: (
                        <React.Fragment>
                            <Translate content="transaction.collateral" />
                            {cummulativeSuffix}
                            {unitInfo("collateral")}
                        </React.Fragment>
                    ),
                    dataIndex: "collateral",
                    sorter: (a: any, b: any) => {
                        if (a.collateral.amount > b.collateral.amount)
                            return 1;
                        if (a.collateral.amount < b.collateral.amount)
                            return -1;
                        return 0;
                    },
                    render: (item: any) => {
                        return (
                            <Tooltip
                                title={counterpart.translate(
                                    "explorer.asset.margin_positions.click_to_switch_to_cumulative"
                                )}
                                mouseEnterDelay={0.5}
                            >
                                <span
                                    onClick={toggleCumulativeGrouping}
                                    style={{cursor: "pointer"}}
                                >
                                    <FormattedAsset
                                        amount={item.amount}
                                        asset={item.asset}
                                        hide_asset={true}
                                    />
                                </span>
                            </Tooltip>
                        );
                    }
                },
                {
                    key: "debt",
                    title: (
                        <React.Fragment>
                            <Translate content="transaction.borrow_amount" />
                            {cummulativeSuffix}
                            {unitInfo("debt")}
                        </React.Fragment>
                    ),
                    dataIndex: "debt",
                    sorter: (a: any, b: any) => {
                        if (a.debt.amount > b.debt.amount) return 1;
                        if (a.debt.amount < b.debt.amount) return -1;
                        return 0;
                    },
                    render: (item: any) => {
                        return (
                            <div
                                onClick={toggleCumulativeGrouping}
                                style={{cursor: "pointer"}}
                            >
                                <Tooltip
                                    title={counterpart.translate(
                                        "explorer.asset.margin_positions.click_to_switch_to_cumulative"
                                    )}
                                    mouseEnterDelay={0.5}
                                >
                                    <FormattedAsset
                                        amount={item.amount}
                                        asset={item.asset}
                                        hide_asset={true}
                                    />
                                </Tooltip>
                            </div>
                        );
                    }
                },

                {
                    key: "call",
                    title: (
                        <span>
                            <Translate content="exchange.call" />
                            {unitInfo("call")}
                        </span>
                    ),
                    dataIndex: "call",
                    render: (item: any) => {
                        return formattedPrice(item, true, false);
                    }
                },
                {
                    key: "tcr",
                    title: (
                        <Tooltip
                            title={counterpart.translate(
                                "borrow.target_collateral_ratio_explanation"
                            )}
                        >
                            <Translate content="borrow.target_collateral_ratio_short" />
                        </Tooltip>
                    ),
                    dataIndex: "tcr",
                    render: (item: any) => {
                        return !!item ? (item / 1000).toFixed(3) : "-";
                    }
                },
                {
                    key: "cr",
                    title: <Translate content="borrow.coll_ratio" />,
                    dataIndex: "cr",
                    fixed: "right",
                    width: 100,
                    sorter: (a: any, b: any) => {
                        if (a.cr.ratio > b.cr.ratio) return 1;
                        if (a.cr.ratio < b.cr.ratio) return -1;
                        return 0;
                    },
                    render: (item: any) => {
                        const classNames = "margin-ratio " + item.status;

                        return (
                            <React.Fragment>
                                <div className={classNames}>
                                    {item.ratio.toFixed(3)}
                                </div>
                            </React.Fragment>
                        );
                    }
                }
            ];
        }

        return (
            <Table
                style={{width: "100%"}}
                rowKey="borrower"
                columns={columns}
                dataSource={dataSource}
                rowClassName="margin-row"
                pagination={{
                    pageSize: Number(25)
                }}
                locale={{
                    emptyText: (
                        <Translate content="explorer.asset.margin_positions.empty" />
                    )
                }}
            />
        );
    }

    function renderCollBidTable() {
        const dataSource: any[] = [];

        const columns = [
            {
                key: "bidder",
                title: <Translate content="transaction.bidder" />,
                dataIndex: "bidder",
                fixed: "left",
                width: 200,
                render: (item: any) => {
                    return <LinkToAccountById account={item} />;
                }
            },
            {
                key: "collateral",
                title: <Translate content="transaction.collateral" />,
                dataIndex: "collateral",
                render: (item: any) => {
                    return (
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                            hide_asset
                        />
                    );
                }
            },
            {
                key: "debt",
                title: <Translate content="transaction.borrow_amount" />,
                dataIndex: "debt",
                render: (item: any) => {
                    return (
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                            hide_asset
                        />
                    );
                }
            },
            {
                key: "debt_cum",
                title: (
                    <Translate content="transaction.cumulative_borrow_amount" />
                ),
                dataIndex: "debt_cum",
                render: (item: any) => {
                    return (
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                            hide_asset
                        />
                    );
                }
            },
            {
                key: "price",
                title: (
                    <Translate content="explorer.asset.collateral_bid.bid" />
                ),
                dataIndex: "price",
                render: (item: any) => {
                    return (
                        <FormattedPrice
                            base_amount={item.base.amount}
                            base_asset={item.base.asset_id}
                            quote_amount={item.quote.amount}
                            quote_asset={item.quote.asset_id}
                            hide_symbols
                        />
                    );
                }
            },
            {
                key: "cr",
                title: <Translate content="borrow.coll_ratio" />,
                dataIndex: "cr",
                render: (item: any) => {
                    return item.toFixed(3);
                }
            },
            {
                key: "included",
                title: <Translate content="borrow.considered_on_revival" />,
                dataIndex: "included",
                render: (item: any) => {
                    if (item == 2)
                        return (
                            <Translate content="explorer.asset.collateral_bid.included.partial" />
                        );
                    else if (item == 1)
                        return (
                            <Translate content="explorer.asset.collateral_bid.included.yes" />
                        );
                    else
                        return (
                            <Translate content="explorer.asset.collateral_bid.included.no" />
                        );
                }
            }
        ];

        let debt_cum = 0;
        collateralBids.map(c => {
            debt_cum += c.debt;

            dataSource.push({
                bidder: c.bidder,
                collateral: {
                    amount: c.bid.base.amount,
                    asset: c.bid.base.asset_id
                },
                debt: {
                    amount: c.bid.quote.amount,
                    asset: c.bid.quote.asset_id
                },
                debt_cum: {
                    amount: debt_cum,
                    asset: c.bid.quote.asset_id
                },
                price: c.bid,
                cr: c.getRatio(),
                included: c.consideredIfRevived
            });
        });

        return (
            <Table
                style={{width: "100%"}}
                rowKey="feedCollBid"
                columns={columns}
                dataSource={dataSource}
                pagination={{
                    pageSize: Number(25)
                }}
                locale={{
                    emptyText: (
                        <Translate content="explorer.asset.collateral_bid.empty" />
                    )
                }}
            />
        );
    }

    function renderFeedTables(assetJS: any) {
        const bitAsset = assetJS.bitasset;
        if (
            !("feeds" in bitAsset) ||
            bitAsset.feeds.length == 0 ||
            bitAsset.is_prediction_market ||
            !bitAsset.feeds.length
        ) {
            return null;
        }

        const isGlobalSettlement = bitAsset.settlement_fund > 0 ? true : false;

        return (
            <Tabs onChange={setActiveFeedTab} activeKey={activeFeedTab}>
                <Tabs.TabPane
                    tab={counterpart.translate(
                        isGlobalSettlement
                            ? "explorer.asset.collateral_bid.title"
                            : "explorer.asset.margin_positions.title"
                    )}
                    key="margin"
                >
                    {activeFeedTab == "margin"
                        ? isGlobalSettlement
                            ? renderCollBidTable()
                            : renderMarginTable()
                        : null}
                </Tabs.TabPane>
                <Tabs.TabPane
                    tab={counterpart.translate(
                        "explorer.asset.price_feed_data.title"
                    )}
                    key="feed"
                >
                    {activeFeedTab == "feed" ? renderFeedTable(assetJS) : null}
                </Tabs.TabPane>
            </Tabs>
        );
    }

    function renderAssetResolvePrediction(assetJS: any) {
        return (
            <Panel
                header={
                    <Translate content="account.user_issued_assets.resolve_prediction" />
                }
            >
                <Translate
                    component="p"
                    content="account.user_issued_assets.resolve_prediction_text"
                />
                <AssetResolvePrediction
                    asset={assetJS}
                    account={currentAccount}
                />
            </Panel>
        );
    }

    if (backingAsset === null) {
        return <Page404 subtitle="asset_not_found_subtitle" />;
    }
    if (!backingAsset.get || !coreAsset.get) {
        return null;
    }

    const assetJS = asset.toJS();
    const priceFeed = "bitasset" in assetJS ? renderPriceFeed(assetJS) : null;
    const priceFeedData =
        "bitasset" in assetJS ? renderFeedTables(assetJS) : null;

    return (
        <div className="grid-container asset-page">
            <div className="grid-block page-layout">
                <div className="grid-block main-content wrap">
                    <div
                        className="grid-block medium-up-1"
                        style={{width: "100%"}}
                    >
                        {renderAboutBox(assetJS, asset)}
                    </div>

                    <Tabs
                        onChange={setActiveAssetTab}
                        activeKey={activeAssetTab}
                        className="grid-block vertical"
                    >
                        <Tabs.TabPane
                            tab={counterpart.translate("explorer.asset.info")}
                            key="info"
                        >
                            <div
                                className="grid-block vertical large-horizontal medium-up-1 large-up-2"
                                style={{paddingTop: "1rem"}}
                            >
                                <div className="grid-content small-no-padding">
                                    {renderSummary(assetJS)}
                                </div>
                                <div>
                                    <Collapse className="asset-collapse">
                                        {renderPermissions(assetJS)}

                                        {renderFeePool(assetJS)}

                                        {priceFeed
                                            ? renderPriceFeed(assetJS)
                                            : null}

                                        {priceFeed
                                            ? renderSettlement(assetJS)
                                            : null}

                                        {showCollateralBidInInfo
                                            ? renderCollateralBid(assetJS)
                                            : null}
                                    </Collapse>
                                </div>
                            </div>
                            {priceFeedData ? priceFeedData : null}
                        </Tabs.TabPane>
                        <Tabs.TabPane
                            tab={counterpart.translate(
                                "explorer.asset.actions"
                            )}
                            key="actions"
                        >
                            <Collapse className="asset-collapse">
                                {renderFeePoolFunding(assetJS)}
                                {renderFeePoolClaiming(assetJS)}
                                {renderFeesClaiming(assetJS)}
                                {renderFeesCollateralClaiming(assetJS)}
                                {renderAssetOwnerUpdate(assetJS)}
                                {"bitasset" in assetJS &&
                                    !assetJS.bitasset.is_prediction_market &&
                                    renderFeedPublish(assetJS)}
                                {collateralBids.length > 0 &&
                                    renderCollateralBid(assetJS)}
                                {"bitasset" in assetJS &&
                                    assetJS.bitasset.is_prediction_market &&
                                    renderAssetResolvePrediction(assetJS)}
                            </Collapse>
                        </Tabs.TabPane>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

function AssetContainer({assetSymbol}: {assetSymbol: string}) {
    useChainStoreTick();
    const accountState = useAltStore<any>(AccountStore);
    const currentAccount =
        accountState.currentAccount || accountState.passwordAccount;

    const asset: any = ChainStore.getAsset(assetSymbol);

    if (asset === null) {
        return <Page404 subtitle="asset_not_found_subtitle" />;
    }
    if (!asset || !asset.get) {
        return null;
    }

    const backingAssetId = asset.has("bitasset")
        ? asset.getIn(["bitasset", "options", "short_backing_asset"])
        : "1.3.0";
    const backingAsset: any = ChainStore.getAsset(backingAssetId);
    const coreAsset: any = ChainStore.getAsset("1.3.0");

    function getDynamicObject(id: string) {
        return ChainStore.getObject(id);
    }

    return (
        <Asset
            asset={asset}
            backingAsset={backingAsset}
            coreAsset={coreAsset}
            currentAccount={currentAccount}
            getDynamicObject={getDynamicObject}
        />
    );
}

export default function AssetSymbolSplitter() {
    const {symbol} = useParams<{symbol: string}>();
    return <AssetContainer assetSymbol={symbol.toUpperCase()} />;
}
