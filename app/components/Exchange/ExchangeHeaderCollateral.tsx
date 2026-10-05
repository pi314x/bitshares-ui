// TypeScript/function-component port of the legacy
// ExchangeHeaderCollateral.jsx (Exchange/ final batch,
// docs/UI_MIGRATION_PLAN.md Phase 8). Mechanical translation, no logic
// changes intended.
//
// Not security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`Actions\.`/`ApplicationApi\.` - none appear; this renders
// a read-only collateral-ratio stat in the Exchange header).
//
// Two original classes, both wrapped in `BindToChainState` with no
// options object (so `show_loader` is falsy throughout - the "no
// option" blank-`<span/>`-while-loading case established across this
// migration, e.g. `Blockchain/Fees.tsx`'s `FeeGroupContainer`):
// - `ExchangeHeaderCollateral = BindToChainState(ExchangeHeaderCollateral)`
//   (required `object: ChainTypes.ChainObject`) becomes
//   `ExchangeHeaderCollateral` (the exported default) resolving `object`
//   via `ChainStore.getObject` + `useChainStoreTick()`, gating on
//   `resolvedObject === undefined` (matching `BindToChainState.jsx`'s
//   exact "only `undefined` - genuinely still loading - blocks; a
//   resolved `null` renders through" semantics, not a truthiness check)
//   with a blank `<span/>` fallback.
// - `MarginPosition = BindToChainState(MarginPosition)` (required
//   `debtAsset`/`collateralAsset: ChainTypes.ChainAsset`) becomes
//   `MarginPosition` (a `Container`+`Core` split), resolving both via
//   `ChainStore.getAsset` + its own, independent `useChainStoreTick()` -
//   both original wraps really do subscribe to `ChainStore`
//   independently, so both ports keep their own tick subscription too,
//   matching the already-established double-subscription treatment
//   from `Account/Proposals.tsx`/`Modal/ProposalModal.tsx`.
// - The original's exact prop-merge order is preserved: `<MarginPosition
//   debtAsset={...} collateralAsset={...} account={account}
//   {...this.props} />` (explicit props first, full `this.props` spread
//   *after* - a no-op in practice since `this.props` never actually
//   carries literal `debtAsset`/`collateralAsset`/`account` keys here,
//   but kept in the same order rather than re-derived) is reproduced
//   with the same ordering below, and `MarginPositionContainer`'s own
//   `<MarginPositionCore {...props} debtAsset={...}
//   collateralAsset={...} />` reproduces `BindToChainState.jsx`'s
//   `render()`, which spreads the (chain-prop-omitted) original props
//   first and the freshly-resolved chain state *after* (so the resolved
//   values win) - same effective order, just without the explicit
//   `omit()` step, since re-declaring the same two keys after the
//   spread already wins regardless of what (if anything) `props` still
//   carries under those names.
// - `object`'s resolved value is forwarded through to `MarginPositionCore`
//   unchanged (it isn't declared on `MarginPosition`'s own `propTypes`,
//   so the inner `BindToChainState` wrap never touched it in the
//   original either) because `MarginPositionCore`'s own
//   `_getCollateralRatio` reads `this.props.object` directly - grepped
//   to confirm this is the *same* `object` prop, not a different one.
//
// Preserved bugs/quirks, not fixed:
// - `_getFeedPrice`'s `if (!this.props) { return 1; }` guard is dead in
//   practice (a function component's `props` argument is never falsy),
//   same as it was effectively dead on a mounted class instance (`this`
//   is never falsy either) - kept verbatim as `if (!props) { return 1; }`
//   rather than removed, per this migration's preserve-verbatim
//   convention.
// - If `object` resolves to a non-`undefined`, falsy value (`null` -
//   deleted/missing chain object), the original still renders through
//   `BindToChainState`'s "resolved `null` passes" gate and then calls
//   `object.getIn(...)` on it, throwing a `TypeError`. Reproduced
//   verbatim (no added null-guard) rather than hardened.
//
// Lint-forced drop: `render()`'s local `const d =
// utils.get_asset_amount(co.debt, this.props.debtAsset);` is computed
// and never read anywhere in the returned JSX (confirmed by re-reading
// the original in full - `_getCollateralRatio` has its own, separate
// local `d` used internally, this is a second, dead one at the
// render-body level) - dropped here to satisfy `no-unused-vars`, which
// this file is now newly subject to; no behavior change.
import * as React from "react";
import utils from "common/utils";
import cnames from "classnames";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {Tooltip} from "bitshares-ui-style-guide";
import asset_utils from "../../lib/common/asset_utils";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface MarginPositionCoreProps {
    debtAsset: any;
    collateralAsset: any;
    object?: any;
    account?: any;
    className?: any;
    onClick?: any;
    [key: string]: any;
}

