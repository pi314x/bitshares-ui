import {
    CONFIRM_WORD,
    DeleteEnvironment,
    canContinue,
    canDelete,
    deleteLocalData,
    localInventory
} from "../../lib/common/deleteLocal";

class FakeStorage {
    private data: {[key: string]: string};
    constructor(data: {[key: string]: string}) {
        this.data = {...data};
    }
    get length() {
        return Object.keys(this.data).length;
    }
    key(i: number) {
        return Object.keys(this.data)[i] ?? null;
    }
    removeItem(key: string) {
        delete this.data[key];
    }
    keys() {
        return Object.keys(this.data);
    }
}

// a factory whose deleteDatabase answers on the next tick, or says it is blocked
function fakeFactory(names: string[], blocked: string[] = []) {
    const deleted: string[] = [];
    return {
        deleted,
        databases: jest.fn(async () => names.map(name => ({name}))),
        deleteDatabase: (name: string) => {
            const request: any = {};
            setTimeout(() => {
                if (blocked.includes(name)) {
                    request.onblocked && request.onblocked();
                } else {
                    deleted.push(name);
                    request.onsuccess && request.onsuccess();
                }
            }, 0);
            return request;
        }
    };
}

describe("localInventory", () => {
    it("lists our databases and our saved keys, and nothing else", async () => {
        const env: DeleteEnvironment = {
            indexedDB: fakeFactory([
                "graphene_db_06f667",
                "graphene_v2_06f667_default",
                "someone_elses_db"
            ]) as any,
            localStorage: new FakeStorage({
                __graphene__settings_v4: "{}",
                __bts__x: "1",
                "bts-ui-theme": "dark",
                other: "keep"
            }) as any
        };
        const inventory = await localInventory(env);
        expect(inventory.databases).toEqual([
            "graphene_db_06f667",
            "graphene_v2_06f667_default"
        ]);
        expect(inventory.storageKeys).toEqual([
            "__bts__x",
            "__graphene__settings_v4",
            "bts-ui-theme"
        ]);
    });

    it("adds the names it is told of where the browser cannot list databases", async () => {
        const env: DeleteEnvironment = {
            indexedDB: {deleteDatabase: jest.fn()} as any,
            localStorage: new FakeStorage({}) as any
        };
        const inventory = await localInventory(env, ["graphene_v2_a_default"]);
        expect(inventory.databases).toEqual(["graphene_v2_a_default"]);
    });

    it("is empty where there is nothing", async () => {
        expect(await localInventory({})).toEqual({
            databases: [],
            storageKeys: []
        });
    });
});

describe("deleteLocalData", () => {
    it("closes the app's connections, deletes the databases and the saved keys, and leaves the rest", async () => {
        const factory = fakeFactory(["graphene_db_a", "graphene_v2_a_default"]);
        const storage = new FakeStorage({
            __graphene__settings_v4: "{}",
            other: "keep"
        });
        const env: any = {indexedDB: factory, localStorage: storage};
        const inventory = await localInventory(env);
        const close = jest.fn();
        const result = await deleteLocalData(env, inventory, {
            closeConnections: close
        });
        expect(close).toHaveBeenCalledTimes(1);
        expect(factory.deleted).toEqual([
            "graphene_db_a",
            "graphene_v2_a_default"
        ]);
        expect(result).toEqual({
            databases: ["graphene_db_a", "graphene_v2_a_default"],
            storageKeys: 1,
            blocked: []
        });
        expect(storage.keys()).toEqual(["other"]);
    });

    it("says which database another tab holds open instead of waiting for it", async () => {
        const factory = fakeFactory(
            ["graphene_db_a", "graphene_v2_a_default"],
            ["graphene_v2_a_default"]
        );
        const env: any = {
            indexedDB: factory,
            localStorage: new FakeStorage({})
        };
        const inventory = await localInventory(env);
        const result = await deleteLocalData(env, inventory, {timeoutMs: 20});
        expect(result.databases).toEqual(["graphene_db_a"]);
        expect(result.blocked).toEqual(["graphene_v2_a_default"]);
    });

    it("goes on when closing the connections fails", async () => {
        const factory = fakeFactory(["graphene_db_a"]);
        const env: any = {
            indexedDB: factory,
            localStorage: new FakeStorage({})
        };
        const result = await deleteLocalData(env, await localInventory(env), {
            closeConnections: () => {
                throw new Error("already closed");
            }
        });
        expect(result.databases).toEqual(["graphene_db_a"]);
    });
});

describe("the two approvals", () => {
    it("the first needs the risk accepted", () => {
        expect(canContinue(false)).toBe(false);
        expect(canContinue(true)).toBe(true);
    });

    it("the second needs the word typed as shown", () => {
        expect(canDelete("")).toBe(false);
        expect(canDelete("delete")).toBe(false);
        expect(canDelete("DELET")).toBe(false);
        expect(canDelete(CONFIRM_WORD)).toBe(true);
        expect(canDelete(`  ${CONFIRM_WORD} `)).toBe(true);
    });
});
