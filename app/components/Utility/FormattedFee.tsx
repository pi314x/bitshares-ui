// TypeScript/functional-component port of the legacy FormattedFee.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(FormattedFee)` HOC wrapping (resolving the required
// `globalObject` prop, defaulting to `"2.0.0"`) is replaced by a small
// container component resolving it directly via `ChainStore.getObject`
// under `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern. `globalObject` is `.isRequired`
// in the original propTypes, so `BindToChainState` gated rendering behind
// a loading fallback until it resolved - replicated here the same way.
import * as React from "react";
import FormattedAsset from "./FormattedAsset";
import {estimateFee} from "common/trxHelper";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface FormattedFeeProps {
    globalObject?: any;
    opType?: string;
    options?: any[];
}

function FormattedFee({globalObject, opType, options = []}: FormattedFeeProps) {
    if (!opType || !options || !globalObject) {
        return null;
    }

    const amount = (estimateFee as any)(opType, options, globalObject);

    return <FormattedAsset amount={amount} asset="1.3.0" />;
}

function FormattedFeeContainer(props: FormattedFeeProps) {
    useChainStoreTick();
    const globalObject = ChainStore.getObject(props.globalObject || "2.0.0");

    if (!globalObject) {
        return <span />;
    }

    return <FormattedFee {...props} globalObject={globalObject} />;
}

export default FormattedFeeContainer;
