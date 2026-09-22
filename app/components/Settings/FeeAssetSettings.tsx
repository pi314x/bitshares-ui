// TypeScript/functional-component port of the legacy FeeAssetSettings.jsx
// (renders the "current fee asset" display + "change default fee asset"
// button inside SettingsEntry's `fee_asset` row, opening
// SetDefaultFeeAssetModal to pick a new one). Phase 2,
// docs/UI_MIGRATION_PLAN.md. Read-only display plus a local modal toggle
// - the actual fee-asset preference write happens inside
// SetDefaultFeeAssetModal (unchanged, reused as-is), not here.
//
// The legacy class only ever used its `fee_asset` prop (from the
// alt-react `connect(FeeAssetSettings, {listenTo: [SettingsStore],
// getProps})` wrapper) once, in the constructor, to seed
// `state.current_asset` - there is no `componentWillReceiveProps` or
// similar to re-derive it later, so subsequent `fee_asset` setting
// changes never updated this component's `current_asset` after mount
// (only the modal's own `onChange` callback did, locally). Ported with
// `useState(() => ...)`'s lazy initializer, which runs exactly once on
// mount, replicating that same one-time seed.
//
// The legacy `shouldComponentUpdate` always returned `true`, so this
// component re-rendered on *every* SettingsStore change (even unrelated
// ones, e.g. locale or theme), which - though clearly incidental, not a
// deliberate ChainStore-freshness design - was this component's only
// mechanism for ever re-reading `ChainStore.getAsset(current_asset)`
// after mount if that asset object became available asynchronously.
// Kept `useAltStore(SettingsStore)` (discarding its returned value) to
// preserve that same incidental re-render trigger faithfully, rather
// than either dropping it (behavior-changing) or adding a ChainStore-tick
// mechanism the original never had (over-fixing).
import * as React from "react";
import counterpart from "counterpart";
import SettingsStore from "../../stores/SettingsStore";
import {ChainStore} from "bitsharesjs";
import {Button} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import SetDefaultFeeAssetModal from "../Modal/SetDefaultFeeAssetModal";
import {useAltStore} from "../../next/hooks/useAltStore";

function computeInitialFeeAsset(): string {
    const feeAsset = SettingsStore.getState().settings.get("fee_asset");
    return ChainStore.assets_by_symbol.get(feeAsset) || "1.3.0";
}

export default function FeeAssetSettings() {
    useAltStore<any>(SettingsStore);
    const [showModal, setShowModal] = React.useState(false);
    const [currentAsset, setCurrentAsset] = React.useState(
        computeInitialFeeAsset
    );

    const asset = ChainStore.getAsset(currentAsset);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center"
            }}
        >
            <Translate
                component="span"
                content="settings.current_fee_asset"
                style={{marginRight: "10px"}}
            />
            {asset ? <AssetName name={asset.get("symbol")} /> : null}

            <Button
                style={{margin: "15px"}}
                key="open_change_fee_asset"
                type="secondary"
                onClick={() => setShowModal(true)}
            >
                {counterpart.translate("settings.change_default_fee_asset")}
            </Button>
            {showModal && (
                <SetDefaultFeeAssetModal
                    key="change_fee_asset_modal"
                    className="modal"
                    show={showModal}
                    current_asset={currentAsset}
                    displayFees={false}
                    forceDefault={true}
                    onChange={(value: string) => setCurrentAsset(value)}
                    close={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
