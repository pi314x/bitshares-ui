// TypeScript/functional-component port of the legacy AccountAssetUpdate.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md) - the last file in Phase 3. The
// "update an existing user-issued asset" form: primary details/CER,
// whitelist, description, optional bitAsset (MPA) options, permissions,
// flags, and feed producers. `_updateAsset` (here `updateAsset`) builds
// and submits the real `asset_update` transaction itself, via
// `AssetActions.updateAsset`, reused unchanged - same care as its sibling
// `AccountAssetCreate.tsx`.
//
// State-management design: the same `useRef`-holds-the-whole-state-object
// + `useForceUpdate` + `updateState(partial)` (`Object.assign` into the
// ref, then force a re-render) pattern established for
// `AccountAssetCreate.tsx`, for the same reason - this class also mixes
// direct in-place mutation-then-`forceUpdate()` (`_onUpdateDescription`,
// `onChangeBitAssetOpts`, `_onCoreRateChange`) with genuine
// `setState(partial)` calls throughout, and nothing here ever compares
// the whole state object by reference.
//
// This file's `errors` state field is *fully replaced*, never merged,
// every time it's set (`_validateEditFields` always builds a complete
// fresh 6-key object; the `max_market_fee`-too-large branch in
// `_onUpdateInput` sets `errors` to a bare `{max_market_fee: "..."}`,
// discarding whatever other error fields were previously set) - preserved
// exactly via `updateState({errors: {...}})`, a full-key overwrite, not a
// deep merge, matching `Object.assign`/real `setState`'s behavior for a
// top-level key precisely.
//
// Structural change (same substitution used throughout this migration):
// `BindToChainState(AccountAssetUpdate)` (`globalObject`) and
// `AssetWrapper(AccountAssetUpdate, {propNames: ["asset", "core"],
// withDynamic: true})` (resolving `asset`/`core` from symbol/id strings,
// both `.isRequired`, plus providing a `getDynamicObject` helper via the
// nested `DynamicObjectResolver`) are collapsed into one
// `AccountAssetUpdateContainer` resolving all three via `ChainStore`
// under `useChainStoreTick()`, gated behind a `<span/>` placeholder until
// all three resolve. `getDynamicObject(id)` is implemented as a direct
// `ChainStore.getObject(id)` read - the same simplification already
// validated for `Asset.tsx`/`AssetContainer` (`DynamicObjectResolver`'s
// own `getDynamicObject` just searches a `ChainObjectsList`-resolved
// array for a matching `.get("id")`, which resolves through
// `ChainStore.getObject` under the hood for the same id anyway, so a
// direct read returns the identical object). The outer route-level
// `AssetUpdateWrapper` (`withRouter`, reading `match.params.asset`)
// becomes a plain function reading the same route param with
// `useParams()`, the same substitution already used for
// `Asset.tsx`/`AssetSymbolSplitter` - `history`/`location`/`match` were
// never read anywhere else in this file, only in that one spot.
//
// Confirmed dead, dropped (verified by reading the whole file):
// `_onClaimInput` and the `claimFeesAmount` state field it wrote to -
// `claimFeesAmount` is destructured in `render()` but never read
// afterward, `_onClaimInput` itself is never bound to any JSX element,
// and `claimFeesAmount` is not among the arguments passed to
// `AssetActions.updateAsset`. Also dropped: the `ref="appTables"` on the
// render root (never read via `this.refs`); `ConfirmModal`'s `showModal`
// and `_cancelConfirm` props (both passed by the parent, neither ever
// read inside `ConfirmModal` - the latter's own wrapper method,
// `_cancelConfirm`, is dropped too, since passing it to `ConfirmModal`
// was its only use); and the blanket `{...this.props}` spread onto
// `<ConfirmModal>` (`ConfirmModal` only ever reads
// `visible`/`tabsChanged`/`hideModal`/`_updateAsset` - verified by
// reading its whole render body - so every other spread
// prop, e.g. `asset`/`account`/`core`, was inert there).
//
// `_onInputCoreAsset`/`_onFoundCoreAsset` are the *live* counterparts of
// the same-named methods confirmed fully dead in the sibling
// `AccountAssetCreate.tsx` - here they're actively wired to the
// quote/base `AssetSelector`s (rendered whenever the CER isn't already
// valid for this asset). `_onFoundCoreAsset`'s pre-existing bug is
// preserved exactly because of that liveness: it calls
// `_validateEditFields({max_supply: this.state.max_supply, ...})`,
// reading a top-level `state.max_supply` that never exists (the real
// field is nested at `state.update.max_supply`) - so selecting a new
// quote/base asset always resets the max-supply error to "too large"
// regardless of the actual value. The same pre-existing bug is triggered
// the same way, for the same reason, by `_onFlagChange` (calls
// `_validateEditFields({})`) and `onChangeFeedProducerList` (calls
// `_validateEditFields({feedProducers: current})`) - neither passes a
// `max_supply` key either. All three preserved byte-for-byte.
//
// `onChangeTab` (`<Tabs onChangeTab={i => this.setState({activeTab: i})}>`)
// sets an `activeTab` field that is written but never read anywhere else
// in the file - not dropped as dead code, though, since the `setState`
// call itself has a real, if easy-to-miss, observable effect: it forces
// a fresh `render()` pass on every tab switch (independent of chain-store
// driven re-renders), which re-evaluates `tabsChanged()`/`assetChanged()`
// and friends. Preserved as `stateRef.current.activeTab = i; forceUpdate();`.
//
// A stale, already-superseded commented-out overflow-check block inside
// `_onUpdateInput`'s `max_supply` case (fully commented out, describing
// behavior the surrounding live code doesn't implement - the same
// category of drop as `AccountAssetCreate.tsx`'s equivalent) is likewise
// omitted as informationally inert.
//
// `_updateAsset`'s delayed reset (`setTimeout(() => {... this.setState(
// this.resetState(this.props)) ...}, 3000)`) reads `this.props` at
// *fire* time in the original, which - since `this` is a live class
// instance - always reflects whatever props are current 3 seconds later,
// not whatever they were when the button was clicked. Replicated with a
// small ref that's updated on every render to hold the latest
// `asset`/`core`/`globalObject`/`account`, read by the timeout callback
// instead of the closure's own (potentially 3-seconds-stale) values -
// the closest hooks equivalent to a class's always-current `this.props`.
import * as React from "react";
import {useParams} from "react-router-dom";
import Translate from "react-translate-component";
import classnames from "classnames";
import AssetActions from "actions/AssetActions";
import HelpContent from "../Utility/HelpContent";
import utils from "common/utils";
import {ChainStore} from "bitsharesjs";
import FormattedFee from "../Utility/FormattedFee";
import counterpart from "counterpart";
import AmountSelector from "../Utility/AmountSelector";
import FormattedPrice from "../Utility/FormattedPrice";
import AssetSelector from "../Utility/AssetSelector";
import big from "bignumber.js";
import cnames from "classnames";
import assetUtils from "common/asset_utils";
import {Tabs, Tab} from "../Utility/Tabs";
import {BitAssetOptions} from "./AccountAssetCreate";
import assetConstants from "chain/asset_constants";
import AssetWhitelist from "./AssetWhitelist";
import AssetFeedProducers from "./AssetFeedProducers";
import {
    Modal,
    Button,
    Notification,
    Switch,
    Tooltip
} from "bitshares-ui-style-guide";
import Immutable from "immutable";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const GRAPHENE_MAX_SHARE_SUPPLY = new (big as any)(
    (assetConstants as any).GRAPHENE_MAX_SHARE_SUPPLY
);

