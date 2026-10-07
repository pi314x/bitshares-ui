// TypeScript/functional-component port of the legacy ProposedOperation.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Non-security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. Purely a read-only operation-row renderer (delegates the
// actual per-op-type rendering to the already-ported `./operations`
// directory via `opComponents`).
//
// Two original classes, both plain (no `BindToChainState`/`connect`):
// - `Row` becomes a small function component, `RowCore`.
// - `ProposedOperation` becomes a function component using
//   `React.useState` for its one state field (`label_color`).
//
// `TransactionIDAndExpiry` was already a plain functional component - a
// mechanical PropTypes -> TS interface conversion only.
//
// Dropped as confirmed dead (grepped): `Row`'s constructor-bound
// `showDetails` method and its `this.props.history.push(...)` call - the
// method is defined and bound but never referenced anywhere in `Row`'s
// JSX (no `onClick` wires it up), and no real caller of
// `ProposedOperation` (`OperationAnt.js`, `Blockchain/Transaction.tsx`,
// `Blockchain/operations/ProposalCreate.tsx`, `Account/Proposals.tsx`)
// ever passes a `history` prop either - genuinely unreachable dead code,
// not merely unused.
//
// `Row` is only ever instantiated once, from `ProposedOperation`'s own
// `render()`, with a fixed set of props - `index`, `block`, `type`,
// `color`, `hideDate`, `hideOpLabel` are all passed down but grep-
// confirmed never read inside `Row`'s own render body (only `id`, `fee`,
// `hideFee`, `hideExpiration`, `expiration`, and `info` are) - kept as
// accepted-but-unused fields on `RowCoreProps` (not destructured, so no
// unused-variable lint issue), exactly matching the original class, which
// likewise never destructures them off `this.props`. In particular,
// `label_color`/`changeColor` (below) are real, live state - `changeColor`
// is genuinely called by many `./operations` components (as a
// `changeColor("warning")`-style side effect passed through `opComponents`'
// third `opts` argument) and does update `label_color`/force a re-render -
// but the resulting `color` prop this component passes down to `Row` is
// never actually rendered anywhere, an existing (if likely unintended)
// characteristic of the original, preserved verbatim rather than "fixed"
// by wiring `color` into `Row`'s markup.
//
// `opComponents(ops[op[0]], this.props, {...})` passes the *entire*
// effective props object (`this.props`, with `defaultProps` already
// merged in by React) through to the per-op-type renderer - real callers
// pass extra props this component never itself names (`inverted`,
// `proposal`, `result`, `fromComponent`, etc.), which individual
// `./operations` components do read. `effectiveProps` below reconstructs
// that same object (destructured defaults standing in for
// `defaultProps`, `...rest` catching everything else) rather than passing
// the raw function-component `props` bag directly, since the
// destructuring already normalizes default values the same way React's
// class-component `defaultProps` merge did.
//
// TS-forced adjustment: the original's `csvExportMode` branch rendered
// `<div key={this.props.key}>` - React never actually forwards a `key`
// prop into any component's `props` (class or function), so this was
// always `undefined` at runtime regardless, and isn't even nameable on a
// TS props type - dropped rather than worked around, same precedent as
// `CreatePoolModal.tsx`'s `SearchListItem` (Modal/ batch 8).
import * as React from "react";
import FormattedAsset from "../Utility/FormattedAsset";
import {Link as RouterLink} from "react-router-dom";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import utils from "common/utils";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import {ChainStore, ChainTypes as grapheneChainTypes} from "bitsharesjs";
import opComponents from "./operations";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import {Icon as AntIcon} from "../../design-system/Icon";

import "./operations.scss";

const {operations} = grapheneChainTypes as any;

const ops = Object.keys(operations);

// `@types/react-router-dom`'s `Link` type doesn't line up with this
// codebase's React types (this migration's recurring friction, e.g.
// `AccountPortfolioList.tsx`) - aliased through `React.ComponentType<any>`.
const Link = RouterLink as React.ComponentType<any>;

interface TransactionIDAndExpiryProps {
    id: any;
    expiration: any;
    style?: React.CSSProperties;
    openJSONModal?: (() => void) | null;
}

export const TransactionIDAndExpiry = ({
    id,
    expiration,
    style,
    openJSONModal = null
}: TransactionIDAndExpiryProps) => {
    const endDate = (counterpart as any).localize(new Date(expiration), {
        format: "short"
    });
    return (
        <b style={style}>
            {openJSONModal ? (
                <span className="cursor-pointer" onClick={openJSONModal}>
                    {id} <AntIcon type="file-search" />
                    {" | "}
                </span>
            ) : (
                <span>{id} | </span>
            )}
            <span>
                <Translate content="proposal.expires" />: {endDate}
            </span>
        </b>
    );
};

