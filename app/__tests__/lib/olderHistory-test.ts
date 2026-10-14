import {
    askNode,
    historyNodeCandidates,
    olderHistoryFromOtherNodes,
    resetLastGoodNode
} from "../../lib/chain/olderHistory";

describe("historyNodeCandidates", () => {
    it("keeps the public main-chain nodes and drops the automatic pick, local and test nodes", () => {
        const list = [
            {url: "wss://fake.automatic-selection.com"},
            {url: "ws://127.0.0.1:8090"},
            {url: "wss://a.example/ws", region: "Western Europe"},
            {url: "wss://b.example/ws", region: "TESTNET - Europe"},
            {url: "wss://c.example/ws"}
        ];
        expect(historyNodeCandidates(list)).toEqual([
            "wss://a.example/ws",
            "wss://c.example/ws"
        ]);
        expect(historyNodeCandidates(list, ["wss://a.example/ws"])).toEqual([
            "wss://c.example/ws"
        ]);
    });
});

/** A websocket that answers like a node: login, then the history api id, then
 * `get_account_history` from `answers[url]`. */
function fakeSockets(answers: {[url: string]: any[] | "down"}) {
    const opened: string[] = [];
    class FakeSocket {
        onopen: any;
        onmessage: any;
        onerror: any;
        onclose: any;
        constructor(public url: string) {
            opened.push(url);
            setTimeout(() => {
                if (answers[url] === "down") this.onerror && this.onerror();
                else this.onopen && this.onopen();
            }, 0);
        }
        send(raw: string) {
            const {id, params} = JSON.parse(raw);
            const [api, method] = params;
            let result: any = null;
            if (method === "login") result = true;
            else if (method === "history") result = 7;
            else if (method === "get_account_history" && api === 7) {
                result = answers[this.url];
            }
            setTimeout(
                () =>
                    this.onmessage &&
                    this.onmessage({data: JSON.stringify({id, result})}),
                0
            );
        }
        close() {
            // nothing to release
        }
    }
    return {FakeSocket, opened};
}

const row = (n: number) => ({id: `1.11.${n}`, op: [0, {}], block_num: n});

describe("olderHistoryFromOtherNodes", () => {
    beforeEach(() => resetLastGoodNode());

    it("takes the first node that has older operations and skips one that is down", async () => {
        const {FakeSocket, opened} = fakeSockets({
            "wss://down": "down",
            "wss://empty": [],
            "wss://full": [row(90), row(89)],
            "wss://never": [row(1)]
        });
        const found = await olderHistoryFromOtherNodes(
            "1.2.5",
            "1.11.90",
            100,
            ["wss://down", "wss://empty", "wss://full", "wss://never"],
            4,
            FakeSocket
        );
        expect(found.node).toBe("wss://full");
        expect(found.rows.map(r => r.id)).toEqual(["1.11.90", "1.11.89"]);
        expect(opened).toEqual(["wss://down", "wss://empty", "wss://full"]);
    });

    it("drops rows that are not older than the start, and reports nothing when no node has any", async () => {
        const {FakeSocket} = fakeSockets({
            "wss://newest": [row(500), row(499)] // ignores the start
        });
        const found = await olderHistoryFromOtherNodes(
            "1.2.5",
            "1.11.90",
            100,
            ["wss://newest"],
            4,
            FakeSocket
        );
        expect(found).toEqual({rows: [], node: null});
    });

    it("tries the node that worked last time first", async () => {
        const first = fakeSockets({"wss://a": [], "wss://b": [row(10)]});
        await olderHistoryFromOtherNodes(
            "1.2.5",
            "1.11.20",
            100,
            ["wss://a", "wss://b"],
            4,
            first.FakeSocket
        );
        const second = fakeSockets({"wss://a": [row(9)], "wss://b": [row(8)]});
        const again = await olderHistoryFromOtherNodes(
            "1.2.5",
            "1.11.20",
            100,
            ["wss://a", "wss://b"],
            4,
            second.FakeSocket
        );
        expect(again.node).toBe("wss://b");
        expect(second.opened[0]).toBe("wss://b");
    });
});

describe("askNode", () => {
    it("rejects when the node does not answer in time", async () => {
        class Silent {
            onopen: any;
            constructor() {
                setTimeout(() => this.onopen && this.onopen(), 0);
            }
            send() {
                // never answers
            }
            close() {
                // nothing to release
            }
        }
        await expect(
            askNode("wss://silent", call => call(1, "login", []), 30, Silent)
        ).rejects.toThrow("timeout");
    });
});
