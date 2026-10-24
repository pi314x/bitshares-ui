import {fetchObjectsPartial} from "../../lib/chain/fetchObjectsPartial";

describe("fetchObjectsPartial", () => {
    it("returns what the first successful fetch resolves with", async () => {
        const fetch = jest.fn(() => Promise.resolve(["a", "b"]));
        const readNow = jest.fn(() => ["x"]);
        await expect(fetchObjectsPartial(fetch, readNow)).resolves.toEqual([
            "a",
            "b"
        ]);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(readNow).not.toHaveBeenCalled();
    });

    it("retries a timed-out fetch and uses the result of the retry", async () => {
        const fetch = jest
            .fn()
            .mockRejectedValueOnce("timed out")
            .mockResolvedValueOnce(["a", "b"]);
        await expect(fetchObjectsPartial(fetch, () => ["x"])).resolves.toEqual([
            "a",
            "b"
        ]);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("falls back to what is cached after the last attempt, never rejecting", async () => {
        const fetch = jest.fn(() => Promise.reject("timed out"));
        const cached = ["a", undefined, "c"];
        await expect(
            fetchObjectsPartial<string | undefined>(fetch, () => cached, 3)
        ).resolves.toEqual(cached);
        expect(fetch).toHaveBeenCalledTimes(3);
    });
});
