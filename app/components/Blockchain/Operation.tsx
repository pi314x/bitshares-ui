// TypeScript/functional-component port of the legacy Operation.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped this file for
// `WalletApi`/`WalletDb`/`ApplicationApi`/`.add_type_operation`/
// `process_transaction` - none appear. It only renders a read-only
// summary row for a single already-broadcast operation (fee, block
// time, transaction-type label, and the per-op-type detail component
// from `./operations`, which is already fully ported and imported
// normally here per the task's instructions).
//
// Three original classes, ported as follows:
//
// - `TransactionLabel`: unchanged rendering, `shouldComponentUpdate` (a
//   pure boolean guard comparing `color`/`type`, no side effects)
//   dropped entirely - a function component simply re-renders on every
//   prop change, a superset of what the guard allowed through, so
//   output is unchanged.
//
// - `Row = BindToChainState(Row)` (required `dynGlobalObject:
//   ChainTypes.ChainObject`, `defaultProps: {dynGlobalObject: "2.1.0",
//   tempComponent: "tr"}`) becomes a `RowContainer`/`RowCore` split:
//   `RowContainer` resolves `dynGlobalObject` via `ChainStore.getObject`
//   (defaulting the id to "2.1.0", matching `defaultProps` - no real
//   caller ever passes a `dynGlobalObject` prop explicitly, grep-
//   confirmed below) under `useChainStoreTick()`, and gates on it being
//   `undefined` (BindToChainState.jsx's exact "only `undefined` -
//   genuinely still-loading - blocks; a resolved `null` renders
//   through" semantics), falling back to `<tr />` per the wrap site's
//   `tempComponent: "tr"` - required because `Row` renders as a `<tr>`
//   inside a `<table>` (`Explorer/Blocks.tsx`'s table, and the plain
//   `<table>`/`<tbody>` wrappers in `TransactionConfirm.jsx`/
//   `Transfer/InvoicePay.tsx`), where a bare fallback `<span/>` would be
//   invalid HTML - exactly the scenario `BindToChainState.jsx`'s own
//   header comment says `tempComponent` exists for. `Row`'s own
//   `shouldComponentUpdate` (comparing `dynGlobalObject`/computed
//   `last_irreversible_block_num`/`color`, again a pure boolean guard)
//   is dropped for the same reason as `TransactionLabel`'s. The
//   `fee.amount = parseInt(fee.amount, 10)` in-place mutation of the
//   `fee` prop object is preserved verbatim (a pre-existing quirk, not
//   introduced here).
//
// - `Operation = connect(Operation, {listenTo: [SettingsStore],
//   getProps})` becomes an `OperationContainer`/`OperationCore` split:
//   `OperationContainer` reads `marketDirections` via
//   `useAltStore(SettingsStore)` and passes it down, same pattern as
//   `AccountOrders.tsx`'s `AccountOrdersContainer`. `Operation`'s
//   `defaultProps` (`op: []`, `current: ""`, `block: null`,
//   `hideOpLabel: false`, `csvExportMode: false`) are applied by
//   destructuring with defaults in `OperationCore`, then re-merged into
//   the object handed to `opComponents(...)` (mirroring how the
//   original's `this.props`, already defaulted by React, flowed into
//   that same call) - this matters because several `./operations`
//   components (e.g. `AccountCreate.tsx`) read `props.current` off it.
//   `Operation`'s own `shouldComponentUpdate` (comparing `op[1]` via
//   `utils.are_equal_shallow`, `marketDirections`, and
//   `state.labelColor` - again a pure boolean guard, no side effects)
//   is dropped for the same reason as above. Its paired
//   `UNSAFE_componentWillReceiveProps` (`if (np.marketDirections !==
//   this.props.marketDirections) this.forceUpdate()`) is dropped too,
//   as a forced judgment call: that `forceUpdate()` was already fully
//   redundant even in the original, since `shouldComponentUpdate`
//   itself independently re-renders whenever `marketDirections`
//   differs - `componentWillReceiveProps` runs strictly before
//   `shouldComponentUpdate` in React's class lifecycle, so the
//   `forceUpdate()` call, when it fired, was forcing a render that the
//   ordinary props-changed update was about to perform anyway. A
//   function component re-renders on every prop change regardless, so
//   this has no hooks equivalent to reach for and none is needed.
//
// Grep-verified caller check (`grep -rn '"\./Operation"\|Blockchain/
// Operation"' app`): `Explorer/Blocks.tsx`, `TransactionConfirm.jsx`,
// `Transfer/InvoicePay.tsx`, `Notifier/Notifier.jsx` - none pass
// `dynGlobalObject` (that prop only reaches `Row`, which none of them
// render directly), confirming the "2.1.0" default is what's always
// used in practice.
import * as React from "react";
import FormattedAsset from "../Utility/FormattedAsset";
import {Link} from "react-router-dom";
import classNames from "classnames";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import utils from "common/utils";
import BlockTime from "./BlockTime";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import {ChainStore, ChainTypes as grapheneChainTypes} from "bitsharesjs";
import SettingsStore from "stores/SettingsStore";
import {Tooltip} from "../../design-system/Tooltip";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const {operations} = grapheneChainTypes;
import opComponents from "./operations";
import "./operations.scss";

