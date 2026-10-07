// Redux Toolkit replacement for the Alt.js `GatewayStore`/
// `GatewayActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see
// `../reduxStore.ts`'s header for the overall migration approach).
//
// Like `BlockchainStore`/`AssetStore`, `GatewayStore` never called
// `this.setState(...)` - it mutated instance fields directly, so the
// state shape is just those fields verbatim: `backedCoins`,
// `bridgeCoins`, `bridgeInputs` (a constant, never reassigned, kept here
// only so `getState()`'s shape matches the original exactly),
// `down`, `onChainGatewayConfig`. `GatewayStore` also read/wrote
// `localStorage` (`ss`) directly inside its `onXxx` handlers - that side
// effect is preserved here, at the same point in the same handlers,
// same as `onUpdateRpcConnectionStatus`'s `ChainStore.resetCache(false)`
// call in `blockchainSlice.ts`.
//
// `GatewayStore`'s `static isAllowed`/`anyAllowed`/`isDown`/
// `getOnChainConfig`/`getGlobalOnChainConfig`/`isAssetBlacklisted`
// methods are not state - see `app/stores/GatewayStore.ts`'s facade,
// which replicates them as plain instance methods reading this slice's
// state via `getState()`.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";
import ls from "common/localStorage";

const STORAGE_KEY = "__graphene__";
const ss = ls(STORAGE_KEY);

export interface GatewayState {
    // `any`, not `Immutable.Map<...>` - see `blockchainSlice.ts`'s
    // header comment on why Immer's `Draft<T>` mapping makes that unsafe
    // (it would silently drop `toJS`/`setIn`/`remove`, used below).
    backedCoins: any;
    bridgeCoins: any;
    bridgeInputs: string[];
    down: any;
    onChainGatewayConfig: any;
}

const initialState: GatewayState = {
    backedCoins: Immutable.Map(ss.get("backedCoins", {})),
    bridgeCoins: Immutable.Map(Immutable.fromJS(ss.get("bridgeCoins", {}))),
    /**
     * bridgeInputs limits the available depositable coins through blocktrades
     * when using the "Buy" functionaility.
     *
     * While the application still makes sure the asset is possible to deposit,
     * this is to limit the app to display internal assets like bit-assets that
     * BlockTrades accept within their platform.
     */
    bridgeInputs: [
        "btc",
        "dash",
        "eth",
        "steem",
        "sbd",
        "doge",
        "bch",
        "ppy",
        "ltc"
    ],
    down: Immutable.Map({}),
    onChainGatewayConfig: null
};

const gatewaySlice = createSlice({
    name: "gateway",
    initialState,
    reducers: {
        onFetchCoins(state, action: PayloadAction<any>) {
            const {backer, coins, backedCoins, down} = action.payload || {};
            if (backer && coins) {
                state.backedCoins = state.backedCoins.set(backer, backedCoins);

                ss.set("backedCoins", state.backedCoins.toJS());

                state.down = state.down.set(backer, false);
            }

            if (down) {
                state.down = state.down.set(down, true);
            }
        },
        onFetchCoinsSimple(state, action: PayloadAction<any>) {
            const {backer, coins, down} = action.payload || {};
            if (backer && coins) {
                state.backedCoins = state.backedCoins.set(backer, coins);

                ss.set("backedCoins", state.backedCoins.toJS());

                state.down = state.down.set(backer, false);
            }

            if (down) {
                state.down = state.down.set(down, true);
            }
        },
        onFetchPairs(state, action: PayloadAction<any>) {
            const {coins, bridgeCoins, wallets, down} = action.payload || {};
            if (coins && bridgeCoins && wallets) {
                const coins_by_type: {[key: string]: any} = {};
                coins.forEach(
                    (coin_type: any) =>
                        (coins_by_type[coin_type.coinType] = coin_type)
                );
                bridgeCoins
                    .filter((a: any) => {
                        return (
                            a &&
                            coins_by_type[a.outputCoinType] &&
                            coins_by_type[a.outputCoinType].walletType ===
                                "bitshares2" && // Only use bitshares2 wallet types
                            state.bridgeInputs.indexOf(a.inputCoinType) !== -1 // Only use coin types defined in bridgeInputs
                        );
                    })
                    .forEach((coin: any) => {
                        coin.isAvailable =
                            wallets.indexOf(
                                coins_by_type[coin.outputCoinType].walletType
                            ) !== -1;
                        state.bridgeCoins = state.bridgeCoins.setIn(
                            [
                                coins_by_type[coin.outputCoinType].walletSymbol,
                                coin.inputCoinType
                            ],
                            Immutable.fromJS(coin)
                        );
                    });
                ss.set("bridgeCoins", state.bridgeCoins.toJS());
            }
            if (down) {
                state.down = state.down.set(down, true);
            }
        },
        onTemporarilyDisable(state, action: PayloadAction<{backer: any}>) {
            const {backer} = action.payload;
            state.down = state.down.set(backer, true);

            if (state.backedCoins.get(backer)) {
                state.backedCoins = state.backedCoins.remove(backer);
                ss.set("backedCoins", state.backedCoins.toJS());
            }
            if (state.bridgeCoins.get(backer)) {
                state.bridgeCoins = state.bridgeCoins.remove(backer);
                ss.set("bridgeCoins", state.bridgeCoins.toJS());
            }
        },
        onLoadOnChainGatewayConfig(state, action: PayloadAction<any>) {
            state.onChainGatewayConfig = action.payload || {};
        }
    }
});

export const {
    onFetchCoins,
    onFetchCoinsSimple,
    onFetchPairs,
    onTemporarilyDisable,
    onLoadOnChainGatewayConfig
} = gatewaySlice.actions;

export const selectGateway = (state: {gateway: GatewayState}) => state.gateway;

export default gatewaySlice.reducer;
