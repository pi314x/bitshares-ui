// TypeScript/functional-component port of the legacy AccountAssetCreate.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md). The "create a new user-issued
// asset" form - primary details, description, optional bitAsset (MPA)
// options, permissions, and flags. Unlike every other file ported in this
// phase so far, `_createAsset` builds and submits the real `asset_create`
// transaction itself (via `AssetActions.createAsset`, reused unchanged) -
// handled with the same minimal, mechanical, line-for-line care as this
// migration's other transaction-submitting files, per AGENTS.md.
//
// State-management design differs from this family's other slices
// (`AccountPermissions.tsx`/`AccountVoting.tsx`, both a `useState<any>({})`
// + shallow-merge `mergeState`): this class overwhelmingly favors
// *directly mutating* `this.state`'s nested objects (`update`,
// `bitasset_opts`, `core_exchange_rate`, `flagBooleans`,
// `permissionBooleans`) in place and calling `this.forceUpdate()`, rather
// than going through `setState`'s merge - and even its few genuine
// `setState({field: value})` calls almost always pass back a reference
// that was *already* mutated in place first (e.g. `_onFlagChange`).
// Rather than force this into the `useState`+`mergeState` shape (which
// would require deciding, field by field, whether a mutation is "real" -
// a losing, error-prone exercise given how thoroughly interleaved the two
// styles are here), state is held in a single `useRef` (matching a class
// instance's `this.state` object identity/mutability exactly) plus a
// small `useForceUpdate` helper. `updateState(partial)` (`Object.assign`
// into the ref, then force a re-render) replicates `setState`'s
// observable shallow-merge behavior exactly - nothing in this file ever
// compares the whole state object by reference (no `shouldComponentUpdate`/
// `React.memo`; the only comparison, `_hasChanged`, was itself dead code -
// see below), so the loss of "new object identity per update" that real
// `setState` would have given has no observable consequence.
//
// The one `this.setState(update, callback)` use (`_onUpdateInput`'s
// cursor-position restoration after typing in the symbol/max_supply
// fields) needed a real hooks adaptation: the callback must run *after*
// the DOM has been updated with the new input value, to correctly compute
// the restored selection range. Replicated with a ref holding the pending
// restore request plus a no-dependency-array `useEffect` (runs after
// every commit) that performs and clears it when set - the closest hooks
// equivalent to `setState`'s post-commit callback timing.
//
// Structural change (same substitution used throughout this migration):
// `BindToChainState(AccountAssetCreate)` (resolving `core`/`globalObject`,
// both `ChainTypes...isRequired`) and `BindToChainState(BitAssetOptions)`
// (resolving `backingAsset`, also `.isRequired`) are each replaced with a
// Container + component split - the same split used for
// `Asset.tsx`/`AssetContainer` and `AccountVoting.tsx`.
//
// Confirmed dead, dropped (verified by reading the whole file and
// grepping every method name against the rest of the file and
// `AccountAssetUpdate.jsx`, the only other importer, for `BitAssetOptions`):
// - `_hasChanged()`, `_onInputCoreAsset()`, and `_onFoundCoreAsset()` -
//   all three defined, none ever called or bound to any JSX element
//   anywhere in this file. (The live core-exchange-rate handler is
//   `_onCoreRateChange`, wired to the quote text input and the base
//   `AmountSelector` - a separate method from the dead
//   `_onInputCoreAsset`/`_onFoundCoreAsset` pair, which would have wired
//   an `AssetSelector` to the CER that the actual `render()` never uses.)
//   Losing `_onFoundCoreAsset` also removes a pre-existing bug that would
//   otherwise need preserving: it called `_validateEditFields({max_supply:
//   this.state.max_supply, ...})`, reading a top-level `state.max_supply`
//   that never exists (the real field is nested at `state.update.max_supply`)
//   - moot, since the method is unreachable.
// - Three local variables in the original `resetState(props)` -
//   `precision`, `corePrecision`, and `coreRateBaseAssetName` - computed
//   (the last via a live `ChainStore.getAsset("1.3.0")` call) but never
//   read anywhere in the function or its returned state object. Dropping
//   them means `resetState` no longer needs a `props`/`core` parameter at
//   all (nothing else in it reads props either) - simplified to
//   `resetState()`, a direct consequence of the dead-code removal, not a
//   separate restructuring.
// - The `ref="appTables"` on the top-level render `<div>` - never read via
//   `this.refs` anywhere.
// - `BitAssetOptions`'s `isUpdate` propType/defaultProp - never read in
//   the component, and never actually supplied by either caller
//   (`AccountAssetCreate`'s own usage, or `AccountAssetUpdate.jsx`'s).
// - A stale, already-superseded commented-out code block inside
//   `_onUpdateInput`'s `max_supply` case (a draft big.js overflow check,
//   fully commented out, describing behavior the surrounding live code
//   already doesn't implement) - dropped as informationally inert, unlike
//   e.g. `AccountVoting.tsx`'s preserved `sortVoteObjects` comment, which
//   documents a still-reachable branch's intentionally no-op body.
//
// `_onUpdateInput`'s `let updateState = true;` / `if (updateState) {...}`
// wrapper is preserved even though nothing in this method's switch ever
// sets it to `false` (unlike the structurally similar
// `_onUpdateDescription`, which does, for its length-limited fields) -
// kept as a faithful, if vacuous, mechanical translation rather than an
// unrequested simplification.
//
// Two purely mechanical TS-driven adjustments, verified to have zero
// behavioral effect: the max-supply/precision-range/textarea `rows="1"`/
// `size`-style string attributes became numeric (`rows={1}` on the
// description textarea) since React's types require it; the original
// also had `rows="1"` on the short_name/condition `<input type="text">`
// elements specifically - not a valid HTML attribute for `<input>` at
// all (browsers silently ignore it there), and not a valid prop in
// React's `InputHTMLAttributes` types either, so those two are dropped
// entirely rather than cast - an inert attribute either way.
import * as React from "react";
import Translate from "react-translate-component";
import classnames from "classnames";
import AssetActions from "actions/AssetActions";
import HelpContent from "../Utility/HelpContent";
import utils from "common/utils";
import {ChainStore, ChainValidation} from "bitsharesjs";
import FormattedAsset from "../Utility/FormattedAsset";
import counterpart from "counterpart";
import AssetSelector from "../Utility/AssetSelector";
import big from "bignumber.js";
import cnames from "classnames";
import assetUtils from "common/asset_utils";
import {Tabs, Tab} from "../Utility/Tabs";
import AmountSelector from "../Utility/AmountSelector";
import assetConstants from "chain/asset_constants";
import {estimateFee} from "common/trxHelper";
import {Switch} from "bitshares-ui-style-guide";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const GRAPHENE_MAX_SHARE_SUPPLY = new (big as any)(
    (assetConstants as any).GRAPHENE_MAX_SHARE_SUPPLY
);

