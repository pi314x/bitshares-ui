import * as React from "react";
import counterpart from "counterpart";
import {Select} from "../../design-system/Select";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectGateway} from "../../store/slices/gatewaySlice";

/** One backed coin as the gateway store lists it. */
export interface BackedCoin {
    symbol: string;
    gateFee?: any;
    issuerId?: string;
}

/** One selectable asset: the gateway-less part of a gateway symbol
 * ("XBTSX.USDT" -> id "USDT", gateway "XBTSX"), or BTS itself. */
export interface SelectorAsset {
    id: string;
    label: string;
    gateway: string;
    gateFee?: any;
    issuer?: string;
}

/** Turn the gateway store's per-gateway coin lists into the selectable assets:
 * one entry per distinct backed coin (first gateway wins), restricted to
 * `include` when given (BTS always passes), plus BTS unless `includeBTS` is
 * `false`. */
export function buildAssets(
    backedCoins: BackedCoin[][],
    include?: string[],
    includeBTS?: boolean
): SelectorAsset[] {
    const seen: Record<string, boolean> = {};
    let assets: SelectorAsset[] = [];

    backedCoins.forEach(coins => {
        const found: SelectorAsset[] = [];
        coins.forEach(item => {
            const [gateway, backedCoin] = item.symbol.split(".");
            // Skip a coin that is already listed (from another gateway).
            if (backedCoin && gateway && !seen[backedCoin]) {
                seen[backedCoin] = true;
                found.push({
                    id: backedCoin,
                    label: backedCoin,
                    gateway,
                    gateFee: item.gateFee,
                    // Falls back to the old Openledger issuer id.
                    issuer: item.issuerId || "1.2.96397"
                });
            }
        });
        assets = assets.concat(found).filter(item => {
            if (item.id === "BTS") return true;
            return include ? include.includes(item.id) : true;
        });
    });

    if (includeBTS !== false) {
        assets.push({id: "BTS", label: "BTS", gateway: ""});
    }
    return assets;
}

export interface DepositWithdrawAssetSelectorProps {
    backedCoins: BackedCoin[][];
    include?: string[];
    includeBTS?: boolean;
    defaultValue?: string;
    usageContext?: string;
    onSelect?: (asset: SelectorAsset | undefined) => void;
    onChange?: (assetId: string) => void;
    // Passed by call sites, never read.
    selectOnBlur?: boolean;
}

export function DepositWithdrawAssetSelectorView(
    props: DepositWithdrawAssetSelectorProps
) {
    const {backedCoins, include, includeBTS, usageContext} = props;

    // Computed once, on mount, from whatever the gateway store held then - like
    // the class component this replaces, a later change of `backedCoins` does
    // not rebuild the list (the modal that hosts it mounts after the gateways
    // have loaded).
    const [assets] = React.useState(() =>
        buildAssets(backedCoins, include, includeBTS)
    );

    // The last asset with this id wins (the BTS entry added at the end).
    const find = (id: string | number) =>
        assets.reduce<SelectorAsset | undefined>(
            (found, asset) => (asset.id == id ? asset : found),
            undefined
        );

    const onSelect = (id: string | number) => {
        if (props.onSelect) props.onSelect(find(id));
    };
    const onChange = (id: string | number) => {
        const asset = find(id);
        if (props.onChange && asset && asset.id) props.onChange(asset.id);
    };

    const withdraw = usageContext === "withdraw";
    const items = [...assets].sort((a, b) => a.id.localeCompare(b.id));

    return (
        <Select
            onSelect={onSelect}
            onChange={onChange}
            onSearch={onChange}
            placeholder={counterpart.translate(
                withdraw
                    ? "gateway.asset_search_withdraw"
                    : "gateway.asset_search_deposit"
            )}
            value={props.defaultValue}
            optionLabelProp="value"
            showSearch
            style={{width: "100%"}}
        >
            {/*
                On deposit it would be useful to show the minimum deposit and
                the gateway fee next to each entry, so the user need not pick a
                specific gateway to see them.
            */}
            {items.length > 0 ? (
                items.map(coin => (
                    <Select.Option key={coin.id} value={coin.label}>
                        {coin.label}
                    </Select.Option>
                ))
            ) : (
                <Select.Option disabled key={0} value={0}>
                    {counterpart.translate(
                        withdraw
                            ? "modal.withdraw.no_assets"
                            : "modal.deposit.no_assets"
                    )}
                </Select.Option>
            )}
        </Select>
    );
}

// The gateway store replaces the old alt-react `connect` HOC (same
// `useReduxState` pattern as the rest of the migration).
function DepositWithdrawAssetSelector(
    props: Omit<DepositWithdrawAssetSelectorProps, "backedCoins">
) {
    const gatewayState = useReduxState<any>(selectGateway);
    return (
        <DepositWithdrawAssetSelectorView
            {...props}
            backedCoins={gatewayState.backedCoins}
        />
    );
}

export default DepositWithdrawAssetSelector;
