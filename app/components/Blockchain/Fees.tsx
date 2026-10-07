// TypeScript/functional-component port of the legacy Fees.jsx
// (Blockchain/ batch 1, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic
// changes intended.
//
// Two original classes:
// - `FeeGroup = BindToChainState(FeeGroup)` (required
//   `globalObject: ChainTypes.ChainObject.isRequired`, `defaultProps:
//   {globalObject: "2.0.0"}`) becomes a `FeeGroupContainer` +
//   `FeeGroupCore` split, following the established pattern from
//   `Modal/ProposalModal.tsx`/`Account/NestedApprovalState.tsx`:
//   `FeeGroupContainer` resolves `globalObject` via
//   `ChainStore.getObject` + `useChainStoreTick()` and gates on
//   `resolvedGlobalObject === undefined` (matching
//   `BindToChainState.jsx`'s exact "only `undefined` - genuinely still
//   loading - blocks; a resolved `null` renders through" semantics) with
//   a blank `<span/>` fallback, since neither the original class nor its
//   wrap site (`BindToChainState(FeeGroup)`, no options object) declares
//   a `tempComponent` or passes `show_loader`. `globalObject` is never
//   actually passed by this file's one caller below (`<FeeGroup
//   key={...} settings={...} opIds={...} title={...} />`), so in
//   practice `FeeGroupContainer` always resolves the `defaultProps`
//   value, `"2.0.0"`.
// - `FeeGroup`'s own `shouldComponentUpdate` (pure `Immutable.is`
//   perf guard over `globalObject`, no side effect) is dropped entirely
//   per this migration's convention - it never changes the final
//   rendered output.
// - `settings`/`opIds`/`title` are plain props (not declared in
//   `propTypes` as any `ChainTypes.*`), so `BindToChainState` never
//   touched them; they pass straight through unchanged here too.
// - `Fees` (no lifecycle, no state - a pure render) becomes a plain
//   function component.
//
// `ChainTypes` (only ever used for `FeeGroup.propTypes.globalObject`)
// and `BindToChainState` are dropped as imports, replaced by
// `useChainStoreTick` + direct `ChainStore.getObject` as above.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear; this file only reads the fee schedule out of the
// current-global-parameters chain object and displays it.
import * as React from "react";
import counterpart from "counterpart";
import classNames from "classnames";
import Translate from "react-translate-component";
import HelpContent from "../Utility/HelpContent";
import FormattedAsset from "../Utility/FormattedAsset";
import {EquivalentValueComponent} from "../Utility/EquivalentValueComponent";
import {ChainStore, ChainTypes as grapheneChainTypes} from "bitsharesjs";
import {Card} from "../../design-system/Card";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const {operations} = grapheneChainTypes as any;
const ops = Object.keys(operations);

// Define groups and their corresponding operation ids
const fee_grouping: Record<string, number[]> = {
    general: [
        0,
        25,
        26,
        27,
        28,
        32,
        33,
        37,
        39,
        41,
        49,
        50,
        52,
        69,
        70,
        71,
        72,
        73
    ],
    asset: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 38, 43, 44, 47, 48],
    market: [1, 2, 3, 4, 45, 46, 59, 60, 61, 62, 63],
    account: [5, 6, 7, 8, 9],
    business: [20, 21, 22, 23, 24, 29, 30, 31, 34, 35, 36]
};

// Operations that require LTM
const ltm_required = [5, 7, 20, 21, 34];

interface FeeGroupCoreProps {
    globalObject: any;
    settings: any;
    opIds: number[];
    title: string;
}

