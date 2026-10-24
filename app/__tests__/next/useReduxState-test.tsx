import * as React from "react";
import {render, act} from "@testing-library/react";
import {useReduxState} from "../../next/hooks/useReduxState";
import {reduxStore} from "../../store/reduxStore";
import {setNotification} from "../../store/slices/notificationSlice";
import {selectNotification} from "../../store/slices/notificationSlice";

let renders = 0;

function Probe() {
    const notification = useReduxState(selectNotification);
    renders += 1;
    return (
        <span data-testid="msg">{(notification as any)?.message ?? ""}</span>
    );
}

function Other() {
    // a selector that never changes in this test
    const intl = useReduxState(state => state.intl);
    renders += 1;
    return <span data-testid="locale">{(intl as any).currentLocale}</span>;
}

beforeEach(() => {
    renders = 0;
    act(() => {
        reduxStore.dispatch(setNotification(null as any));
    });
});

describe("useReduxState", () => {
    it("reads the current value without a Provider", () => {
        act(() => {
            reduxStore.dispatch(setNotification({message: "first"} as any));
        });
        const {getByTestId} = render(<Probe />);
        expect(getByTestId("msg").textContent).toBe("first");
    });

    it("re-renders when the selected value changes", () => {
        const {getByTestId} = render(<Probe />);
        expect(getByTestId("msg").textContent).toBe("");
        act(() => {
            reduxStore.dispatch(setNotification({message: "second"} as any));
        });
        expect(getByTestId("msg").textContent).toBe("second");
    });

    it("does not re-render for a change in an unrelated slice", () => {
        const {getByTestId} = render(<Other />);
        const before = renders;
        expect(getByTestId("locale")).toBeTruthy();
        act(() => {
            reduxStore.dispatch(setNotification({message: "noise"} as any));
        });
        expect(renders).toBe(before);
    });

    it("stops listening on unmount", () => {
        const {unmount} = render(<Probe />);
        unmount();
        expect(() =>
            act(() => {
                reduxStore.dispatch(setNotification({message: "late"} as any));
            })
        ).not.toThrow();
    });
});
