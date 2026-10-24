// TypeScript/functional-component port of the legacy AssetPublishFeed.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not to be confused with the unrelated, already-ported
// `Blockchain/operations/AssetPublishFeed.tsx` (a read-only operation-row
// renderer used by `opComponents`) - this file is the standalone feed-
// publishing *form* rendered directly by `Asset.tsx`.
//
// Non-security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. `onSubmit` only calls `AssetActions.publishFeed({...})`
// (a flux action creator dispatching to `AssetStore`, out of scope here,
// which builds/signs the real `asset_publish_feed` transaction).
//
// `AssetPublishFeed = BindToChainState(AssetPublishFeed)` (required
// `account: ChainTypes.ChainAccount.isRequired`) becomes a Container+Core
// split, gating on `resolvedAccount === undefined` with a blank `<span/>`
// fallback, per `BindToChainState.jsx`'s exact "only `undefined` - still
// resolving - blocks; a resolved `null` renders through" semantics (this
// class declares neither `defaultProps.tempComponent` nor
// `{show_loader: true}` at either wrap site). `AssetPublishFeed =
// AssetWrapper(AssetPublishFeed)` (default `propNames: ["asset"]`,
// `withDynamic` not set) is kept as-is around the Container, an unchanged
// out-of-scope HOC, same treatment as `SettleModal.tsx`/
// `BidCollateralOperation.tsx`'s `AssetWrapper` wraps.
//
// `resetState(props)` (recomputing `publisher`/`publisher_id`/`mcr`/
// `mcrValue`/`mssr`/`mssrValue` from the resolved `account`/`asset` props)
// becomes a plain function called once as the `useState` lazy
// initializer - the original only ever calls it from the constructor (the
// two other in-file call sites are both inside comments,
// `// this.setState(this.resetState())` in `onSubmit`'s dead `.then(...)`
// and the commented-out reset `<button>` - both dead, matching the
// original exactly, since the real component never re-runs `resetState`
// after mount). `onAccountNameChanged`/`onAccountChanged`/`onPriceChanged`/
// `onSetRatio` become plain closures using a local `mergeState` helper for
// each single-key `setState({[key]: ...})` call, preserving the dynamic-
// key behavior via computed object properties.
//
// `cer`/`feedPrice` are written by `onPriceChanged` (via `PriceInput`'s
// `onPriceChanged` callback) and read only inside `onSubmit`'s
// `AssetActions.publishFeed({...})` call - both real, kept as state even
// though they're never part of the initial `resetState()` object (exactly
// as in the original, where they start life as `undefined` on
// `this.state` until a `PriceInput` first calls its callback).
import * as React from "react";
import AccountSelector from "../Account/AccountSelector";
import Translate from "react-translate-component";
import classnames from "classnames";
import AssetActions from "actions/AssetActions";
import AssetWrapper from "../Utility/AssetWrapper";
import PriceInput from "../Utility/PriceInput";
import AmountSelector from "../Utility/AmountSelector";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface AssetPublishFeedState {
    publisher: any;
    publisher_id: any;
    mcr: any;
    mcrValue: any;
    mssr: any;
    mssrValue: any;
    cer?: any;
    feedPrice?: any;
}

function resetState(props: {account: any; asset: any}): AssetPublishFeedState {
    const publisher_id = props.account.get("id");

    const currentFeed = props.asset.getIn(["bitasset", "current_feed"]);

    /* Might need to check these default values */
    const mcr = currentFeed.get("maintenance_collateral_ratio", 1750);
    const mssr = currentFeed.get("maximum_short_squeeze_ratio", 1100);

    return {
        publisher: props.account.get("name"),
        publisher_id,
        mcr,
        mcrValue: mcr / 1000,
        mssr,
        mssrValue: mssr / 1000
    };
}

interface AssetPublishFeedCoreProps {
    account: any;
    asset: any;
    [key: string]: any;
}

