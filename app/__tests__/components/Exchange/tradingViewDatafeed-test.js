// The datafeed hands the chart bars one at a time; the chart refuses a bar that is
// older than the last it has ("time order violation"). A history that comes back
// in another bucket size, or late, must not be pushed as an update.
let mockSubscriber = null;
let mockPriceData = [];
jest.mock("stores/MarketsStore", () => ({
    __esModule: true,
    default: {
        subscribe: (name, callback) => {
            mockSubscriber = callback;
        },
        unsubscribe: jest.fn(),
        clearSubs: jest.fn(),
        getState: () => ({priceData: mockPriceData})
    }
}));
jest.mock("actions/MarketsActions", () => ({__esModule: true, default: {}}));

import {DataFeed} from "../../../components/Exchange/tradingViewClasses";

const bar = (time, close) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1
});

describe("DataFeed.subscribeBars", () => {
    const start = (history, latest) => {
        mockPriceData = history;
        const feed = new DataFeed();
        feed.latestBar = latest;
        const onRealtime = jest.fn();
        feed.subscribeBars({}, "60", onRealtime, "uid", () => {});
        return {feed, onRealtime};
    };

    it("pushes bars newer than the last one it has", () => {
        const {onRealtime} = start([bar(1000, 1), bar(2000, 2)], bar(1000, 1));
        mockSubscriber();
        expect(onRealtime).toHaveBeenCalledTimes(1);
        expect(onRealtime.mock.calls[0][0].time).toBe(2000);
    });

    it("pushes an update of the newest bar", () => {
        const {onRealtime} = start([bar(1000, 1), bar(2000, 2)], bar(2000, 2));
        mockPriceData = [bar(1000, 1), bar(2000, 3)];
        mockSubscriber();
        expect(onRealtime).toHaveBeenCalledTimes(1);
        expect(onRealtime.mock.calls[0][0].close).toBe(3);
    });

    it("does not push a bar older than the last it has", () => {
        // the history was reloaded and ends earlier than what the chart holds
        const {onRealtime} = start([bar(1000, 1), bar(2000, 2)], bar(3000, 5));
        mockSubscriber();
        expect(onRealtime).not.toHaveBeenCalled();
    });

    it("copes with an empty history", () => {
        const {onRealtime} = start([], bar(3000, 5));
        expect(() => mockSubscriber()).not.toThrow();
        expect(onRealtime).not.toHaveBeenCalled();
    });
});
