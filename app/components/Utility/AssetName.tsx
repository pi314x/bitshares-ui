// TypeScript/functional-component port of the legacy AssetName.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(Component)` HOC usage is kept as-is (shared HOC, out of
// scope for this migration's leaf-component conversion pass).
//
// `shouldComponentUpdate` is a pure props/state shallow-equality
// performance guard - not replicated, per this migration's established
// treatment of pure perf guards.
//
// The constructor's synchronous `_load()` call (fires before first mount)
// plus `componentDidUpdate`'s unconditional `_load()` call (fires after
// every update, gated only by `_load()`'s own internal `!assetIssuerName`
// check - not by any props comparison) are both replicated by a single
// `useEffect` with no dependency array, which runs after the initial
// render and after every subsequent render. `_isMounted` (guarding the
// async `setState` callback against firing post-unmount) is replicated
// with a `useRef` toggled by a mount-only effect, matching the original's
// `componentDidMount`/`componentWillUnmount` pair.
//
// Preserved verbatim (not "fixed"): `_load()`'s own internal check
// (`!this.state.assetIssuerName && ...`) means that once `assetIssuerName`
// has been resolved for one `asset`, a later `asset` prop change will
// *not* trigger a re-fetch (the stale issuer name from the previous asset
// is displayed) - a pre-existing characteristic of the component, not
// introduced by this port.
import * as React from "react";
import utils from "common/utils";
import asset_utils from "common/asset_utils";
import AssetWrapper from "./AssetWrapper";
import counterpart from "counterpart";
import {Popover} from "bitshares-ui-style-guide";
import {ChainStore, FetchChainObjects} from "bitsharesjs";
import GatewayStore from "../../stores/GatewayStore";
import {getAssetAndGateway} from "../../lib/common/gatewayUtils";
import {Icon, Tooltip} from "bitshares-ui-style-guide";

interface AssetNameCoreProps {
    replace?: boolean;
    asset: any;
    noPrefix?: boolean;
    customClass?: string;
    noTip?: boolean;
    dataPlace?: string;
}