function FeeGroupCore({globalObject, settings, opIds, title}: FeeGroupCoreProps) {
    const resolvedGlobalObject = globalObject.toJS();
    const core_asset = (ChainStore as any).getAsset("1.3.0");

    const current_fees = resolvedGlobalObject.parameters.current_fees;
    const network_fee = resolvedGlobalObject.parameters.network_percent_of_fee / 1e4;
    const scale = current_fees.scale;
    const feesRaw = current_fees.parameters;
    const preferredUnit = settings.get("fee_asset") || core_asset.get("symbol");

    const trxTypes: any = counterpart.translate("transaction.trxTypes");

    const fees = opIds.map(opID => {
        const feeIdx = feesRaw.findIndex((f: any) => f[0] === opID);
        if (feeIdx === -1) {
            console.warn(
                "Asking for non-existing fee id %d! Check group settings in Fees.jsx",
                opID
            );
            return; // FIXME, if I ask for a fee that does not exist?
        }

        const feeStruct = feesRaw[feeIdx];

        const opId = feeStruct[0];
        const fee = feeStruct[1];
        const operation_name = ops[opId];
        const feename = trxTypes[operation_name];

        let feeRateForLTM = network_fee;
        if (opId === 10) {
            // See https://github.com/bitshares/bitshares-ui/issues/996
            feeRateForLTM = 0.5 + 0.5 * network_fee;
        }

        const rows: React.ReactNode[] = [];
        let headIncluded = false;
        const labelClass = classNames("label", "info");

        for (const key in fee) {
            const amount = (fee[key] * scale) / 1e4;
            const amountForLTM = amount * feeRateForLTM;
            const feeTypes: any = counterpart.translate("transaction.feeTypes");
            const assetAmount = amount ? (
                <FormattedAsset amount={amount} asset="1.3.0" />
            ) : (
                feeTypes["_none"]
            );
            const equivalentAmount = amount ? (
                <EquivalentValueComponent
                    fromAsset="1.3.0"
                    fullPrecision={true}
                    amount={amount}
                    toAsset={preferredUnit}
                    fullDecimals={true}
                />
            ) : (
                feeTypes["_none"]
            );
            const assetAmountLTM = amountForLTM ? (
                <FormattedAsset amount={amountForLTM} asset="1.3.0" />
            ) : (
                feeTypes["_none"]
            );
            const equivalentAmountLTM = amountForLTM ? (
                <EquivalentValueComponent
                    fromAsset="1.3.0"
                    fullPrecision={true}
                    amount={amountForLTM}
                    toAsset={preferredUnit}
                    fullDecimals={true}
                />
            ) : (
                feeTypes["_none"]
            );
            let title: React.ReactNode = null;

            if (!headIncluded) {
                headIncluded = true;
                title = (
                    <td rowSpan={6} style={{width: "15em"}}>
                        <span className={labelClass}>{feename}</span>
                    </td>
                );
            }

            if (ltm_required.indexOf(opId) < 0) {
                if (feeTypes[key] != "Annual Membership") {
                    rows.push(
                        <tr key={opId.toString() + key}>
                            {title}
                            <td>{feeTypes[key]}</td>
                            <td style={{textAlign: "right"}}>
                                {assetAmount}
                                {amount !== 0 && preferredUnit !== "BTS" ? (
                                    <span>
                                        &nbsp;/&nbsp;
                                        {equivalentAmount}
                                    </span>
                                ) : null}
                            </td>
                            <td style={{textAlign: "right"}}>
                                {feeIdx !== 8 ? assetAmountLTM : null}
                                {feeIdx !== 8 &&
                                amount !== 0 &&
                                preferredUnit !== "BTS" ? (
                                    <span>
                                        &nbsp;/&nbsp;
                                        {equivalentAmountLTM}
                                    </span>
                                ) : null}
                            </td>
                        </tr>
                    );
                }
            } else {
                rows.push(
                    <tr key={opId.toString() + key}>
                        {title}
                        <td>{feeTypes[key]}</td>
                        <td style={{textAlign: "right"}}>
                            - <sup>*</sup>
                        </td>
                        <td style={{textAlign: "right"}}>
                            {assetAmountLTM}
                            {amount !== 0 && preferredUnit !== "BTS" ? (
                                <span>
                                    &nbsp;/&nbsp;
                                    {equivalentAmountLTM}
                                </span>
                            ) : null}
                        </td>
                    </tr>
                );
            }
        }
        return <tbody key={feeIdx}>{rows}</tbody>;
    });

    return (
        <div className="asset-card">
            <Card>{title.toUpperCase()}</Card>
            <table className="table">
                <thead>
                    <tr>
                        <th>
                            <Translate content={"explorer.block.op"} />
                        </th>
                        <th>
                            <Translate content={"explorer.fees.type"} />
                        </th>
                        <th style={{textAlign: "right"}}>
                            <Translate content={"explorer.fees.fee"} />
                        </th>
                        <th style={{textAlign: "right"}}>
                            <Translate content={"explorer.fees.feeltm"} />
                        </th>
                    </tr>
                </thead>
                {fees}
            </table>
        </div>
    );
}

interface FeeGroupContainerProps {
    globalObject?: string;
    settings: any;
    opIds: number[];
    title: string;
}

function FeeGroup({
    globalObject = "2.0.0",
    settings,
    opIds,
    title
}: FeeGroupContainerProps) {
    useChainStoreTick();
    const resolvedGlobalObject = (ChainStore as any).getObject(globalObject);

    if (resolvedGlobalObject === undefined) {
        return <span />;
    }

    return (
        <FeeGroupCore
            settings={settings}
            opIds={opIds}
            title={title}
            globalObject={resolvedGlobalObject}
        />
    );
}

interface FeesProps {
    settings: any;
}

export default function Fees({settings}: FeesProps) {
    const FeeGroupsTitle: any = counterpart.translate("transaction.feeGroups");
    const feeGroups: React.ReactNode[] = [];

    for (const groupName in fee_grouping) {
        const groupNameText = FeeGroupsTitle[groupName];
        const feeIds = fee_grouping[groupName];
        feeGroups.push(
            <FeeGroup
                key={groupName}
                settings={settings}
                opIds={feeIds}
                title={groupNameText}
            />
        );
    }

    return (
        <div className="grid-block vertical" style={{overflow: "visible"}}>
            <div
                className="grid-block small-12 shrink"
                style={{overflow: "visible"}}
            >
                <HelpContent path={"components/Fees"} />
            </div>
            <div className="grid-block small-12 " style={{overflow: "visible"}}>
                <div className="grid-content">{feeGroups}</div>
            </div>
        </div>
    );
}