function useForceUpdate() {
    const [, setTick] = React.useState(0);
    return React.useCallback(() => setTick((t: number) => t + 1), []);
}

function getPermissions(state: any) {
    const flagBooleans = (assetUtils as any).getFlagBooleans(
        0,
        state.isBitAsset
    );
    const permissionBooleans = (assetUtils as any).getFlagBooleans(
        "all",
        state.isBitAsset
    );

    return {
        flagBooleans,
        permissionBooleans
    };
}

function resetState() {
    const isBitAsset = false;
    const {flagBooleans, permissionBooleans} = getPermissions({isBitAsset});

    return {
        update: {
            symbol: "",
            precision: 4,
            max_supply: 100000,
            max_market_fee: 0,
            market_fee_percent: 0,
            description: {main: ""} as any,
            reward_percent: 0,
            taker_fee_percent: 0
        },
        errors: {
            max_supply: null
        } as any,
        isValid: true,
        flagBooleans: flagBooleans,
        permissionBooleans: permissionBooleans,
        isBitAsset: isBitAsset,
        is_prediction_market: false,
        core_exchange_rate: {
            quote: {
                asset_id: null as any,
                amount: 1 as any
            },
            base: {
                asset_id: "1.3.0",
                amount: 1 as any
            }
        },
        bitasset_opts: {
            feed_lifetime_sec: 60 * 60 * 24,
            minimum_feeds: 7,
            force_settlement_delay_sec: 60 * 60 * 24,
            force_settlement_offset_percent:
                1 * (assetConstants as any).GRAPHENE_1_PERCENT,
            maximum_force_settlement_volume:
                20 * (assetConstants as any).GRAPHENE_1_PERCENT,
            short_backing_asset: "1.3.0"
        },
        marketInput: ""
    };
}