function AssetName({
    replace = true,
    asset,
    noPrefix,
    customClass,
    noTip,
    dataPlace = "bottom"
}: AssetNameCoreProps) {
    const [assetIssuerName, setAssetIssuerName] = React.useState<
        string | null
    >(null);
    const assetIssuerNameRef = React.useRef(assetIssuerName);
    assetIssuerNameRef.current = assetIssuerName;
    const mountedRef = React.useRef(false);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        // cache asset issuer name
        if (!assetIssuerNameRef.current && asset && asset.get) {
            FetchChainObjects(ChainStore.getAccountName, [
                asset.get("issuer")
            ]).then((result: any) => {
                if (mountedRef.current) {
                    // re-render, ChainStore cache now has the object
                    setAssetIssuerName(result[0]);
                }
            });
        }
    });

    if (!asset) return null;
    const name = asset.get("symbol");
    const isBitAsset = asset.has("bitasset");
    const isPredMarket =
        isBitAsset && asset.getIn(["bitasset", "is_prediction_market"]);

    const {name: replacedName, prefix} = utils.replaceName(asset);
    const hasBitPrefix = prefix === "bit";

    const includeBitAssetDescription =
        isBitAsset && !isPredMarket && hasBitPrefix;

    if ((replace && replacedName !== name) || isBitAsset) {
        const desc = asset_utils.parseDescription(
            asset.getIn(["options", "description"])
        );

        const nameParts = name.split(".");
        let realPrefix: string | null =
            nameParts.length > 1 ? nameParts[0] : null;
        if (realPrefix) realPrefix += ".";
        let optional = "";

        try {
            optional =
                realPrefix || includeBitAssetDescription
                    ? counterpart.translate(
                          "gateway.assets." +
                              (hasBitPrefix
                                  ? "bit"
                                  : // Reachable only when `realPrefix` is
                                    // truthy: `includeBitAssetDescription`
                                    // implies `hasBitPrefix`, so if
                                    // `hasBitPrefix` is false here,
                                    // `includeBitAssetDescription` is also
                                    // false, and the outer `||` condition
                                    // then requires `realPrefix` itself.
                                    (realPrefix as string)
                                        .replace(".", "")
                                        .toLowerCase()),
                          {
                              asset: name,
                              backed: includeBitAssetDescription
                                  ? desc.main
                                  : replacedName
                          }
                      )
                    : "";
        } catch (e) {}
        if (isBitAsset && name === "CNY") {
            optional = optional + " " + counterpart.translate("gateway.assets.bitcny");
        }

        const upperCasePrefix =
            prefix && prefix === "bit"
                ? prefix
                : !!prefix
                ? prefix.toUpperCase()
                : prefix;
        const assetDiv = (
            <div
                className={
                    "inline-block" +
                    (noTip ? "" : " tooltip") +
                    (customClass ? " " + customClass : "")
                }
            >
                <span className="asset-prefix-replaced">{prefix}</span>
                <span>{replacedName}</span>
            </div>
        );
        if (!!noTip) {
            return assetDiv;
        } else {
            const title = (upperCasePrefix || "") + replacedName.toUpperCase();
            const popoverContent = (
                <div style={{maxWidth: "25rem"}}>
                    {desc.short ? desc.short : desc.main || ""}
                    {optional !== "" && <br />}
                    {optional !== "" && <br />}
                    {optional}
                    <br />
                    <br />
                    {assetIssuerName &&
                        counterpart.translate("explorer.assets.issuer") +
                            ": " +
                            assetIssuerName}
                </div>
            );
            return (
                <Popover
                    placement={dataPlace as any}
                    content={popoverContent}
                    title={title}
                    mouseEnterDelay={0.5}
                >
                    {assetDiv}
                </Popover>
            );
        }
    } else {
        const assetDiv = (
            <span className={customClass ? customClass : undefined}>
                <span className={!noPrefix ? "asset-prefix-replaced" : ""}>
                    {!noPrefix ? prefix : null}
                </span>
                <span>{replacedName}</span>
            </span>
        );
        if (!!noTip) {
            return assetDiv;
        } else {
            let desc: any = null;
            if (replacedName == "BTS") {
                desc = {main: counterpart.translate("assets.BTS")};
            } else {
                desc = asset_utils.parseDescription(
                    asset.getIn(["options", "description"])
                );
            }
            const title = (prefix || "") + replacedName.toUpperCase();
            const popoverContent = (
                <div style={{maxWidth: "25rem"}}>
                    {desc.short ? desc.short : desc.main || ""}
                    <br />
                    <br />
                    {assetIssuerName &&
                        counterpart.translate("explorer.assets.issuer") +
                            ": " +
                            assetIssuerName}
                </div>
            );
            return (
                <Popover
                    placement={dataPlace as any}
                    content={popoverContent}
                    title={title}
                    mouseEnterDelay={0.5}
                >
                    {assetDiv}
                </Popover>
            );
        }
    }
}

const WrappedAssetName = AssetWrapper(AssetName);

interface AssetNameWrapperProps {
    name?: string | null;
    [key: string]: any;
}

function AssetNameWrapper({name, ...rest}: AssetNameWrapperProps) {
    const gatewaySplit = getAssetAndGateway(name);
    let postfix;
    if (!!gatewaySplit && !!gatewaySplit.selectedGateway) {
        const onChainConfig = GatewayStore.getOnChainConfig(
            (getAssetAndGateway(name) as any).selectedGateway
        );
        const isDisabledGatewayAsset =
            !!onChainConfig && !(onChainConfig as any).enabled;
        postfix = isDisabledGatewayAsset && (
            <Tooltip
                placement="topLeft"
                title={
                    <span>
                        <span
                            dangerouslySetInnerHTML={{
                                __html:
                                    counterpart.translate(
                                        "external_service_provider.disabled_asset_1"
                                    ) + ". "
                            }}
                        />
                        <span>{(onChainConfig as any).comment}</span>
                        <br />
                        <br />
                        <span>
                            {counterpart.translate(
                                "external_service_provider.disabled_asset_2"
                            )}
                        </span>
                    </span>
                }
            >
                &nbsp;
                <Icon type="warning" />
            </Tooltip>
        );
    }
    let warning;
    if (GatewayStore.isAssetBlacklisted(name)) {
        warning = (
            <Tooltip
                placement="topLeft"
                title={
                    <React.Fragment>
                        <span>
                            {counterpart.translate(
                                "explorer.assets.blacklisted"
                            )}
                        </span>
                    </React.Fragment>
                }
            >
                &nbsp;
                <Icon style={{color: "white"}} type="warning" />
            </Tooltip>
        );
    }
    return !name ? null : (
        <React.Fragment>
            <WrappedAssetName {...rest} asset={name} />
            {postfix}
            {warning}
        </React.Fragment>
    );
}

export default AssetNameWrapper;