const disabledBackingAssetChangeCallback = () => {
    (Notification as any).error({
        message: counterpart.translate(
            "account.user_issued_assets.invalid_backing_asset_change"
        )
    });
};

function useForceUpdate() {
    const [, setTick] = React.useState(0);
    return React.useCallback(() => setTick((t: number) => t + 1), []);
}

function resetState(props: any) {
    const asset = props.asset.toJS();
    const isBitAsset = asset.bitasset_data_id !== undefined;
    const precision = (utils as any).get_asset_precision(asset.precision);
    const corePrecision = (utils as any).get_asset_precision(
        props.core.get("precision")
    );

    const max_market_fee = new (big as any)(asset.options.max_market_fee)
        .div(precision)
        .toString();
    const max_supply = new (big as any)(asset.options.max_supply)
        .div(precision)
        .toString();
    const core_exchange_rate = asset.options.core_exchange_rate;
    core_exchange_rate.quote.amount =
        core_exchange_rate.quote.asset_id === asset.id
            ? new (big as any)(core_exchange_rate.quote.amount)
                  .div(precision)
                  .toString()
            : new (big as any)(core_exchange_rate.quote.amount)
                  .div(corePrecision)
                  .toString();

    core_exchange_rate.base.amount =
        core_exchange_rate.base.asset_id === asset.id
            ? new (big as any)(core_exchange_rate.base.amount)
                  .div(precision)
                  .toString()
            : new (big as any)(core_exchange_rate.base.amount)
                  .div(corePrecision)
                  .toString();

    const flagBooleans = (assetUtils as any).getFlagBooleans(
        asset.options.flags,
        isBitAsset
    );
    const permissionBooleans = (assetUtils as any).getFlagBooleans(
        asset.options.issuer_permissions,
        isBitAsset
    );
    asset.options.market_fee_percent /= 100;

    if (
        asset.options.extensions !== null &&
        asset.options.extensions.reward_percent !== null
    ) {
        asset.options.extensions.reward_percent /= 100;
    }

    if (
        asset.options.extensions !== null &&
        asset.options.extensions.taker_fee_percent !== null
    ) {
        asset.options.extensions.taker_fee_percent /= 100;
    }

    const coreRateQuoteAssetName = (ChainStore as any)
        .getAsset(core_exchange_rate.quote.asset_id)
        .get("symbol");
    const coreRateBaseAssetName = (ChainStore as any)
        .getAsset(core_exchange_rate.base.asset_id)
        .get("symbol");

    // maybe undefined (extensions may be empty
    const whitelist_market_fee_sharing_val = props.asset.getIn([
        "options",
        "extensions",
        "whitelist_market_fee_sharing"
    ]);
    const reward_percent = props.asset.getIn([
        "options",
        "extensions",
        "reward_percent"
    ]);
    const taker_fee_percent = props.asset.getIn([
        "options",
        "extensions",
        "taker_fee_percent"
    ]);

    return {
        isAssetUpdateConfirmationModalVisible: false,
        activeTab: undefined as any,
        update: {
            max_supply: max_supply,
            max_market_fee: max_market_fee,
            reward_percent:
                reward_percent === undefined
                    ? undefined
                    : asset.options.extensions.reward_percent,
            taker_fee_percent:
                taker_fee_percent === undefined
                    ? undefined
                    : asset.options.extensions.taker_fee_percent,
            market_fee_percent: asset.options.market_fee_percent,
            description: (assetUtils as any).parseDescription(
                asset.options.description
            )
        } as any,
        core_exchange_rate: core_exchange_rate,
        issuer: asset.issuer,
        new_issuer_account_id: null as any,
        new_funder_account: props.account.get("id"),
        asset_to_update: asset.id,
        errors: {
            max_supply: null
        } as any,
        new_authority_id: null as any,
        authority_name: null as any,
        isValid: true,
        flagBooleans: flagBooleans,
        permissionBooleans: permissionBooleans,
        isBitAsset: isBitAsset,
        coreRateQuoteAssetName: coreRateQuoteAssetName,
        quoteAssetInput: coreRateQuoteAssetName,
        coreRateBaseAssetName: coreRateBaseAssetName,
        baseAssetInput: coreRateBaseAssetName,
        bitasset_opts: isBitAsset ? asset.bitasset.options : null,
        original_bitasset_opts: isBitAsset
            ? props.asset.getIn(["bitasset", "options"]).toJS()
            : null,
        marketInput: "",
        whitelist_authorities: props.asset.getIn([
            "options",
            "whitelist_authorities"
        ]),
        blacklist_authorities: props.asset.getIn([
            "options",
            "blacklist_authorities"
        ]),
        whitelist_markets: props.asset.getIn(["options", "whitelist_markets"]),
        whitelist_market_fee_sharing: whitelist_market_fee_sharing_val,
        blacklist_markets: props.asset.getIn(["options", "blacklist_markets"]),
        maxFeedProducers: props.globalObject.getIn([
            "parameters",
            "maximum_asset_feed_publishers"
        ]),
        feedProducers: isBitAsset
            ? props.asset.getIn(["bitasset", "feeds"], []).map((a: any) => {
                  return a.first();
              })
            : null,
        originalFeedProducers: isBitAsset
            ? props.asset.getIn(["bitasset", "feeds"], []).map((a: any) => {
                  return a.first();
              })
            : null
    };
}

interface AccountAssetUpdateProps {
    asset: any;
    core: any;
    globalObject: any;
    account: any;
}