interface BitAssetOptionsProps {
    backingAsset: any;
    bitasset_opts: any;
    onUpdate: (...args: any[]) => any;
    disableBackingAssetChange?: boolean;
    disabledBackingAssetChangeCallback?: (...args: any[]) => any;
    isPredictionMarket?: boolean;
    assetPrecision?: any;
    assetSymbol?: string;
}

function BitAssetOptions({
    backingAsset,
    bitasset_opts,
    onUpdate,
    disableBackingAssetChange,
    disabledBackingAssetChangeCallback,
    isPredictionMarket,
    assetPrecision,
    assetSymbol
}: BitAssetOptionsProps) {
    const [state, setState] = React.useState<any>(() => ({
        backingAsset: backingAsset.get("symbol"),
        error: null
    }));

    function mergeState(partial: any) {
        setState((prev: any) => ({...prev, ...partial}));
    }

    function onInputBackingAsset(asset: any) {
        if (disableBackingAssetChange) {
            if (disabledBackingAssetChangeCallback) {
                disabledBackingAssetChangeCallback();
            }
        } else {
            mergeState({
                backingAsset: asset.toUpperCase(),
                error: null
            });
        }
    }

    function onFoundBackingAsset(asset: any) {
        if (asset) {
            const backing =
                asset.get("bitasset") &&
                (ChainStore as any).getAsset(
                    asset.getIn(["bitasset", "options", "short_backing_asset"])
                );
            const backing_backing =
                backing &&
                backing.get("bitasset") &&
                (ChainStore as any).getAsset(
                    backing.getIn([
                        "bitasset",
                        "options",
                        "short_backing_asset"
                    ])
                );
            if (backing_backing && backing_backing !== "1.3.0") {
                mergeState({
                    error: counterpart.translate(
                        "account.user_issued_assets.error_too_deep"
                    )
                });
                onUpdate("invalid", true);
            } else if (!asset.getIn(["bitasset", "is_prediction_market"])) {
                if (
                    isPredictionMarket &&
                    asset.get("precision") !== parseInt(assetPrecision, 10)
                ) {
                    mergeState({
                        error: counterpart.translate(
                            "account.user_issued_assets.error_precision",
                            {asset: assetSymbol}
                        )
                    });
                    onUpdate("invalid", true);
                } else {
                    onUpdate("short_backing_asset", asset.get("id"));
                    onUpdate("invalid", false);
                }
            } else {
                mergeState({
                    error: counterpart.translate(
                        "account.user_issued_assets.error_invalid"
                    )
                });
                onUpdate("invalid", true);
            }
        } else {
            onUpdate("invalid", true);
        }
    }

    const {error} = state;

    return (
        <div className="small-12 grid-content">
            <label>
                <Translate content="account.user_issued_assets.feed_lifetime_sec" />
                <input
                    type="number"
                    value={bitasset_opts.feed_lifetime_sec / 60}
                    onChange={(e: any) => onUpdate("feed_lifetime_sec", e)}
                />
            </label>

            <label>
                <Translate content="account.user_issued_assets.minimum_feeds" />
                <input
                    type="number"
                    value={bitasset_opts.minimum_feeds}
                    onChange={(e: any) => onUpdate("minimum_feeds", e)}
                />
            </label>

            <label>
                <Translate content="account.user_issued_assets.force_settlement_delay_sec" />
                <input
                    type="number"
                    value={bitasset_opts.force_settlement_delay_sec / 60}
                    onChange={(e: any) =>
                        onUpdate("force_settlement_delay_sec", e)
                    }
                />
            </label>

            <label>
                <Translate content="account.user_issued_assets.force_settlement_offset_percent" />
                <input
                    type="number"
                    value={
                        bitasset_opts.force_settlement_offset_percent /
                        (assetConstants as any).GRAPHENE_1_PERCENT
                    }
                    onChange={(e: any) =>
                        onUpdate("force_settlement_offset_percent", e)
                    }
                />
            </label>

            <label>
                <Translate content="account.user_issued_assets.maximum_force_settlement_volume" />
                <input
                    type="number"
                    value={
                        bitasset_opts.maximum_force_settlement_volume /
                        (assetConstants as any).GRAPHENE_1_PERCENT
                    }
                    onChange={(e: any) =>
                        onUpdate("maximum_force_settlement_volume", e)
                    }
                />
            </label>

            <div className="grid-block no-margin small-12">
                <AssetSelector
                    label="account.user_issued_assets.backing"
                    onChange={onInputBackingAsset}
                    asset={state.backingAsset}
                    assetInput={state.backingAsset}
                    tabIndex={1}
                    style={{width: "100%", paddingRight: "10px"}}
                    onFound={onFoundBackingAsset}
                />
                {error ? (
                    <div className="content-block has-error">{error}</div>
                ) : null}
            </div>
        </div>
    );
}