const ops = Object.keys(operations);

// `react-router-dom`'s `Link` type doesn't line up with this repo's React
// type version in a plain JSX position (`TS2786`) - same workaround as
// `AccountOrders.tsx`'s `LinkComponent`.
const LinkComponent = Link as React.ComponentType<any>;

interface TransactionLabelProps {
    color?: string;
    type: any;
}

function TransactionLabel({color, type}: TransactionLabelProps) {
    const trxTypes = (counterpart.translate("transaction.trxTypes") as any);
    const labelClass = classNames("label", color || "info");
    return <span className={labelClass}>{trxTypes[ops[type]]}</span>;
}

interface RowCoreProps {
    dynGlobalObject: any;
    block: number;
    fee: any;
    color?: string;
    type: any;
    hideOpLabel?: boolean;
    hidePending?: boolean;
    includeOperationId?: any;
    operationId?: any;
    txIndex?: any;
    info?: React.ReactNode;
    hideFee?: boolean;
    hideDate?: boolean;
    fullDate?: boolean;
}

function RowCore({
    dynGlobalObject,
    block,
    fee,
    color,
    type,
    hideOpLabel,
    hidePending,
    includeOperationId,
    operationId,
    txIndex,
    info,
    hideFee,
    hideDate,
    fullDate
}: RowCoreProps) {
    const last_irreversible_block_num = dynGlobalObject.get(
        "last_irreversible_block_num"
    );
    let pending: React.ReactNode = null;
    if (!hidePending && block > last_irreversible_block_num) {
        pending = (
            <span>
                (
                <Translate
                    content="operation.pending"
                    blocks={block - last_irreversible_block_num}
                />
                )
            </span>
        );
    }

    fee.amount = parseInt(fee.amount, 10);

    return (
        <tr>
            {includeOperationId ? (
                <td style={{textAlign: "left"}}>{operationId}</td>
            ) : null}
            {hideOpLabel ? null : (
                <td
                    style={{textAlign: "left"}}
                    className="left-td column-hide-tiny"
                >
                    <Tooltip
                        placement="bottom"
                        title={counterpart.translate("tooltip.show_block", {
                            block: utils.format_number(block, 0)
                        })}
                    >
                        <LinkComponent
                            className="inline-block"
                            to={`/block/${block}/${txIndex}`}
                        >
                            <TransactionLabel color={color} type={type} />
                        </LinkComponent>
                    </Tooltip>
                </td>
            )}

            <td style={{padding: "8px 5px", textAlign: "left"}}>
                <div>
                    <span>{info}</span>
                </div>
                <div style={{fontSize: 14, paddingTop: 5}}>
                    {pending ? <span> - {pending}</span> : null}
                </div>
            </td>
            {!hideFee && (
                <td style={{textAlign: "left"}}>
                    <FormattedAsset amount={fee.amount} asset={fee.asset_id} />
                </td>
            )}
            <td>
                {!hideDate ? (
                    <BlockTime block_number={block} fullDate={fullDate} />
                ) : null}
            </td>
        </tr>
    );
}

