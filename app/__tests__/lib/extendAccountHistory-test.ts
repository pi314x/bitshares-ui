import Immutable from "immutable";
import {extendAccountHistory} from "../../lib/chain/extendAccountHistory";

const op = (n: number) => ({id: `1.11.${n}`, op: [0, {}], block_num: n});

function fakeStore(ids: number[]) {
    const objects = new Map<string, any>();
    objects.set(
        "1.2.10",
        Immutable.fromJS({
            id: "1.2.10",
            history: ids.map(op)
        })
    );
    return {
        objects_by_id: objects,
        notified: 0,
        notifySubscribers() {
            this.notified++;
        }
    };
}

describe("extendAccountHistory", () => {
    it("asks for the operations older than the oldest one it has and appends them", async () => {
        const store: any = fakeStore([300, 299, 298]);
        const exec = jest.fn().mockResolvedValue([op(297), op(296)]);
        const added = await extendAccountHistory("1.2.10", store, {exec}, 100);
        expect(exec).toHaveBeenCalledWith("get_account_history", [
            "1.2.10",
            "1.11.0",
            100,
            "1.11.297"
        ]);
        expect(added).toBe(2);
        const history = store.objects_by_id.get("1.2.10").get("history");
        expect(history.map((o: any) => o.get("id")).toJS()).toEqual([
            "1.11.300",
            "1.11.299",
            "1.11.298",
            "1.11.297",
            "1.11.296"
        ]);
        expect(store.notified).toBe(1);
    });

    it("does nothing at the beginning of the history, for a missing account or an empty answer", async () => {
        const exec = jest.fn().mockResolvedValue([]);
        expect(
            await extendAccountHistory("1.2.10", fakeStore([1]), {exec})
        ).toBe(0);
        expect(exec).not.toHaveBeenCalled();
        expect(
            await extendAccountHistory("1.2.99", fakeStore([5]), {exec})
        ).toBe(0);
        expect(
            await extendAccountHistory("1.2.10", fakeStore([5, 4]), {exec})
        ).toBe(0);
    });

    it("does not add what a concurrent request already added", async () => {
        const store: any = fakeStore([300, 299]);
        const exec = jest.fn().mockImplementation(async () => {
            // meanwhile another extension appended 298 and 297
            const current = store.objects_by_id.get("1.2.10");
            store.objects_by_id.set(
                "1.2.10",
                current.set(
                    "history",
                    current
                        .get("history")
                        .concat(Immutable.fromJS([op(298), op(297)]))
                )
            );
            return [op(298), op(297), op(296)];
        });
        const added = await extendAccountHistory("1.2.10", store, {exec});
        expect(added).toBe(1);
        const ids = store.objects_by_id
            .get("1.2.10")
            .get("history")
            .map((o: any) => o.get("id"))
            .toJS();
        expect(ids).toEqual([
            "1.11.300",
            "1.11.299",
            "1.11.298",
            "1.11.297",
            "1.11.296"
        ]);
    });
});