function BitAssetOptionsContainer(props: any) {
    useChainStoreTick();
    const backingAsset = (ChainStore as any).getAsset(props.backingAsset);

    if (!backingAsset) {
        return <span />;
    }

    return <BitAssetOptions {...props} backingAsset={backingAsset} />;
}

interface AccountAssetCreateProps {
    core: any;
    globalObject: any;
    account: any;
}

function AccountAssetCreateInner({
    core,
    globalObject,
    account
}: AccountAssetCreateProps) {
    const stateRef = React.useRef<any>(resetState());
    const forceUpdate = useForceUpdate();
    const pendingCursorRestoreRef = React.useRef<null | {
        target: any;
        selectionStart: number;
    }>(null);

    React.useEffect(() => {
        if (pendingCursorRestoreRef.current) {
            const {target, selectionStart} = pendingCursorRestoreRef.current;
            target.setSelectionRange(selectionStart, selectionStart);
            pendingCursorRestoreRef.current = null;
        }
    });

    function updateState(partial: any) {
        Object.assign(stateRef.current, partial);
        forceUpdate();
    }

    function createAsset(e: any) {
        e.preventDefault();
        const {
            update,
            flagBooleans,
            permissionBooleans,
            core_exchange_rate,
            isBitAsset,
            is_prediction_market,
            bitasset_opts
        } = stateRef.current;

        const flags = (assetUtils as any).getFlags(flagBooleans, isBitAsset);
        const permissions = (assetUtils as any).getPermissions(
            permissionBooleans,
            isBitAsset
        );

        if (stateRef.current.marketInput !== update.description.market) {
            update.description.market = "";
        }
        const description = JSON.stringify(update.description);

        (AssetActions as any)
            .createAsset(
                account.get("id"),
                update,
                flags,
                permissions,
                core_exchange_rate,
                isBitAsset,
                is_prediction_market,
                bitasset_opts,
                description
            )
            .then(() => {
                console.log(
                    "... AssetActions.createAsset(account_id, update)",
                    account.get("id"),
                    update,
                    flags,
                    permissions
                );
            });
    }

    function reset(e: any) {
        e.preventDefault();
        stateRef.current = resetState();
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
        const {bitasset_opts, errors} = stateRef.current;

        switch (value) {
            case "force_settlement_offset_percent":
            case "maximum_force_settlement_volume":
                bitasset_opts[value] =
                    parseFloat(e.target.value) *
                    (assetConstants as any).GRAPHENE_1_PERCENT;
                break;
            case "minimum_feeds":
                bitasset_opts[value] = parseInt(e.target.value, 10);
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

            case "invalid":
                errors.invalid_bitasset = e;
                break;

            default:
                bitasset_opts[value] = e.target.value;
                break;
        }

        const isValid =
            !errors.symbol && !errors.max_supply && !errors.invalid_bitasset;

        updateState({isValid: isValid, errors: errors});
    }

    function onUpdateInput(value: string, e: any) {
        const {update, errors} = stateRef.current;
        const updateState_ = true;
        let shouldRestoreCursor = false;
        const precision = (utils as any).get_asset_precision(
            stateRef.current.update.precision
        );
        const target = e.target;
        const caret = target.selectionStart;
        const inputValue = target.value;

        switch (value) {
            case "market_fee_percent":
                update[value] = forcePositive(target.value);
                break;
            case "reward_percent":
                update[value] = forcePositive(target.value);
                break;
            case "taker_fee_percent":
                update[value] = forcePositive(target.value);
                break;
            case "max_market_fee":
                if (
                    new (big as any)(inputValue)
                        .times(precision)
                        .gt(GRAPHENE_MAX_SHARE_SUPPLY)
                ) {
                    errors.max_market_fee =
                        "The number you tried to enter is too large";
                    return updateState({errors});
                }
                target.value = (utils as any).limitByPrecision(
                    target.value,
                    stateRef.current.update.precision
                );
                update[value] = target.value;
                break;

            case "precision":
                // Enforce positive number
                update[value] = forcePositive(target.value);
                break;

            case "max_supply": {
                shouldRestoreCursor = true;

                const regexp_numeral = new RegExp(/[[:digit:]]/);

                // Ensure input is valid
                if (!regexp_numeral.test(target.value)) {
                    target.value = target.value.replace(/[^0-9.]/g, "");
                }

                // Catch initial decimal input
                if (target.value.charAt(0) == ".") {
                    target.value = "0.";
                }

                // Catch double decimal and remove if invalid
                if (
                    target.value.charAt(target.value.length) !=
                    target.value.search(".")
                ) {
                    target.value.substr(1);
                }

                target.value = (utils as any).limitByPrecision(
                    target.value,
                    stateRef.current.update.precision
                );
                update[value] = target.value;
                break;
            }

            case "symbol": {
                shouldRestoreCursor = true;
                // Enforce uppercase
                const symbol = target.value.toUpperCase();
                // Enforce characters
                const regexp = new RegExp("^[.A-Z0-9]+$");
                if (symbol !== "" && !regexp.test(symbol)) {
                    break;
                }
                (ChainStore as any).getAsset(symbol);
                update[value] = forcePositive(symbol);
                break;
            }

            default:
                update[value] = target.value;
                break;
        }

        if (updateState_) {
            if (shouldRestoreCursor) {
                const selectionStart =
                    caret - (inputValue.length - update[value].length);
                pendingCursorRestoreRef.current = {target, selectionStart};
            }
            updateState({update: update});
            validateEditFields(update);
        }
    }

    function validateEditFields(new_state: any) {
        const {errors} = stateRef.current;
        errors.max_supply = null;

        errors.symbol = (ChainValidation as any).is_valid_symbol_error(
            new_state.symbol
        );
        const existingAsset = (ChainStore as any).getAsset(new_state.symbol);
        if (existingAsset) {
            errors.symbol = counterpart.translate(
                "account.user_issued_assets.exists"
            );
        }

        try {
            errors.max_supply =
                new_state.max_supply <= 0
                    ? counterpart.translate(
                          "account.user_issued_assets.max_positive"
                      )
                    : new (big as any)(new_state.max_supply)
                          .times(Math.pow(10, new_state.precision))
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

        const isValid =
            !errors.symbol && !errors.max_supply && !errors.invalid_bitasset;

        updateState({isValid: isValid, errors: errors});
    }

    function onFlagChange(key: string) {
        const booleans = stateRef.current.flagBooleans;
        booleans[key] = !booleans[key];
        updateState({
            flagBooleans: booleans
        });
    }

    function onPermissionChange(key: string) {
        const booleans = stateRef.current.permissionBooleans;
        booleans[key] = !booleans[key];
        updateState({
            permissionBooleans: booleans
        });
    }

    function onInputMarket(asset: any) {
        updateState({
            marketInput: asset
        });
    }

    function onFoundMarketAsset(asset: any) {
        if (asset) {
            onUpdateDescription("market", asset.get("symbol"));
        }
    }

    function onCoreRateChange(type: string, e: any) {
        let amount, asset;
        if (type === "quote") {
            amount = (utils as any).limitByPrecision(
                e.target.value,
                stateRef.current.update.precision
            );
            asset = null;
        } else {
            if (!e || !("amount" in e)) {
                return;
            }
            amount =
                e.amount == ""
                    ? "0"
                    : (utils as any).limitByPrecision(
                          e.amount.toString().replace(/,/g, ""),
                          core.get("precision")
                      );
            asset = e.asset.get("id");
        }

        const {core_exchange_rate} = stateRef.current;
        core_exchange_rate[type] = {
            amount: amount,
            asset_id: asset
        };
        forceUpdate();
    }

    function onToggleBitAsset() {
        stateRef.current.isBitAsset = !stateRef.current.isBitAsset;
        if (!stateRef.current.isBitAsset) {
            stateRef.current.is_prediction_market = false;
        }

        const {flagBooleans, permissionBooleans} = getPermissions(
            stateRef.current
        );
        stateRef.current.flagBooleans = flagBooleans;
        stateRef.current.permissionBooleans = permissionBooleans;

        forceUpdate();
    }

    function onTogglePM() {
        stateRef.current.is_prediction_market = !stateRef.current
            .is_prediction_market;
        stateRef.current.update.precision = core.get("precision");
        stateRef.current.core_exchange_rate.base.asset_id = core.get("id");
        forceUpdate();
    }

    const {
        errors,
        isValid,
        update,
        flagBooleans,
        permissionBooleans,
        core_exchange_rate,
        is_prediction_market,
        isBitAsset,
        bitasset_opts
    } = stateRef.current;

    // Estimate the asset creation fee from the symbol character length
    const symbolLength = update.symbol.length;
    let createFee: any = "N/A";

    if (symbolLength === 3) {
        createFee = (
            <FormattedAsset
                amount={estimateFee(
                    "asset_create",
                    ["symbol3"],
                    globalObject
                )}
                asset={"1.3.0"}
            />
        );
    } else if (symbolLength === 4) {
        createFee = (
            <FormattedAsset
                amount={estimateFee(
                    "asset_create",
                    ["symbol4"],
                    globalObject
                )}
                asset={"1.3.0"}
            />
        );
    } else if (symbolLength > 4) {
        createFee = (
            <FormattedAsset
                amount={estimateFee(
                    "asset_create",
                    ["long_symbol"],
                    globalObject
                )}
                asset={"1.3.0"}
            />
        );
    }

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
    for (const key in permissionBooleans) {
        if (permissionBooleans[key] && key !== "charge_market_fee") {
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
    for (const key in permissionBooleans) {
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

    const confirmButtons = (
        <div>
            <button
                className="button"
                onClick={reset}
                value={counterpart.translate("account.perm.reset")}
            >
                <Translate content="account.perm.reset" />
            </button>
            <button
                className={classnames("button", {disabled: !isValid})}
                onClick={createAsset}
            >
                <Translate content="header.create_asset" />
            </button>
        </div>
    );

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <div className="tabs-header">
                        <h3>
                            <Translate content="header.create_asset" />
                        </h3>
                    </div>

                    <Tabs
                        setting="createAssetTab"
                        className="account-tabs"
                        tabsClass="account-overview no-padding bordered-header content-block"
                        contentClass="grid-block shrink small-vertical medium-horizontal padding"
                        segmented={false}
                        actionButtons={confirmButtons}
                    >
                        <Tab title="account.user_issued_assets.primary">
                            <div className="small-12 grid-content">
                                <label>
                                    <Translate content="account.user_issued_assets.symbol" />
                                    <input
                                        type="text"
                                        value={update.symbol}
                                        onChange={(e: any) =>
                                            onUpdateInput("symbol", e)
                                        }
                                    />
                                </label>
                                {errors.symbol ? (
                                    <p className="grid-content has-error">
                                        {errors.symbol}
                                    </p>
                                ) : null}

                                <label>
                                    <Translate content="account.user_issued_assets.max_supply" />{" "}
                                    {update.symbol ? (
                                        <span>({update.symbol})</span>
                                    ) : null}
                                    <input
                                        type="text"
                                        value={update.max_supply}
                                        onChange={(e: any) =>
                                            onUpdateInput("max_supply", e)
                                        }
                                    />
                                </label>
                                {errors.max_supply ? (
                                    <p className="grid-content has-error">
                                        {errors.max_supply}
                                    </p>
                                ) : null}

                                <label>
                                    <Translate content="account.user_issued_assets.decimals" />
                                    <input
                                        min="0"
                                        max="8"
                                        step="1"
                                        type="range"
                                        value={update.precision}
                                        onChange={(e: any) =>
                                            onUpdateInput("precision", e)
                                        }
                                    />
                                </label>
                                <p>{update.precision}</p>

                                <div
                                    style={{marginBottom: 10}}
                                    className="txtlabel cancel"
                                >
                                    <Translate content="account.user_issued_assets.precision_warning" />
                                </div>

                                <table
                                    className="table"
                                    style={{width: "inherit"}}
                                >
                                    <tbody>
                                        <tr>
                                            <td style={{border: "none"}}>
                                                <Translate
                                                    content={
                                                        "account.user_issued_assets.mpa"
                                                    }
                                                />
                                                :
                                            </td>
                                            <td style={{border: "none"}}>
                                                <Switch
                                                    checked={isBitAsset}
                                                    onChange={onToggleBitAsset}
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {isBitAsset ? (
                                    <table
                                        className="table"
                                        style={{width: "inherit"}}
                                    >
                                        <tbody>
                                            <tr>
                                                <td style={{border: "none"}}>
                                                    <Translate
                                                        content={
                                                            "account.user_issued_assets.pm"
                                                        }
                                                    />
                                                    :
                                                </td>
                                                <td style={{border: "none"}}>
                                                    <Switch
                                                        checked={
                                                            is_prediction_market
                                                        }
                                                        onChange={onTogglePM}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                ) : null}

                                {/* CER */}
                                <Translate
                                    component="h3"
                                    content="account.user_issued_assets.core_exchange_rate"
                                />

                                <label>
                                    <div className="grid-block no-margin">
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
                                            <div
                                                className="amount-selector"
                                                style={{
                                                    width: "100%",
                                                    paddingRight: "10px"
                                                }}
                                            >
                                                <Translate
                                                    component="label"
                                                    content="account.user_issued_assets.quote"
                                                />
                                                <div className="inline-label">
                                                    <input
                                                        type="text"
                                                        placeholder="0.0"
                                                        onChange={(e: any) =>
                                                            onCoreRateChange(
                                                                "quote",
                                                                e
                                                            )
                                                        }
                                                        value={
                                                            core_exchange_rate
                                                                .quote.amount
                                                        }
                                                    />
                                                </div>
                                            </div>
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
                                            <span>
                                                :{" "}
                                                {(utils as any).format_number(
                                                    (utils as any).get_asset_price(
                                                        core_exchange_rate
                                                            .quote.amount *
                                                            (utils as any).get_asset_precision(
                                                                update.precision
                                                            ),
                                                        {
                                                            precision:
                                                                update.precision
                                                        },
                                                        core_exchange_rate.base
                                                            .amount *
                                                            (utils as any).get_asset_precision(
                                                                core
                                                            ),
                                                        core
                                                    ),
                                                    2 +
                                                        (parseInt(
                                                            update.precision,
                                                            10
                                                        ) || 8)
                                                )}
                                            </span>
                                            <span>
                                                {" "}
                                                {update.symbol}/
                                                {core.get("symbol")}
                                            </span>
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
                                        : {createFee}
                                    </p>
                                }
                            </div>
                        </Tab>

                        <Tab title="account.user_issued_assets.description">
                            <div className="small-12 grid-content">
                                <Translate
                                    component="label"
                                    content="account.user_issued_assets.description"
                                />
                                <label>
                                    <textarea
                                        style={{height: "7rem"}}
                                        rows={1}
                                        value={update.description.main}
                                        onChange={(e: any) =>
                                            onUpdateDescription("main", e)
                                        }
                                    />
                                </label>

                                <Translate
                                    component="label"
                                    content="account.user_issued_assets.short"
                                />
                                <label>
                                    <input
                                        type="text"
                                        value={update.description.short_name}
                                        onChange={(e: any) =>
                                            onUpdateDescription(
                                                "short_name",
                                                e
                                            )
                                        }
                                    />
                                </label>

                                <Translate
                                    component="label"
                                    content="account.user_issued_assets.market"
                                />
                                <AssetSelector
                                    label="account.user_issued_assets.name"
                                    onChange={onInputMarket}
                                    asset={stateRef.current.marketInput}
                                    assetInput={stateRef.current.marketInput}
                                    style={{
                                        width: "100%",
                                        paddingRight: "10px"
                                    }}
                                    onFound={onFoundMarketAsset}
                                />

                                {is_prediction_market ? (
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
                            </div>
                        </Tab>

                        {isBitAsset ? (
                            <Tab title="account.user_issued_assets.bitasset_opts">
                                <BitAssetOptionsContainer
                                    bitasset_opts={bitasset_opts}
                                    onUpdate={onChangeBitAssetOpts}
                                    backingAsset={
                                        bitasset_opts.short_backing_asset
                                    }
                                    assetPrecision={update.precision}
                                    assetSymbol={update.symbol}
                                    isPredictionMarket={is_prediction_market}
                                />
                            </Tab>
                        ) : null}

                        <Tab title="account.permissions">
                            <div className="small-12 grid-content">
                                <div style={{maxWidth: 800}}>
                                    <HelpContent
                                        path={"components/AccountAssetCreate"}
                                        section="permissions"
                                    />
                                </div>
                                {permissions}
                            </div>
                        </Tab>

                        <Tab title="account.user_issued_assets.flags">
                            <div className="small-12 grid-content">
                                <div style={{maxWidth: 800}}>
                                    <HelpContent
                                        path={"components/AccountAssetCreate"}
                                        section="flags"
                                    />
                                </div>
                                {permissionBooleans["charge_market_fee"] ? (
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
                                                <Translate content="account.user_issued_assets.taker_fee_percent" />{" "}
                                                (%)
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
                                                <Translate content="account.user_issued_assets.max_market_fee" />{" "}
                                                ({update.symbol})
                                                <input
                                                    type="number"
                                                    value={
                                                        update.max_market_fee
                                                    }
                                                    onChange={(e: any) =>
                                                        onUpdateInput(
                                                            "max_market_fee",
                                                            e
                                                        )
                                                    }
                                                />
                                            </label>
                                            <div
                                                className={cnames({
                                                    disabled: !(
                                                        update.market_fee_percent >
                                                        0
                                                    )
                                                })}
                                            >
                                                <label>
                                                    <Translate content="account.user_issued_assets.reward_percent" />{" "}
                                                    (%)
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
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

function AccountAssetCreate(props: any) {
    useChainStoreTick();
    const core = (ChainStore as any).getAsset(props.core || "1.3.0");
    const globalObject = (ChainStore as any).getObject(
        props.globalObject || "2.0.0"
    );

    if (!core || !globalObject) {
        return <span />;
    }

    return (
        <AccountAssetCreateInner
            account={props.account}
            core={core}
            globalObject={globalObject}
        />
    );
}

export {AccountAssetCreate, BitAssetOptionsContainer as BitAssetOptions};