interface RowContainerProps extends Omit<RowCoreProps, "dynGlobalObject"> {
    dynGlobalObject?: any;
}

function RowContainer({
    dynGlobalObject = "2.1.0",
    ...rest
}: RowContainerProps) {
    useChainStoreTick();
    const resolvedDynGlobalObject = (ChainStore as any).getObject(
        dynGlobalObject,
        false,
        undefined
    );

    if (resolvedDynGlobalObject === undefined) {
        return <tr />;
    }

    return <RowCore {...(rest as any)} dynGlobalObject={resolvedDynGlobalObject} />;
}

interface OperationCoreProps {
    op?: any[];
    current?: string;
    block?: number | null;
    hideOpLabel?: boolean;
    csvExportMode?: boolean;
    marketDirections: any;
    operationId?: any;
    txIndex?: any;
    includeOperationId?: any;
    hideDate?: any;
    hideFee?: any;
    hidePending?: any;
    fullDate?: any;
    result?: any;
    [key: string]: any;
}

function OperationCore(props: OperationCoreProps) {
    const {
        op = [],
        current = "",
        block = null,
        hideOpLabel = false,
        csvExportMode = false,
        ...restProps
    } = props;

    const [labelColor, setLabelColor] = React.useState("info");

    const linkToAccount = (name_or_id: any) => {
        if (!name_or_id) return <span>-</span>;
        return utils.is_object_id(name_or_id) ? (
            <LinkToAccountById account={name_or_id} />
        ) : (
            <LinkComponent to={`/account/${name_or_id}`}>{name_or_id}</LinkComponent>
        );
    };

    const linkToAsset = (symbol_or_id: any) => {
        if (!symbol_or_id) return <span>-</span>;
        return utils.is_object_id(symbol_or_id) ? (
            <LinkToAssetById asset={symbol_or_id} />
        ) : (
            <LinkComponent to={`/asset/${symbol_or_id}`}>{symbol_or_id}</LinkComponent>
        );
    };

    const changeColor = (newColor: string) => {
        setLabelColor(prevColor =>
            prevColor !== newColor ? newColor : prevColor
        );
    };

    const resolvedProps = {
        ...restProps,
        op,
        current,
        block,
        hideOpLabel,
        csvExportMode
    };

    const column = (opComponents as any)(ops[op[0]], resolvedProps, {
        fromComponent: "operation",
        linkToAccount,
        linkToAsset,
        changeColor
    });

    if (csvExportMode) {
        const globalObject = (ChainStore as any).getObject("2.0.0");
        const dynGlobalObject = (ChainStore as any).getObject("2.1.0");
        const block_time = (utils as any).calc_block_time(
            block,
            globalObject,
            dynGlobalObject
        );
        return (
            <div>
                <div>{block_time ? block_time.toLocaleString() : ""}</div>
                <div>{ops[op[0]]}</div>
                <div>{column}</div>
                <div>
                    <FormattedAsset
                        amount={parseInt(op[1].fee.amount, 10)}
                        asset={op[1].fee.asset_id}
                    />
                </div>
            </div>
        );
    }

    const line = column ? (
        <RowContainer
            operationId={restProps.operationId}
            txIndex={restProps.txIndex}
            includeOperationId={restProps.includeOperationId}
            block={block as any}
            type={op[0]}
            color={labelColor}
            fee={op[1].fee}
            hideOpLabel={hideOpLabel}
            hideDate={restProps.hideDate}
            info={column}
            hideFee={restProps.hideFee}
            hidePending={restProps.hidePending}
            fullDate={restProps.fullDate}
        />
    ) : null;

    return line ? line : <tr />;
}

type OperationContainerProps = Omit<OperationCoreProps, "marketDirections">;

function OperationContainer(props: OperationContainerProps) {
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <OperationCore
            {...(props as any)}
            marketDirections={settingsState.marketDirections}
        />
    );
}

export default OperationContainer;
