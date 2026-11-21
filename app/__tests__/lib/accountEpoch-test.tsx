import * as React from "react";
import {act, render} from "@testing-library/react";
import {
    bumpAccountEpoch,
    getAccountEpoch,
    getAccountEpochReason,
    useRefreshOnEpoch
} from "../../lib/common/accountEpoch";

function Page(props: {reload: () => void; enabled?: boolean}) {
    useRefreshOnEpoch(props.reload, props.enabled, 300);
    return null;
}

beforeEach(() => {
    jest.useFakeTimers();
});
afterEach(() => {
    jest.useRealTimers();
});

describe("the account's epoch", () => {
    it("goes up with every bump, and says why", () => {
        const before = getAccountEpoch();
        act(() => bumpAccountEpoch("activity"));
        expect(getAccountEpoch()).toBe(before + 1);
        expect(getAccountEpochReason()).toBe("activity");
        act(() => bumpAccountEpoch("visible"));
        expect(getAccountEpoch()).toBe(before + 2);
        expect(getAccountEpochReason()).toBe("visible");
    });
});

describe("useRefreshOnEpoch", () => {
    it("does not read when the page opens, and reads once a moment after the epoch goes up", () => {
        const reload = jest.fn();
        render(<Page reload={reload} />);
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(reload).not.toHaveBeenCalled();
        act(() => bumpAccountEpoch("activity"));
        expect(reload).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(299);
        });
        expect(reload).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(2);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("reads once for several bumps in a row", () => {
        const reload = jest.fn();
        render(<Page reload={reload} />);
        act(() => bumpAccountEpoch("activity"));
        act(() => {
            jest.advanceTimersByTime(100);
        });
        act(() => bumpAccountEpoch("missed"));
        act(() => {
            jest.advanceTimersByTime(100);
        });
        act(() => bumpAccountEpoch("interval"));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("reads with the newest function the page gave, and not at all when switched off or gone", () => {
        const first = jest.fn();
        const second = jest.fn();
        const view = render(<Page reload={first} />);
        view.rerender(<Page reload={second} />);
        act(() => bumpAccountEpoch("activity"));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        // off: the change is seen and not acted on
        view.rerender(<Page reload={second} enabled={false} />);
        act(() => bumpAccountEpoch("activity"));
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(second).toHaveBeenCalledTimes(1);
        // gone before the moment is up: not read
        view.rerender(<Page reload={second} enabled={true} />);
        act(() => bumpAccountEpoch("activity"));
        view.unmount();
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(second).toHaveBeenCalledTimes(1);
    });
});
