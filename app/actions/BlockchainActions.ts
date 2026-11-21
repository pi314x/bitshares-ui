// Redux-backed replacement for the Alt.js BlockchainActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and dispatch-point logic the original action creators
// ran, dispatching straight into the Redux store instead of going
// through Alt's dispatcher/`bindListeners`.
//
// Every real Alt action also gets a `.defer(...args)` method for free
// (`alt/src/actions/index.js`: `action.defer = (...args) =>
// setTimeout(() => action.apply(null, args))`), used by real call sites
// (`BlockDate.tsx`'s `BlockchainActions.getHeader.defer(...)`). `withDefer`
// below replicates that exact mechanic for each exported method.
import {reduxStore} from "../store/reduxStore";
import {Apis} from "bitsharesjs-ws";
import {
    onGetHeader,
    onGetBlock,
    onGetLatest,
    onUpdateRpcConnectionStatus
} from "../store/slices/blockchainSlice";

const latestBlocks: {[key: string]: boolean} = {};

const headerQueue: {[key: string]: boolean} = {};

type Deferrable<T extends (...args: any[]) => any> = T & {
    defer: (...args: Parameters<T>) => void;
};

function withDefer<T extends (...args: any[]) => any>(fn: T): Deferrable<T> {
    const deferrable = fn as Deferrable<T>;
    deferrable.defer = (...args: Parameters<T>) =>
        setTimeout(() => fn(...args));
    return deferrable;
}

function getHeader(height: any) {
    if (headerQueue[height]) return {};
    headerQueue[height] = true;
    return Apis.instance()
        .db_api()
        .exec("get_block_header", [height])
        .then((header: any) => {
            reduxStore.dispatch(
                onGetHeader({
                    header: {
                        timestamp: header.timestamp,
                        witness: header.witness
                    },
                    height
                })
            );
        });
}

function getLatest(height: any, maxBlock: any) {
    // let start = new Date();
    if (!latestBlocks[height] && maxBlock) {
        latestBlocks[height] = true;
        Apis.instance()
            .db_api()
            .exec("get_block", [height])
            .then((result: any) => {
                if (!result) {
                    return;
                }
                result.id = height; // The returned object for some reason does not include the block height..
                // console.log("time to fetch block #" + height,":", new Date() - start, "ms");

                reduxStore.dispatch(onGetLatest({block: result, maxBlock}));
            })
            .catch((error: any) => {
                console.log("Error in BlockchainActions.getLatest: ", error);
            });
    }
}

function getBlock(height: any) {
    Apis.instance()
        .db_api()
        .exec("get_block", [height])
        .then((result: any) => {
            if (!result) {
                return false;
            }
            result.id = height; // The returned object for some reason does not include the block height..

            reduxStore.dispatch(onGetBlock(result));
        })
        .catch((error: any) => {
            console.log("Error in BlockchainActions.getBlock: ", error);
        });
}

function updateRpcConnectionStatus(status: any) {
    reduxStore.dispatch(onUpdateRpcConnectionStatus(status));
    return status;
}

const BlockchainActionsFacade = {
    getHeader: withDefer(getHeader),
    getLatest: withDefer(getLatest),
    getBlock: withDefer(getBlock),
    updateRpcConnectionStatus: withDefer(updateRpcConnectionStatus)
};

Apis.setRpcConnectionStatusCallback(
    BlockchainActionsFacade.updateRpcConnectionStatus
);

export default BlockchainActionsFacade;