function AssetPublishFeedCore({account, asset}: AssetPublishFeedCoreProps) {
    const [state, setState] = React.useState<AssetPublishFeedState>(() =>
        resetState({account, asset})
    );

    const mergeState = (patch: Partial<AssetPublishFeedState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const onAccountNameChanged = (key: string, name: any) => {
        mergeState({[key]: name} as any);
    };

    const onAccountChanged = (key: string, account: any) => {
        mergeState({[key]: account ? account.get("id") : null} as any);
    };

    const onSubmit = () => {
        (AssetActions as any).publishFeed({
            publisher: state.publisher_id,
            asset_id: asset.get("id"),
            mcr: state.mcr,
            mssr: state.mssr,
            feedPrice: state.feedPrice,
            cer: state.cer
        });
        // .then(() => {
        //     this.setState(this.resetState());
        // });
    };

    const onPriceChanged = (key: string, value: any) => {
        mergeState({[key]: value} as any);
    };

    const onSetRatio = (key: string, {amount}: {amount: any}) => {
        /* Enforce one decimal point maximum */
        if (
            !!amount &&
            typeof amount === "string" &&
            amount.indexOf(".") !== -1 &&
            amount.indexOf(".") + 4 !== amount.length
        ) {
            amount = amount.substr(0, amount.indexOf(".") + 4);
        }
        mergeState({
            [key + "Value"]: amount,
            [key]: Math.floor(parseFloat(amount) * 1000)
        } as any);
    };

    const {mcrValue, mssrValue, publisher} = state;

    const base = asset.get("id");
    const quote = asset.getIn(["bitasset", "options", "short_backing_asset"]);

    return (
        <div>
            <AccountSelector
                label="explorer.asset.feed_producer"
                accountName={publisher}
                onChange={onAccountNameChanged.bind(null, "publisher")}
                onAccountChanged={onAccountChanged.bind(null, "publisher_id")}
                account={publisher}
                error={null}
                tabIndex={1}
                typeahead={true}
            />

            {/* Core Exchange Rate */}
            <br />
            <PriceInput
                onPriceChanged={onPriceChanged.bind(null, "cer")}
                label="explorer.asset.fee_pool.core_exchange_rate"
                quote={"1.3.0"}
                base={base}
            />

            {/* Settlement Price */}
            <br />
            <PriceInput
                onPriceChanged={onPriceChanged.bind(null, "feedPrice")}
                label="explorer.asset.price_feed.feed_price"
                quote={quote}
                base={base}
            />

            {/* MCR */}
            <br />
            <AmountSelector
                label="explorer.asset.price_feed.maintenance_collateral_ratio"
                amount={mcrValue}
                onChange={onSetRatio.bind(null, "mcr")}
                placeholder="0.0"
                style={{
                    width: "100%",
                    paddingRight: "10px"
                }}
            />

            {/* MSSR */}
            <br />
            <AmountSelector
                label="explorer.asset.price_feed.maximum_short_squeeze_ratio"
                amount={mssrValue}
                onChange={onSetRatio.bind(null, "mssr")}
                placeholder="0.0"
                style={{
                    width: "100%",
                    paddingRight: "10px"
                }}
            />

            <div style={{paddingTop: "1rem"}} className="button-group">
                <button
                    className={classnames("button", {
                        disabled: false
                    })}
                    onClick={onSubmit}
                >
                    <Translate content="transaction.trxTypes.asset_publish_feed" />
                </button>

                {/* <button
                    className="button outline"
                    onClick={() => {
                        this.resetState(this.props);
                    }}
                >
                    <Translate content="account.perm.reset" />
                </button> */}
            </div>
        </div>
    );
}

interface AssetPublishFeedContainerProps {
    account: any;
    asset: any;
    [key: string]: any;
}

function AssetPublishFeedContainer({
    account,
    ...rest
}: AssetPublishFeedContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account);

    if (resolvedAccount === undefined) {
        return <span />;
    }

    return (
        <AssetPublishFeedCore {...(rest as any)} account={resolvedAccount} />
    );
}

export default AssetWrapper(AssetPublishFeedContainer as any);
