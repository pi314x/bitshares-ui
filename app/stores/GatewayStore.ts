// Redux-backed replacement for the Alt.js GatewayStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on - `getState()`
// (returning `{backedCoins, bridgeCoins, bridgeInputs, down,
// onChainGatewayConfig}`, the original's own instance fields - see
// `../store/slices/gatewaySlice.ts`'s header), `listen(callback)`,
// `unlisten(callback)`.
//
// The original `GatewayStore` also exposed six `static` methods
// (`isAllowed`, `anyAllowed`, `isDown`, `getOnChainConfig`,
// `getGlobalOnChainConfig`, `isAssetBlacklisted`). Under Alt's
// `createStoreFromClass`, static methods declared on the class passed to
// `alt.createStore(...)` get copied onto the created store *instance*
// itself (`alt/src/utils/AltUtils.js`'s `getInternalMethods`, assigned in
// `alt/src/store/index.js`), which is why call sites invoke them as
// `GatewayStore.isDown(...)` etc. on the default-exported store, not as
// static class members - so they're replicated here as ordinary instance
// methods on the facade (used by `AssetName.tsx`, `BuySell.tsx`,
// `AccountPortfolioList.tsx`), each reading through `this.getState()`
// exactly like the originals read through Alt's `this.getState()`.
import {reduxStore} from "../store/reduxStore";
import {selectGateway} from "../store/slices/gatewaySlice";
import {allowedGateway} from "../branding";

class GatewayStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return {...selectGateway(reduxStore.getState())};
    }

    listen(callback: () => void) {
        let previous = selectGateway(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectGateway(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    isAllowed(backer: any) {
        return allowedGateway(backer);
    }

    anyAllowed() {
        return allowedGateway(undefined);
    }

    isDown(backer: any) {
        return !!this.getState().down.get(backer);
    }

    getOnChainConfig(gatewayKey: any) {
        if (!gatewayKey) {
            return {};
        }
        const onChainConfig = this.getState().onChainGatewayConfig;

        if (!onChainConfig || !onChainConfig.gateways) return undefined;

        return onChainConfig.gateways[gatewayKey];
    }

    getGlobalOnChainConfig() {
        return this.getState().onChainGatewayConfig;
    }

    /**
     * FIXME: This does not belong into GatewayStore, but only creating a new store for it seems excessive
     * @param asset
     * @returns {boolean}
     */
    isAssetBlacklisted(asset: any) {
        let symbol = null;
        if (typeof asset == "object") {
            if (asset.symbol) {
                symbol = asset.symbol;
            } else if (asset.get) {
                symbol = asset.get("symbol");
            }
        } else {
            // string
            symbol = asset;
        }
        const globalOnChainConfig = this.getState().onChainGatewayConfig;
        if (
            !!globalOnChainConfig &&
            !!globalOnChainConfig.blacklists &&
            !!globalOnChainConfig.blacklists.assets
        ) {
            if (globalOnChainConfig.blacklists.assets.includes) {
                return globalOnChainConfig.blacklists.assets.includes(symbol);
            }
        }
        return false;
    }
}

export default new GatewayStoreFacade();