function MarginPositionCore(props: MarginPositionCoreProps) {
    const {debtAsset, collateralAsset} = props;

    const getFeedPrice = (): number => {
        if (!props) {
            return 1;
        }

        return (
            1 /
            utils.get_asset_price(
                asset_utils
                    .extractRawFeedPrice(debtAsset)
                    .getIn(["quote", "amount"]),
                collateralAsset,
                asset_utils
                    .extractRawFeedPrice(debtAsset)
                    .getIn(["base", "amount"]),
                debtAsset
            )
        );
    };

    const getCollateralRatio = (): number => {
        const co = props.object.toJS();
        const c = utils.get_asset_amount(co.collateral, collateralAsset);
        const d = utils.get_asset_amount(co.debt, debtAsset);
        return c / (d / getFeedPrice());
    };

    const getMR = (): number => {
        return (
            debtAsset.getIn([
                "bitasset",
                "current_feed",
                "maintenance_collateral_ratio"
            ]) / 1000
        );
    };

    const getStatusClass = (): string | null => {
        const cr = getCollateralRatio();
        const mr = getMR();

        if (isNaN(cr)) return null;
        if (cr < mr) {
            return "danger";
        } else if (cr < mr + 0.5) {
            return "warning";
        } else {
            return "";
        }
    };

    const getCRTip = (): string | null => {
        const statusClass = getStatusClass();
        const mr = getMR();
        if (!statusClass || statusClass === "") return null;

        if (statusClass === "danger") {
            return counterpart.translate("tooltip.cr_danger", {mr});
        } else if (statusClass === "warning") {
            return counterpart.translate("tooltip.cr_warning", {mr});
        } else {
            return null;
        }
    };

    const cr = getCollateralRatio();
    const statusClass = getStatusClass();

    return (
        <Tooltip placement="bottom" title={getCRTip()}>
            <li
                className={cnames("stressed-stat", props.className)}
                onClick={props.onClick}
            >
                <span>
                    <span className={cnames("value stat-primary", statusClass)}>
                        {utils.format_number(cr, 2)}
                    </span>
                </span>
                <div className="stat-text">
                    <Translate content="header.collateral_ratio" />
                </div>
            </li>
        </Tooltip>
    );
}

function MarginPositionContainer(props: MarginPositionCoreProps) {
    useChainStoreTick();

    const resolvedDebtAsset = (ChainStore as any).getAsset(props.debtAsset);
    const resolvedCollateralAsset = (ChainStore as any).getAsset(
        props.collateralAsset
    );

    if (
        resolvedDebtAsset === undefined ||
        resolvedCollateralAsset === undefined
    ) {
        return <span />;
    }

    return (
        <MarginPositionCore
            {...props}
            debtAsset={resolvedDebtAsset}
            collateralAsset={resolvedCollateralAsset}
        />
    );
}

export interface ExchangeHeaderCollateralProps {
    object: any;
    account?: any;
    className?: any;
    onClick?: any;
    [key: string]: any;
}

export default function ExchangeHeaderCollateral(
    props: ExchangeHeaderCollateralProps
) {
    useChainStoreTick();

    const resolvedObject = (ChainStore as any).getObject(props.object);

    if (resolvedObject === undefined) {
        return <span />;
    }

    const debtAsset = resolvedObject.getIn(["call_price", "quote", "asset_id"]);
    const collateralAsset = resolvedObject.getIn([
        "call_price",
        "base",
        "asset_id"
    ]);

    return (
        <MarginPositionContainer
            debtAsset={debtAsset}
            collateralAsset={collateralAsset}
            account={props.account}
            {...props}
            object={resolvedObject}
        />
    );
}
