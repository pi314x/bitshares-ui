// TypeScript port of the legacy DefaultOperation.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md); it now words the operation types that have no
// component of their own (see below) instead of always saying "unknown".
import * as React from "react";
import counterpart from "counterpart";
import OperationAnt from "../OperationAnt";

// The wording of an account's history (OperationAnt) covers the operation types
// that have no component of their own here (liquidity pools, flash loans, credit
// offers, tickets, order updates, ...); only a type with no wording at all is
// "unknown".
// (made on first use: OperationAnt imports the components that import this file)
let wording: any = null;
const getWording = () => wording || (wording = new (OperationAnt as any)());

interface DefaultOperationProps {
    op: any;
    current?: string;
    block?: number;
    result?: any;
    [key: string]: any;
}

export const DefaultOperation = ({
    op,
    current,
    block,
    result
}: DefaultOperationProps) => {
    let described: any = null;
    try {
        described = getWording().getColumn(
            op,
            current,
            block,
            result || [0, {}]
        );
    } catch (e) {
        described = null;
    }
    if (described && !described.unknown && described.column) {
        return <span>{described.column}</span>;
    }
    return (
        <span>
            {counterpart.translate("operation.unknown_operation")} {op[0]}
        </span>
    );
};