interface RowCoreProps {
    id: any;
    fee: {amount: any; asset_id: any};
    hideFee?: boolean;
    hideExpiration?: boolean;
    expiration?: any;
    info?: React.ReactNode;
    index?: any;
    block?: any;
    type?: any;
    color?: any;
    hideDate?: any;
    hideOpLabel?: any;
}

function RowCore({
    id,
    fee,
    hideFee,
    hideExpiration,
    expiration,
    info
}: RowCoreProps) {
    fee.amount = parseInt(fee.amount, 10);

    return (
        <div style={{padding: "5px 0", textAlign: "left"}}>
            <span>
                {info}
                &nbsp;
                {hideFee ? null : (
                    <span className="facolor-fee">
                        (
                        <FormattedAsset
                            amount={fee.amount}
                            asset={fee.asset_id}
                        />{" "}
                        fee)
                    </span>
                )}
            </span>
            {!hideExpiration &&
                expiration && (
                    <TransactionIDAndExpiry
                        id={id}
                        expiration={expiration}
                        style={{
                            paddingTop: 5,
                            fontSize: "0.85rem",
                            paddingBottom: "0.5rem",
                            display: "block"
                        }}
                    />
                )}
        </div>
    );
}

interface ProposedOperationProps {
    op: any[];
    current?: string;
    block?: number | null;
    hideDate?: boolean;
    hideFee?: boolean;
    hideOpLabel?: boolean;
    csvExportMode?: boolean;
    collapsed?: boolean;
    proposer?: any;
    hideExpiration?: boolean;
    index?: any;
    id?: any;
    expiration?: any;
    [key: string]: any;
}

function ProposedOperation({
    op = [],
    current = "",
    proposer,
    block = null,
    hideExpiration,
    index,
    csvExportMode = false,
    hideDate = false,
    hideFee = false,
    hideOpLabel = false,
    collapsed = true,
    id,
    expiration,
    ...rest
}: ProposedOperationProps) {
    const [labelColor, setLabelColor] = React.useState("info");

    const linkToAccount = (name_or_id: any) => {
        if (!name_or_id) return <span>-</span>;
        return (utils as any).is_object_id(name_or_id) ? (
            <LinkToAccountById account={name_or_id} />
        ) : (
            <Link to={`/account/${name_or_id}/overview`}>{name_or_id}</Link>
        );
    };

    const linkToAsset = (symbol_or_id: any) => {
        if (!symbol_or_id) return <span>-</span>;
        return (utils as any).is_object_id(symbol_or_id) ? (
            <LinkToAssetById asset={symbol_or_id} />
        ) : (
            <Link to={`/asset/${symbol_or_id}`}>{symbol_or_id}</Link>
        );
    };

    const changeColor = (newColor: string) => {
        if (labelColor !== newColor) {
            setLabelColor(newColor);
        }
    };

    // TODO: add scu

    let line = null;
    let column: any = null;

    // Reassembles the full effective-props object (`this.props` in the
    // original class, with `defaultProps` merged in) to hand to
    // `opComponents`, exactly as the original passes `this.props` itself -
    // including any extra props a caller passes that this component
    // doesn't itself name (e.g. `inverted`, `proposal`, `result`,
    // `fromComponent`), via `...rest`.
    const effectiveProps = {
        ...rest,
        op,
        current,
        block,
        hideDate,
        hideFee,
        hideOpLabel,
        csvExportMode,
        collapsed,
        proposer,
        hideExpiration,
        index,
        id,
        expiration
    };

    column = (opComponents as any)(ops[op[0]], effectiveProps, {
        fromComponent: "proposed_operation",
        linkToAccount,
        linkToAsset,
        changeColor
    });

    if (!!proposer) {
        column = (
            <div className="inline-block">
                {index == 0 ? (
                    <div style={{paddingBottom: "0.5rem"}}>
                        <TranslateWithLinks
                            string="operation.proposal_create"
                            keys={[
                                {
                                    type: "account",
                                    value: proposer,
                                    arg: "account"
                                }
                            ]}
                        />
                    </div>
                ) : null}
                <div style={{marginLeft: "0.5rem"}}>{column}</div>
            </div>
        );
    }

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

    line = column ? (
        <RowCore
            index={index}
            id={id}
            block={block}
            type={op[0]}
            color={labelColor}
            fee={op[1].fee}
            hideDate={hideDate}
            hideFee={hideFee}
            hideOpLabel={hideOpLabel}
            info={column}
            expiration={expiration}
            hideExpiration={hideExpiration}
        />
    ) : null;

    return line ? line : <div />;
}

export default ProposedOperation;
