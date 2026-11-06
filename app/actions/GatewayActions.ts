// Redux-backed replacement for the Alt.js GatewayActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and dispatch-point logic the original action creators
// ran, dispatching straight into the Redux store instead of going
// through Alt's dispatcher/`bindListeners`. All 5 methods here were
// bound to `GatewayStore` (see `../store/slices/gatewaySlice.ts`), unlike
// `AssetActions`'s mostly-unbound transaction methods.
//
// This file still imports/uses `blockTradesAPIs` from
// `api/apiConfig.js` in `fetchPairs` - left as-is per the gateway-removal
// commit that predates this migration batch; not touched.
//
// Every real Alt action also gets a `.defer(...args)` method for free
// (`alt/src/actions/index.js`), used by real call sites
// (`App.jsx`'s `GatewayActions.loadOnChainGatewayConfig()` is a direct
// call, but `gatewayUtils.js` calls `.defer` on `fetchPairs`,
// `fetchCoinsSimple` and `fetchCoins`). `withDefer` below replicates
// that exact mechanic for each exported method.
import {reduxStore} from "../store/reduxStore";
import {
    fetchCoins as fetchCoinsRemote,
    fetchTradingPairs as fetchTradingPairsRemote,
    fetchCoinsSimple as fetchCoinsSimpleRemote,
    getBackedCoins,
    getActiveWallets as getActiveWalletsRemote
} from "common/gatewayMethods";
import {blockTradesAPIs} from "api/apiConfig";
import {getOnChainConfig} from "../lib/chain/onChainConfig";
import {
    onFetchCoins,
    onFetchCoinsSimple,
    onFetchPairs,
    onTemporarilyDisable,
    onLoadOnChainGatewayConfig
} from "../store/slices/gatewaySlice";

const inProgress: {[key: string]: boolean} = {};

const GATEWAY_TIMEOUT = 10000;

// Original: `onGatewayTimeout = (dispatch, gateway) => {dispatch({down:
// gateway});}`, invoked via `setTimeout(onGatewayTimeout.bind(null,
// dispatch, backer), GATEWAY_TIMEOUT)` - `dispatch` there was always the
// closure-captured dispatch of whichever action method scheduled the
// timeout, so the payload always landed on that SAME action's bound
// handler. `actionCreator` here plays that same role explicitly.
const onGatewayTimeout = (
    gateway: any,
    actionCreator: (payload: any) => any
) => {
    reduxStore.dispatch(actionCreator({down: gateway}));
};

type Deferrable<T extends (...args: any[]) => any> = T & {
    defer: (...args: Parameters<T>) => void;
};

function withDefer<T extends (...args: any[]) => any>(fn: T): Deferrable<T> {
    const deferrable = fn as Deferrable<T>;
    deferrable.defer = (...args: Parameters<T>) =>
        setTimeout(() => fn(...args));
    return deferrable;
}

function fetchCoins({
    backer = "OPEN",
    url = undefined,
    urlBridge = undefined,
    urlWallets = undefined
}: any = {}) {
    if (!inProgress["fetchCoins_" + backer]) {
        inProgress["fetchCoins_" + backer] = true;
        const fetchCoinsTimeout = setTimeout(
            () => onGatewayTimeout(backer, onFetchCoins),
            GATEWAY_TIMEOUT
        );
        Promise.all([
            fetchCoinsRemote(url),
            fetchTradingPairsRemote(urlBridge),
            getActiveWalletsRemote(urlWallets)
        ])
            .then((result: any) => {
                clearTimeout(fetchCoinsTimeout);
                delete inProgress["fetchCoins_" + backer];
                const [coins, tradingPairs, wallets] = result;
                const backedCoins = getBackedCoins({
                    allCoins: coins,
                    tradingPairs: tradingPairs,
                    backer: backer
                }).filter((a: any) => !!a.walletType);
                backedCoins.forEach((a: any) => {
                    a.isAvailable = wallets.indexOf(a.walletType) !== -1;
                });
                reduxStore.dispatch(
                    onFetchCoins({
                        coins,
                        backedCoins,
                        backer
                    })
                );
            })
            .catch(() => {
                clearTimeout(fetchCoinsTimeout);
                delete inProgress["fetchCoins_" + backer];
                reduxStore.dispatch(
                    onFetchCoins({
                        coins: [],
                        backedCoins: [],
                        backer
                    })
                );
            });
    } else {
        return {};
    }
}

function fetchCoinsSimple({backer = "RUDEX", url = undefined}: any = {}) {
    if (!inProgress["fetchCoinsSimple_" + backer]) {
        inProgress["fetchCoinsSimple_" + backer] = true;
        const fetchCoinsTimeout = setTimeout(
            () => onGatewayTimeout(backer, onFetchCoinsSimple),
            GATEWAY_TIMEOUT
        );
        fetchCoinsSimpleRemote(url)
            .then((coins: any) => {
                clearTimeout(fetchCoinsTimeout);
                delete inProgress["fetchCoinsSimple_" + backer];
                reduxStore.dispatch(
                    onFetchCoinsSimple({
                        coins: coins,
                        backer
                    })
                );
            })
            .catch(() => {
                clearTimeout(fetchCoinsTimeout);
                delete inProgress["fetchCoinsSimple_" + backer];

                reduxStore.dispatch(
                    onFetchCoinsSimple({
                        coins: [],
                        backer
                    })
                );
            });
    } else {
        return {};
    }
}

function fetchPairs() {
    if (!inProgress["fetchTradingPairs"]) {
        inProgress["fetchTradingPairs"] = true;
        const fetchCoinsTimeout = setTimeout(
            () => onGatewayTimeout("TRADE", onFetchPairs),
            GATEWAY_TIMEOUT
        );
        Promise.all([
            fetchCoinsRemote(blockTradesAPIs.BASE + blockTradesAPIs.COINS_LIST),
            fetchTradingPairsRemote(
                blockTradesAPIs.BASE + blockTradesAPIs.TRADING_PAIRS
            ),
            getActiveWalletsRemote(
                blockTradesAPIs.BASE + blockTradesAPIs.ACTIVE_WALLETS
            )
        ])
            .then((result: any) => {
                clearTimeout(fetchCoinsTimeout);
                delete inProgress["fetchTradingPairs"];
                const [coins, bridgeCoins, wallets] = result;
                reduxStore.dispatch(
                    onFetchPairs({
                        coins,
                        bridgeCoins,
                        wallets
                    })
                );
            })
            .catch(() => {
                delete inProgress["fetchTradingPairs"];
                reduxStore.dispatch(
                    onFetchPairs({
                        coins: [],
                        bridgeCoins: [],
                        wallets: []
                    })
                );
            });
    } else {
        return {};
    }
}

function temporarilyDisable({backer}: any) {
    reduxStore.dispatch(onTemporarilyDisable({backer}));
}

function loadOnChainGatewayConfig() {
    getOnChainConfig().then((config: any) =>
        reduxStore.dispatch(onLoadOnChainGatewayConfig(config))
    );
}

const GatewayActionsFacade = {
    fetchCoins: withDefer(fetchCoins),
    fetchCoinsSimple: withDefer(fetchCoinsSimple),
    fetchPairs: withDefer(fetchPairs),
    temporarilyDisable: withDefer(temporarilyDisable),
    loadOnChainGatewayConfig: withDefer(loadOnChainGatewayConfig)
};

export default GatewayActionsFacade;