function AccountAssetUpdateInner({
    asset,
    core,
    globalObject,
    account
}: AccountAssetUpdateProps) {
    const stateRef = React.useRef<any>(resetState({asset, core, globalObject, account}));
    const forceUpdate = useForceUpdate();

    const propsRef = React.useRef({asset, core, globalObject, account});
    propsRef.current = {asset, core, globalObject, account};

    function updateState(partial: any) {
        Object.assign(stateRef.current, partial);
        forceUpdate();
    }

    function getDynamicObject(id: string) {
        return (ChainStore as any).getObject(id);
    }

    function getCurrentSupply() {
        return (
            getDynamicObject &&
            getDynamicObject(asset.get("dynamic_asset_data_id")).get(
                "current_supply"
            )
        );
    }

    function hideAssetUpdateConfirmationModal() {
        updateState({isAssetUpdateConfirmationModalVisible: false});
    }

    function showAssetUpdateConfirmationModal() {
        updateState({isAssetUpdateConfirmationModalVisible: true});
    }

    function openConfirm() {
        showAssetUpdateConfirmationModal();
    }

    // Using JSON.stringify for (fast?) comparsion, could be improved, but seems enough here as the order is fixed
    function assetChanged() {
        const s = stateRef.current;
        const p = resetState({asset, core, globalObject, account});
        return (
            JSON.stringify(s.update) !== JSON.stringify(p.update) ||
            JSON.stringify(s.core_exchange_rate) !==
                JSON.stringify(p.core_exchange_rate) ||
            (s.new_issuer_account_id !== null &&
                s.new_issuer_account_id !== s.issuer) ||
            JSON.stringify(s.flagBooleans) !== JSON.stringify(p.flagBooleans) ||
            JSON.stringify(s.permissionBooleans) !==
                JSON.stringify(p.permissionBooleans) ||
            JSON.stringify(s.whitelist_authorities) !==
                JSON.stringify(p.whitelist_authorities) ||
            JSON.stringify(s.blacklist_authorities) !==
                JSON.stringify(p.blacklist_authorities) ||
            JSON.stringify(s.whitelist_markets) !==
                JSON.stringify(p.whitelist_markets) ||
            JSON.stringify(s.blacklist_markets) !==
                JSON.stringify(p.blacklist_markets) ||
            JSON.stringify(s.whitelist_market_fee_sharing) !==
                JSON.stringify(p.whitelist_market_fee_sharing)
        );
    }

    // Return tab ID on change
    function tabChanged(tabId: number) {
        const changed = tabsChanged();
        return (changed as any)[tabId] ? (changed as any)[tabId] : false;
    }

    function tabsChanged() {
        const s = stateRef.current;
        const p = resetState({asset, core, globalObject, account});

        const tabUpdateIndex: any = [];

        /* Primary */
        if (
            s.update.max_supply !== p.update.max_supply ||
            s.core_exchange_rate.base.amount !==
                p.core_exchange_rate.base.amount ||
            s.core_exchange_rate.quote.amount !==
                p.core_exchange_rate.quote.amount
        )
            tabUpdateIndex["0"] = true;

        /* Whitelist */
        if (
            JSON.stringify(s.whitelist_authorities) !==
                JSON.stringify(p.whitelist_authorities) ||
            JSON.stringify(s.blacklist_authorities) !==
                JSON.stringify(p.blacklist_authorities) ||
            JSON.stringify(s.whitelist_markets) !==
                JSON.stringify(p.whitelist_markets) ||
            JSON.stringify(s.blacklist_markets) !==
                JSON.stringify(p.blacklist_markets) ||
            JSON.stringify(s.whitelist_market_fee_sharing) !==
                JSON.stringify(p.whitelist_market_fee_sharing)
        )
            tabUpdateIndex["1"] = true;

        /* Description */
        if (
            s.update.description.main !== p.update.description.main ||
            s.update.description.short_name !==
                p.update.description.short_name ||
            s.update.description.market !== p.update.description.market
        )
            tabUpdateIndex["2"] = true;

        /* Bitasset options */
        if (
            JSON.stringify(s.bitasset_opts) !==
            JSON.stringify(p.original_bitasset_opts)
        )
            tabUpdateIndex["3"] = true;

        /* Permissions */
        if (
            JSON.stringify(s.permissionBooleans) !==
            JSON.stringify(p.permissionBooleans)
        )
            tabUpdateIndex["4"] = true;

        /* Flags */

        if (
            JSON.stringify(s.flagBooleans) !== JSON.stringify(p.flagBooleans) ||
            s.update.market_fee_percent !== p.update.market_fee_percent ||
            s.update.max_market_fee !== p.update.max_market_fee ||
            s.update.reward_percent !== p.update.reward_percent ||
            s.update.taker_fee_percent !== p.update.taker_fee_percent
        )
            tabUpdateIndex["5"] = true;

        if (
            JSON.stringify(s.feedProducers) !==
            JSON.stringify(p.originalFeedProducers)
        )
            tabUpdateIndex["6"] = true;

        return tabUpdateIndex;
    }

    function pageChanged() {
        const {
            isBitAsset,
            bitasset_opts,
            original_bitasset_opts,
            feedProducers,
            originalFeedProducers
        } = stateRef.current;
        return (
            assetChanged() ||
            (isBitAsset &&
                (JSON.stringify(bitasset_opts) !==
                    JSON.stringify(original_bitasset_opts) ||
                    !(utils as any).are_equal_shallow(
                        feedProducers.toJS(),
                        originalFeedProducers.toJS()
                    )))
        );
    }

    function updateAsset(e: any) {
        e.preventDefault();

        // Close confirm_modal if it's open
        hideAssetUpdateConfirmationModal();

        const {
            update,
            issuer,
            new_issuer_account_id,
            core_exchange_rate,
            flagBooleans,
            permissionBooleans,
            isBitAsset,
            bitasset_opts,
            original_bitasset_opts,
            feedProducers,
            originalFeedProducers
        } = stateRef.current;

        let flags = (assetUtils as any).getFlags(flagBooleans);

        // Handle incorrect flag from genesis
        if (
            asset.getIn(["options", "flags"]) & 128 &&
            !(asset.getIn(["options", "issuer_permissions"]) & 128)
        ) {
            flags += 128;
        }
        const permissions = (assetUtils as any).getPermissions(
            permissionBooleans,
            isBitAsset
        );

        if (stateRef.current.marketInput !== update.description.market) {
            update.description.market = "";
        }
        const description = JSON.stringify(update.description);

        const auths = {
            whitelist_authorities: stateRef.current.whitelist_authorities,
            blacklist_authorities: stateRef.current.blacklist_authorities,
            whitelist_markets: stateRef.current.whitelist_markets,
            blacklist_markets: stateRef.current.blacklist_markets,
            whitelist_market_fee_sharing:
                stateRef.current.whitelist_market_fee_sharing
        };

        const feedProducersJS = isBitAsset ? feedProducers.toJS() : null;
        const originalFeedProducersJS = isBitAsset
            ? originalFeedProducers.toJS()
            : null;

        (AssetActions as any)
            .updateAsset(
                issuer,
                new_issuer_account_id,
                update,
                core_exchange_rate,
                asset,
                flags,
                permissions,
                isBitAsset,
                bitasset_opts,
                original_bitasset_opts,
                description,
                auths,
                feedProducersJS,
                originalFeedProducersJS,
                assetChanged()
            )
            .then(() => {
                console.log(
                    "... AssetActions.updateAsset(account_id, update)",
                    issuer,
                    new_issuer_account_id,
                    asset.get("id"),
                    update
                );
                setTimeout(() => {
                    (ChainStore as any).getAsset(
                        propsRef.current.asset.get("id")
                    );
                    stateRef.current = resetState(propsRef.current);
                    forceUpdate();
                }, 3000);
            });
    }

    function reset(e: any) {
        e.preventDefault();
        stateRef.current = resetState({asset, core, globalObject, account});
        forceUpdate();
    }

    function forcePositive(number: any) {
        return parseFloat(number) < 0 ? "0" : number;
    }

    function onUpdateDescription(value: string, e: any) {
        const {update} = stateRef.current;
        let updateState_ = true;

        switch (value) {
            case "condition":
                if (e.target.value.length > 60) {
                    updateState_ = false;
                    return;
                }
                update.description[value] = e.target.value;
                break;

            case "short_name":
                if (e.target.value.length > 32) {
                    updateState_ = false;
                    return;
                }
                update.description[value] = e.target.value;
                break;

            case "market":
                update.description[value] = e;
                break;

            case "visible":
                update.description[value] = !update.description[value];
                break;

            default:
                update.description[value] = e.target.value;
                break;
        }

        if (updateState_) {
            forceUpdate();
            validateEditFields(update);
        }
    }

    function onChangeBitAssetOpts(value: string, e: any) {
        const {bitasset_opts} = stateRef.current;

        switch (value) {
            case "force_settlement_offset_percent":
            case "maximum_force_settlement_volume":
                bitasset_opts[value] =
                    parseFloat(e.target.value) *
                    (assetConstants as any).GRAPHENE_1_PERCENT;
                break;

            case "feed_lifetime_sec":
            case "force_settlement_delay_sec":
                bitasset_opts[value] = parseInt(
                    (parseFloat(e.target.value) * 60) as any,
                    10
                );
                break;

            case "short_backing_asset":
                bitasset_opts[value] = e;
                break;

            case "minimum_feeds":
                bitasset_opts[value] = parseInt(e.target.value, 10);
                break;

            default:
                break;
        }

        forceUpdate();
    }

    function onUpdateInput(value: string, e: any) {
        const {update} = stateRef.current;
        let updateState_ = true;
        const precision = (utils as any).get_asset_precision(
            asset.get("precision")
        );

        switch (value) {
            case "market_fee_percent":
                update[value] = forcePositive(e.target.value);
                break;
            case "reward_percent":
                update[value] = forcePositive(e.target.value);
                break;
            case "taker_fee_percent":
                update[value] = forcePositive(e.target.value);
                break;
            case "max_market_fee": {
                const marketFee = e.amount.replace(/,/g, "");
                if (
                    new (big as any)(marketFee)
                        .times(precision)
                        .gt(GRAPHENE_MAX_SHARE_SUPPLY)
                ) {
                    updateState_ = false;
                    return updateState({
                        errors: {
                            max_market_fee:
                                "The number you tried to enter is too large"
                        }
                    });
                }
                update[value] = (utils as any).limitByPrecision(
                    marketFee,
                    asset.get("precision")
                );
                break;
            }

            case "max_supply": {
                const maxSupply = e.amount.replace(/,/g, "");
                update[value] = (utils as any).limitByPrecision(
                    maxSupply,
                    asset.get("precision")
                );
                break;
            }

            default:
                update[value] = e.target.value;
                break;
        }

        if (updateState_) {
            updateState({update: update});
            validateEditFields(update);
        }
    }

    function validateEditFields(new_state: any) {
        const cer = new_state.core_exchange_rate;
        const feedProducers = new_state.feedProducers
            ? new_state.feedProducers
            : stateRef.current.feedProducers;
        const flagBooleans = stateRef.current.flagBooleans;

        const errors: any = {
            max_supply: null,
            quote_asset: null,
            base_asset: null,
            max_feed_producer: null,
            conflict_producer: null,
            invalid_market_pair: null
        };

        const p = asset.get("precision");
        try {
            errors.max_supply =
                new_state.max_supply <= 0
                    ? counterpart.translate(
                          "account.user_issued_assets.max_positive"
                      )
                    : new (big as any)(parseInt(new_state.max_supply, 10))
                          .times(Math.pow(10, p))
                          .gt(GRAPHENE_MAX_SHARE_SUPPLY)
                    ? counterpart.translate(
                          "account.user_issued_assets.too_large"
                      )
                    : null;
        } catch (err) {
            console.log("err:", err);
            errors.max_supply = counterpart.translate(
                "account.user_issued_assets.too_large"
            );
        }

        if (cer) {
            if (
                cer.quote.asset_id !== asset.get("id") &&
                cer.base.asset_id !== asset.get("id")
            ) {
                errors.quote_asset = counterpart.translate(
                    "account.user_issued_assets.need_asset",
                    {name: asset.get("symbol")}
                );
            }

            if (
                cer.quote.asset_id !== core.get("id") &&
                cer.base.asset_id !== core.get("id")
            ) {
                errors.base_asset = counterpart.translate(
                    "account.user_issued_assets.need_asset",
                    {name: core.get("symbol")}
                );
            }
        }
        if (feedProducers) {
            if (feedProducers.size > stateRef.current.maxFeedProducers) {
                errors.max_feed_producer = counterpart.translate(
                    "account.user_issued_assets.too_many_feed",
                    {max: stateRef.current.maxFeedProducers}
                );
            }
        }
        if (
            flagBooleans.committee_fed_asset &&
            flagBooleans.witness_fed_asset
        ) {
            errors.conflict_producer = counterpart.translate(
                "account.user_issued_assets.conflict_feed"
            );
        }

        if (stateRef.current.marketInput == asset.get("symbol")) {
            errors.invalid_market_pair = counterpart.translate(
                "account.user_issued_assets.invalid_market_pair"
            );
        }

        const isValid =
            !errors.invalid_market_pair &&
            !errors.max_supply &&
            !errors.base_asset &&
            !errors.quote_asset &&
            !errors.max_feed_producer &&
            !errors.conflict_producer;

        updateState({isValid: isValid, errors: errors});
    }

    function onCoreRateChange(type: string, amount: any) {
        amount.amount =
            amount.amount == "" ? "0" : amount.amount.replace(/,/g, "");

        amount.amount = (utils as any).limitByPrecision(
            amount.amount,
            amount.asset.get("precision")
        );

        const {core_exchange_rate} = stateRef.current;
        core_exchange_rate[type] = {
            amount: amount.amount,
            asset_id: amount.asset.get("id")
        };
        forceUpdate();
    }

    function onAccountChanged(key: string, acct: any) {
        updateState({
            [key]: acct ? acct.get("id") : null
        });
    }

    function onAccountNameChanged(key: string, name: any) {
        updateState({
            [key]: name
        });
    }

    function onInputCoreAsset(type: string, assetInput: any) {
        if (type === "quote") {
            updateState({quoteAssetInput: assetInput});
        } else if (type === "base") {
            updateState({baseAssetInput: assetInput});
        }
    }

    function onFoundCoreAsset(type: string, foundAsset: any) {
        if (foundAsset) {
            const core_rate = stateRef.current.core_exchange_rate;
            core_rate[type].asset_id = foundAsset.get("id");

            updateState({core_exchange_rate: core_rate});

            validateEditFields({
                max_supply: stateRef.current.max_supply,
                core_exchange_rate: core_rate
            });
        }
    }

    function onInputMarket(marketAsset: any) {
        updateState({marketInput: marketAsset});
    }

    function onFoundMarketAsset(foundAsset: any) {
        if (foundAsset) {
            onUpdateDescription("market", foundAsset.get("symbol"));
        }
    }

    function onFlagChange(key: string) {
        const booleans = stateRef.current.flagBooleans;
        booleans[key] = !booleans[key];
        updateState({flagBooleans: booleans});
        validateEditFields({});
    }

    function onPermissionChange(key: string) {
        const {isBitAsset, permissionBooleans} = stateRef.current;

        const disabled = !(assetUtils as any).getFlagBooleans(
            asset.getIn(["options", "issuer_permissions"]),
            isBitAsset
        )[key];

        if (getCurrentSupply() > 0 && disabled) {
            (Notification as any).error({
                message: counterpart.translate(
                    "account.user_issued_assets.invalid_permissions_change"
                )
            });
            return;
        }

        const booleans = permissionBooleans;
        booleans[key] = !booleans[key];
        updateState({permissionBooleans: booleans});
    }

    function onChangeList(key: string, action = "add", id?: any) {
        let current = stateRef.current[key];
        if (current === undefined) {
            current = new (Immutable as any).List([]);
        }
        if (action === "add" && !current.includes(id)) {
            current = current.push(id);
        } else if (action === "remove" && current.includes(id)) {
            current = current.remove(current.indexOf(id));
        }
        updateState({[key]: current});
    }

    function onChangeFeedProducerList(action = "add", id?: any) {
        let current = stateRef.current.feedProducers;
        if (action === "add" && !current.includes(id)) {
            current = current.push(id);
        } else if (action === "remove" && current.includes(id)) {
            current = current.remove(current.indexOf(id));
        }
        updateState({feedProducers: current});
        validateEditFields({feedProducers: current});
    }

    const {
        errors,
        isValid,
        update,
        core_exchange_rate,
        flagBooleans,
        permissionBooleans,
        isBitAsset,
        bitasset_opts
    } = stateRef.current;

    // Estimate the asset update fee
    const symbol = asset.get("symbol");
    const updateFee = <FormattedFee opType="asset_update" />;

    const cr_quote_asset = (ChainStore as any).getAsset(
        core_exchange_rate.quote.asset_id
    );
    const precision = (utils as any).get_asset_precision(
        cr_quote_asset.get("precision")
    );
    const cr_base_asset = (ChainStore as any).getAsset(
        core_exchange_rate.base.asset_id
    );
    const basePrecision = (utils as any).get_asset_precision(
        cr_base_asset.get("precision")
    );

    const cr_quote_amount =
        parseFloat(core_exchange_rate.quote.amount) * precision;
    const cr_base_amount =
        parseFloat(core_exchange_rate.base.amount) * basePrecision;
    const originalPermissions = (assetUtils as any).getFlagBooleans(
        asset.getIn(["options", "issuer_permissions"]),
        asset.get("bitasset") !== undefined
    );
    // Loop over flags
    const flags: any[] = [];
    const getFlag = (key: string, onClick: any, isChecked: any) => {
        return (
            <table key={"table_" + key} className="table">
                <tbody>
                    <tr>
                        <td style={{border: "none", width: "80%"}}>
                            <Translate
                                content={`account.user_issued_assets.${key}`}
                            />
                            :
                        </td>
                        <td style={{border: "none", textAlign: "right"}}>
                            <Switch checked={isChecked} onChange={onClick} />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    for (const key in originalPermissions) {
        if (originalPermissions[key] && key !== "charge_market_fee") {
            flags.push(
                getFlag(key, () => onFlagChange(key), flagBooleans[key])
            );
        }
    }

    flags.push(
        getFlag(
            "visible",
            () => onUpdateDescription("visible", undefined),
            update.description.visible
                ? false
                : update.description.visible === false
                ? true
                : false
        )
    );

    // Loop over permissions
    const permissions: any[] = [];
    for (const key in originalPermissions) {
        permissions.push(
            <table key={"table_" + key} className="table">
                <tbody>
                    <tr>
                        <td style={{border: "none", width: "80%"}}>
                            <Translate
                                content={`account.user_issued_assets.${key}`}
                            />
                            :
                        </td>
                        <td style={{border: "none"}}>
                            <Switch
                                checked={permissionBooleans[key]}
                                onChange={() => onPermissionChange(key)}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }

    let tabsChangedCount = 0;
    tabsChanged().forEach(function() {
        tabsChangedCount++;
    });

    const confirmButtons = (
        <div>
            <button
                className={classnames("button", {
                    disabled: !isValid || !pageChanged()
                })}
                style={{width: "9rem"}}
                onClick={tabsChangedCount > 1 ? openConfirm : updateAsset}
            >
                {tabsChangedCount > 1 ? (
                    <Translate content="account.perm.save_all" />
                ) : (
                    <Translate content="account.perm.save" />
                )}
            </button>
            <button
                className={classnames("button primary hollow", {
                    disabled: !pageChanged()
                })}
                onClick={reset}
            >
                <Translate content="account.perm.reset" />
            </button>
        </div>
    );

    let cerValid = false;

    if (
        (cr_quote_asset.get("id") === "1.3.0" ||
            cr_base_asset.get("id") === "1.3.0") &&
        (cr_quote_asset.get("id") === asset.get("id") ||
            cr_base_asset.get("id") === asset.get("id"))
    ) {
        cerValid = true;
    }

    const isPredictionMarketAsset = asset.getIn([
        "bitasset",
        "is_prediction_market"
    ]);

    const asset_description = (assetUtils as any).parseDescription(
        asset.toJS().options.description
    );

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <div className="tabs-header">
                        <h3>
                            <Translate content="header.update_asset" />:{" "}
                            {symbol}
                        </h3>
                    </div>
                    <Tabs
                        setting="updateAssetTab"
                        className="account-tabs"
                        tabsClass="account-overview bordered-header content-block"
                        contentClass="grid-block padding-top shrink small-vertical medium-horizontal"
                        segmented={false}
                        actionButtons={confirmButtons}
                        onChangeTab={(i: any) => {
                            stateRef.current.activeTab = i;
                            forceUpdate();
                        }}
                    >
                        <Tab
                            title="account.user_issued_assets.primary"
                            updatedTab={tabChanged(0)}
                        >
                            <div className="small-12 large-8 large-offset-2 grid-content">
                                <label>
                                    <Translate content="account.user_issued_assets.precision" />
                                    <span>: {asset.get("precision")}</span>
                                </label>
                                <br />

                                <label>
                                    <AmountSelector
                                        label="account.user_issued_assets.max_supply"
                                        amount={update.max_supply}
                                        onChange={(e: any) =>
                                            onUpdateInput("max_supply", e)
                                        }
                                        asset={asset.get("id")}
                                        assets={[asset.get("id")]}
                                        placeholder="0.0"
                                        tabIndex={1}
                                    />
                                </label>
                                {errors.max_supply ? (
                                    <p className="grid-content has-error">
                                        {errors.max_supply}
                                    </p>
                                ) : null}

                                <Translate
                                    component="h3"
                                    content="account.user_issued_assets.core_exchange_rate"
                                />
                                <label>
                                    <div className="grid-block no-margin">
                                        {cerValid ? null : (
                                            <div className="grid-block no-margin small-12 medium-6">
                                                <AssetSelector
                                                    label="account.user_issued_assets.quote_name"
                                                    onChange={(e: any) =>
                                                        onInputCoreAsset(
                                                            "quote",
                                                            e
                                                        )
                                                    }
                                                    asset={
                                                        stateRef.current
                                                            .quoteAssetInput
                                                    }
                                                    assetInput={
                                                        stateRef.current
                                                            .quoteAssetInput
                                                    }
                                                    tabIndex={1}
                                                    style={{
                                                        width: "100%",
                                                        paddingRight: "10px"
                                                    }}
                                                    onFound={(e: any) =>
                                                        onFoundCoreAsset(
                                                            "quote",
                                                            e
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                        {cerValid ? null : (
                                            <div className="grid-block no-margin small-12 medium-6">
                                                <AssetSelector
                                                    label="account.user_issued_assets.base_name"
                                                    onChange={(e: any) =>
                                                        onInputCoreAsset(
                                                            "base",
                                                            e
                                                        )
                                                    }
                                                    asset={
                                                        stateRef.current
                                                            .baseAssetInput
                                                    }
                                                    assetInput={
                                                        stateRef.current
                                                            .baseAssetInput
                                                    }
                                                    tabIndex={1}
                                                    style={{
                                                        width: "100%",
                                                        paddingLeft: "10px"
                                                    }}
                                                    onFound={(e: any) =>
                                                        onFoundCoreAsset(
                                                            "base",
                                                            e
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                        {errors.quote_asset ? (
                                            <p className="grid-content has-error">
                                                {errors.quote_asset}
                                            </p>
                                        ) : null}
                                        {errors.base_asset ? (
                                            <p className="grid-content has-error">
                                                {errors.base_asset}
                                            </p>
                                        ) : null}
                                        <div className="grid-block no-margin small-12 medium-6">
                                            <AmountSelector
                                                label="account.user_issued_assets.quote"
                                                amount={
                                                    core_exchange_rate.quote
                                                        .amount
                                                }
                                                onChange={(e: any) =>
                                                    onCoreRateChange(
                                                        "quote",
                                                        e
                                                    )
                                                }
                                                asset={
                                                    core_exchange_rate.quote
                                                        .asset_id
                                                }
                                                assets={[
                                                    core_exchange_rate.quote
                                                        .asset_id
                                                ]}
                                                placeholder="0.0"
                                                tabIndex={1}
                                                style={{
                                                    width: "100%",
                                                    paddingRight: "10px"
                                                }}
                                            />
                                        </div>
                                        <div className="grid-block no-margin small-12 medium-6">
                                            <AmountSelector
                                                label="account.user_issued_assets.base"
                                                amount={
                                                    core_exchange_rate.base
                                                        .amount
                                                }
                                                onChange={(e: any) =>
                                                    onCoreRateChange("base", e)
                                                }
                                                asset={
                                                    core_exchange_rate.base
                                                        .asset_id
                                                }
                                                assets={[
                                                    core_exchange_rate.base
                                                        .asset_id
                                                ]}
                                                placeholder="0.0"
                                                tabIndex={1}
                                                style={{
                                                    width: "100%",
                                                    paddingLeft: "10px"
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <h5>
                                            <Translate content="exchange.price" />
                                            :{" "}
                                            <FormattedPrice
                                                style={{fontWeight: "bold"}}
                                                quote_amount={cr_quote_amount}
                                                quote_asset={
                                                    core_exchange_rate.quote
                                                        .asset_id
                                                }
                                                base_asset={
                                                    core_exchange_rate.base
                                                        .asset_id
                                                }
                                                base_amount={cr_base_amount}
                                            />
                                        </h5>
                                    </div>
                                </label>
                                <div>
                                    <Translate
                                        content="account.user_issued_assets.cer_warning_1"
                                        component="label"
                                        className="has-error"
                                    />
                                    <Translate
                                        content="account.user_issued_assets.cer_warning_2"
                                        component="p"
                                    />
                                </div>

                                {
                                    <p>
                                        <Translate content="account.user_issued_assets.approx_fee" />
                                        : {updateFee}
                                    </p>
                                }
                            </div>
                        </Tab>

                        <Tab
                            title="account.whitelist.title"
                            updatedTab={tabChanged(1)}
                        >
                            <AssetWhitelist
                                whiteListEnabled={flagBooleans["white_list"]}
                                marketFeeEnabled={
                                    flagBooleans["charge_market_fee"]
                                }
                                whitelist_authorities={
                                    stateRef.current.whitelist_authorities
                                }
                                blacklist_authorities={
                                    stateRef.current.blacklist_authorities
                                }
                                whitelist_markets={
                                    stateRef.current.whitelist_markets
                                }
                                whitelist_market_fee_sharing={
                                    stateRef.current
                                        .whitelist_market_fee_sharing ===
                                    undefined
                                        ? new (Immutable as any).List([])
                                        : stateRef.current
                                              .whitelist_market_fee_sharing
                                }
                                blacklist_markets={
                                    stateRef.current.blacklist_markets
                                }
                                new_authority_id={
                                    stateRef.current.new_authority_id
                                }
                                authority_name={
                                    stateRef.current.authority_name
                                }
                                onAccountNameChanged={onAccountNameChanged}
                                onAccountChanged={onAccountChanged}
                                onChangeList={onChangeList}
                            >
                                {
                                    <p>
                                        <Translate content="account.user_issued_assets.approx_fee" />
                                        : {updateFee}
                                    </p>
                                }
                            </AssetWhitelist>
                        </Tab>

                        <Tab
                            title="account.user_issued_assets.description"
                            updatedTab={tabChanged(2)}
                        >
                            <div className="small-12 large-8 large-offset-2 grid-content">
                                <label>
                                    <textarea
                                        style={{height: "7rem"}}
                                        rows={1}
                                        value={update.description.main || ""}
                                        onChange={(e: any) =>
                                            onUpdateDescription("main", e)
                                        }
                                    />
                                </label>

                                <Translate
                                    component="h3"
                                    content="account.user_issued_assets.short"
                                />
                                <label>
                                    <input
                                        type="text"
                                        value={
                                            update.description.short_name ||
                                            ""
                                        }
                                        onChange={(e: any) =>
                                            onUpdateDescription(
                                                "short_name",
                                                e
                                            )
                                        }
                                    />
                                </label>

                                <Translate
                                    component="h3"
                                    content="account.user_issued_assets.market"
                                />
                                <AssetSelector
                                    label="account.user_issued_assets.name"
                                    onChange={onInputMarket}
                                    placeholder={asset_description.market}
                                    asset={stateRef.current.marketInput}
                                    assetInput={stateRef.current.marketInput}
                                    style={{
                                        width: "100%",
                                        paddingRight: "10px",
                                        paddingBottom: "20px"
                                    }}
                                    onFound={onFoundMarketAsset}
                                />
                                {errors.invalid_market_pair ? (
                                    <p className="grid-content has-error">
                                        {errors.invalid_market_pair}
                                    </p>
                                ) : null}

                                {isPredictionMarketAsset ? (
                                    <div>
                                        <Translate
                                            component="h3"
                                            content="account.user_issued_assets.condition"
                                        />
                                        <label>
                                            <input
                                                type="text"
                                                value={
                                                    update.description
                                                        .condition
                                                }
                                                onChange={(e: any) =>
                                                    onUpdateDescription(
                                                        "condition",
                                                        e
                                                    )
                                                }
                                            />
                                        </label>

                                        <Translate
                                            component="h3"
                                            content="account.user_issued_assets.expiry"
                                        />
                                        <label>
                                            <input
                                                type="date"
                                                value={
                                                    update.description.expiry
                                                }
                                                onChange={(e: any) =>
                                                    onUpdateDescription(
                                                        "expiry",
                                                        e
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                ) : null}

                                {
                                    <p>
                                        <Translate content="account.user_issued_assets.approx_fee" />
                                        : {updateFee}
                                    </p>
                                }
                            </div>
                        </Tab>

                        {isBitAsset ? (
                            <Tab
                                title="account.user_issued_assets.bitasset_opts"
                                updatedTab={tabChanged(3)}
                            >
                                <div className="small-12 large-8 large-offset-2 grid-content">
                                    <BitAssetOptions
                                        bitasset_opts={bitasset_opts}
                                        onUpdate={onChangeBitAssetOpts}
                                        backingAsset={
                                            bitasset_opts.short_backing_asset
                                        }
                                        assetPrecision={asset.get(
                                            "precision"
                                        )}
                                        assetSymbol={asset.get("symbol")}
                                        disableBackingAssetChange={
                                            getCurrentSupply() > 0
                                        }
                                        disabledBackingAssetChangeCallback={
                                            disabledBackingAssetChangeCallback
                                        }
                                    />
                                    {
                                        <p>
                                            <Translate content="account.user_issued_assets.approx_fee" />
                                            : {updateFee}
                                        </p>
                                    }
                                </div>
                            </Tab>
                        ) : null}

                        <Tab
                            title="account.permissions"
                            updatedTab={tabChanged(4)}
                        >
                            <div className="small-12 large-8 large-offset-2 grid-content">
                                <HelpContent
                                    path={"components/AccountAssetCreate"}
                                    section="permissions"
                                />
                                <p className="grid-content has-error">
                                    <Translate content="account.user_issued_assets.perm_warning" />
                                </p>
                                {permissions}
                                {
                                    <p>
                                        <Translate content="account.user_issued_assets.approx_fee" />
                                        : {updateFee}
                                    </p>
                                }
                            </div>
                        </Tab>

                        <Tab
                            title="account.user_issued_assets.flags"
                            updatedTab={tabChanged(5)}
                        >
                            <div className="small-12 large-8 large-offset-2 grid-content">
                                <HelpContent
                                    path={"components/AccountAssetCreate"}
                                    section="flags"
                                />
                                {originalPermissions["charge_market_fee"] ? (
                                    <div>
                                        <h3>
                                            <Translate
                                                component="span"
                                                content="account.user_issued_assets.market_fee"
                                                style={{
                                                    paddingRight: "20px"
                                                }}
                                            />
                                            <Switch
                                                checked={
                                                    flagBooleans.charge_market_fee
                                                }
                                                onChange={() =>
                                                    onFlagChange(
                                                        "charge_market_fee"
                                                    )
                                                }
                                            />
                                        </h3>
                                        <div
                                            className={cnames({
                                                disabled: !flagBooleans.charge_market_fee
                                            })}
                                            style={{
                                                marginTop: "10px",
                                                marginLeft: "30px"
                                            }}
                                        >
                                            <label>
                                                <Tooltip
                                                    title={counterpart.translate(
                                                        "account.user_issued_assets.taker_fee_percent_tooltip"
                                                    )}
                                                >
                                                    <Translate content="account.user_issued_assets.taker_fee_percent" />{" "}
                                                    (%)
                                                </Tooltip>
                                                <input
                                                    type="number"
                                                    value={
                                                        update.taker_fee_percent
                                                    }
                                                    onChange={(e: any) =>
                                                        onUpdateInput(
                                                            "taker_fee_percent",
                                                            e
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label>
                                                <Translate content="account.user_issued_assets.market_fee" />{" "}
                                                (%)
                                                <input
                                                    type="number"
                                                    value={
                                                        update.market_fee_percent
                                                    }
                                                    onChange={(e: any) =>
                                                        onUpdateInput(
                                                            "market_fee_percent",
                                                            e
                                                        )
                                                    }
                                                />
                                            </label>
                                            <label>
                                                <AmountSelector
                                                    label="account.user_issued_assets.max_market_fee"
                                                    amount={
                                                        update.max_market_fee
                                                    }
                                                    onChange={(e: any) =>
                                                        onUpdateInput(
                                                            "max_market_fee",
                                                            e
                                                        )
                                                    }
                                                    asset={asset.get("id")}
                                                    assets={[
                                                        asset.get("id")
                                                    ]}
                                                    placeholder="0.0"
                                                    tabIndex={1}
                                                />
                                            </label>
                                            <div>
                                                <label>
                                                    <Tooltip
                                                        title={counterpart.translate(
                                                            "account.user_issued_assets.reward_percent_tooltip"
                                                        )}
                                                    >
                                                        <Translate content="account.user_issued_assets.reward_percent" />{" "}
                                                        (%)
                                                    </Tooltip>
                                                    <input
                                                        type="number"
                                                        value={
                                                            update.reward_percent
                                                        }
                                                        onChange={(e: any) =>
                                                            onUpdateInput(
                                                                "reward_percent",
                                                                e
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </div>
                                            {errors.max_market_fee ? (
                                                <p className="grid-content has-error">
                                                    {errors.max_market_fee}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                                <h3>
                                    <Translate content="account.user_issued_assets.flags" />
                                </h3>
                                {flags}
                                {
                                    <p>
                                        <Translate content="account.user_issued_assets.approx_fee" />
                                        : {updateFee}
                                    </p>
                                }
                                {errors.conflict_producer ? (
                                    <p className="grid-content has-error">
                                        {errors.conflict_producer}
                                    </p>
                                ) : null}
                            </div>
                        </Tab>

                        {isBitAsset ? (
                            <Tab
                                title="account.user_issued_assets.feed_producers"
                                updatedTab={tabChanged(6)}
                            >
                                <AssetFeedProducers
                                    asset={asset}
                                    account={account}
                                    witnessFed={
                                        flagBooleans["witness_fed_asset"]
                                    }
                                    committeeFed={
                                        flagBooleans["committee_fed_asset"]
                                    }
                                    producers={stateRef.current.feedProducers}
                                    onChangeList={onChangeFeedProducerList}
                                />
                                {errors.max_feed_producer ? (
                                    <p
                                        className="grid-content has-error large-8 large-offset-2"
                                        style={{marginTop: "20px"}}
                                    >
                                        {errors.max_feed_producer}
                                    </p>
                                ) : null}
                            </Tab>
                        ) : null}
                    </Tabs>
                </div>
            </div>
            {/* Confirmation Modal on Multiple Changes */}
            <ConfirmModal
                visible={
                    stateRef.current.isAssetUpdateConfirmationModalVisible
                }
                hideModal={hideAssetUpdateConfirmationModal}
                tabsChanged={tabsChanged()}
                updateAsset={updateAsset}
            />
        </div>
    );
}

function AccountAssetUpdateContainer(props: any) {
    useChainStoreTick();
    const asset = (ChainStore as any).getAsset(props.asset);
    const core = (ChainStore as any).getAsset(props.core || "1.3.0");
    const globalObject = (ChainStore as any).getObject(
        props.globalObject || "2.0.0"
    );

    if (!asset || !core || !globalObject) {
        return <span />;
    }

    return (
        <AccountAssetUpdateInner
            asset={asset}
            core={core}
            globalObject={globalObject}
            account={props.account}
        />
    );
}

interface ConfirmModalProps {
    visible: boolean;
    hideModal: () => void;
    tabsChanged: any;
    updateAsset: (e: any) => void;
}

function ConfirmModal({
    visible,
    hideModal,
    tabsChanged,
    updateAsset
}: ConfirmModalProps) {
    const footer = [
        <Button type="primary" key="submit" onClick={updateAsset}>
            {counterpart.translate("global.confirm")}
        </Button>,
        <Button key="cancel" onClick={hideModal}>
            {counterpart.translate("global.cancel")}
        </Button>
    ];

    return (
        <Modal
            visible={visible}
            footer={footer}
            onCancel={hideModal}
            title={counterpart.translate("account.confirm_asset_modal.header")}
        >
            <Translate
                content="account.confirm_asset_modal.are_you_sure"
                component="div"
                style={{paddingBottom: "1rem"}}
            />
            <div>
                <ul>
                    {tabsChanged["0"] ? (
                        <li>
                            <Translate content="account.user_issued_assets.primary" />
                        </li>
                    ) : null}
                    {tabsChanged["1"] ? (
                        <li>
                            <Translate content="account.whitelist.title" />
                        </li>
                    ) : null}
                    {tabsChanged["2"] ? (
                        <li>
                            <Translate content="account.user_issued_assets.description" />
                        </li>
                    ) : null}
                    {tabsChanged["3"] ? (
                        <li>
                            <Translate content="account.user_issued_assets.bitasset_opts" />
                        </li>
                    ) : null}

                    {tabsChanged["4"] ? (
                        <li>
                            <Translate content="account.permissions" />
                        </li>
                    ) : null}
                    {tabsChanged["5"] ? (
                        <li>
                            <Translate content="account.user_issued_assets.flags" />
                        </li>
                    ) : null}

                    {/* NEEDS CHECKING */}
                    {tabsChanged["6"] ? (
                        <li>
                            <Translate content="account.user_issued_assets.feed_producers" />
                        </li>
                    ) : null}
                </ul>
            </div>
        </Modal>
    );
}

export default function AssetUpdateWrapper(props: any) {
    const {asset} = useParams<{asset: string}>();
    return (
        <AccountAssetUpdateContainer {...props} asset={asset.toUpperCase()} />
    );
}
