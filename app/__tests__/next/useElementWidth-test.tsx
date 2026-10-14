import * as React from "react";
import {render, act} from "@testing-library/react";
import {useElementWidth} from "../../next/hooks/useElementWidth";

function Probe() {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    return (
        <div ref={ref} data-testid="box">
            {width === null ? "unmeasured" : `w=${width}`}
        </div>
    );
}

describe("useElementWidth", () => {
    const original = (global as any).ResizeObserver;
    afterEach(() => {
        (global as any).ResizeObserver = original;
    });

    it("stays null where ResizeObserver does not exist", () => {
        (global as any).ResizeObserver = undefined;
        const {getByTestId} = render(<Probe />);
        expect(getByTestId("box").textContent).toBe("unmeasured");
    });

    it("reports the element's width and follows resizes", () => {
        let notify: () => void = () => undefined;
        let disconnected = false;
        (global as any).ResizeObserver = class {
            constructor(cb: () => void) {
                notify = cb;
            }
            observe() {
                return undefined;
            }
            disconnect() {
                disconnected = true;
            }
        };
        let width = 1134;
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get: () => width
        });
        const {getByTestId, unmount} = render(<Probe />);
        expect(getByTestId("box").textContent).toBe("w=1134");
        width = 780;
        act(() => notify());
        expect(getByTestId("box").textContent).toBe("w=780");
        unmount();
        expect(disconnected).toBe(true);
        delete (HTMLElement.prototype as any).clientWidth;
    });
});
