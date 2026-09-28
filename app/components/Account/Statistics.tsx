// TypeScript/functional-component port of the legacy Statistics.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(Statistics)` HOC (resolving the required
// `stat_object` prop via `ChainStore.getObject`) is replaced by a small
// container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../Utility/FormattedAsset";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface StatisticsProps {
    stat_object: string;
    plainText?: boolean;
}

interface StatisticsCoreProps {
    stat_object: any;
    plainText?: boolean;
}

function Statistics({stat_object: statObjectResolved, plainText}: StatisticsCoreProps) {
    const stat_object = statObjectResolved.toJS();

    return plainText ? (
        <FormattedAsset
            amount={parseFloat(stat_object.lifetime_fees_paid)}
            asset="1.3.0"
        />
    ) : (
        <tbody>
            <tr>
                <td>
                    <Translate content="account.member.fees_paid" />{" "}
                </td>
                <td>
                    <FormattedAsset
                        amount={parseFloat(stat_object.lifetime_fees_paid)}
                        asset="1.3.0"
                    />
                </td>
            </tr>
        </tbody>
    );
}

function StatisticsContainer({stat_object, plainText}: StatisticsProps) {
    useChainStoreTick();
    const resolved = ChainStore.getObject(stat_object);

    if (!resolved) {
        return <span />;
    }

    return <Statistics stat_object={resolved} plainText={plainText} />;
}

export default StatisticsContainer;
