// Every `Actions.method.defer(...)` call site in the app needs the facade to
// provide `.defer` - real Alt actions had it for free, the Redux-backed
// facades only have it where someone added it (`withDefer`). One missing
// `.defer` is a TypeError at runtime that unmounts the whole app: the
// Exchange crashed on `SettingsActions.changeViewSetting.defer`, found by
// opening a market in the built bundle against a real node. This list is
// every `.defer(` call site found by grep; extend it when adding one.
jest.mock("../../components/Utility/HelpContent", () => () => null);

import AccountActions from "../../actions/AccountActions";
import AssetActions from "../../actions/AssetActions";
import BlockchainActions from "../../actions/BlockchainActions";
import GatewayActions from "../../actions/GatewayActions";
import MarketsActions from "../../actions/MarketsActions";
import PoolmartActions from "../../actions/PoolmartActions";
import SettingsActions from "../../actions/SettingsActions";
import WalletUnlockActions from "../../actions/WalletUnlockActions";
import NotificationActions from "../../actions/NotificationActions";
import NotificationStore from "../../stores/NotificationStore";

const sites: Array<[string, any, string[]]> = [
    ["AccountActions", AccountActions, ["setCurrentAccount"]],
    ["AssetActions", AssetActions, ["getAssetList"]],
    ["BlockchainActions", BlockchainActions, ["getHeader"]],
    [
        "GatewayActions",
        GatewayActions,
        ["fetchPairs", "fetchCoinsSimple", "fetchCoins"]
    ],
    ["MarketsActions", MarketsActions, ["subscribeMarket"]],
    [
        "PoolmartActions",
        PoolmartActions,
        [
            "getLiquidityPools",
            "getLiquidityPoolsByShareAsset",
            "getLiquidityPoolsAccount"
        ]
    ],
    [
        "SettingsActions",
        SettingsActions,
        ["changeSetting", "changeViewSetting", "setExchangeTutorialShown"]
    ],
    ["WalletUnlockActions", WalletUnlockActions, ["checkLock"]],
    ["NotificationActions", NotificationActions, ["addNotification"]]
];

describe("action facades provide .defer for every call site", () => {
    sites.forEach(([name, actions, methods]) => {
        methods.forEach(method => {
            it(`${name}.${method}.defer is a function`, () => {
                expect(typeof actions[method]).toBe("function");
                expect(typeof actions[method].defer).toBe("function");
            });
        });
    });
});

describe("addDefer", () => {
    it("runs the action on a later tick, like Alt's action.defer", () => {
        jest.useFakeTimers();
        try {
            (NotificationActions.addNotification as any).defer({
                message: "deferred"
            });
            expect(
                (NotificationStore.getState() as any).notification
            ).not.toEqual(expect.objectContaining({message: "deferred"}));
            jest.runAllTimers();
            expect((NotificationStore.getState() as any).notification).toEqual(
                expect.objectContaining({message: "deferred"})
            );
        } finally {
            jest.useRealTimers();
        }
    });
});
