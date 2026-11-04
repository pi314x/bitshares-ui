// app/lib/loadableShim.js: what the app uses of react-loadable.
import * as React from "react";
import {render, act} from "@testing-library/react";
import Loadable from "lib/loadableShim";

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
    });

describe("Loadable", () => {
    it("shows the loading component until the module is there, then the module's default export with the props", async () => {
        let done;
        const loader = () => new Promise(resolve => (done = resolve));
        const Loading = props =>
            React.createElement("p", null, props.isLoading ? "loading" : "?");
        const Page = Loadable({loader, loading: Loading, delay: 0});
        const {container} = render(React.createElement(Page, {name: "Ann"}));
        await flush();
        expect(container.textContent).toBe("loading");
        const Loaded = props =>
            React.createElement("b", null, "page " + props.name);
        await act(async () => done({__esModule: true, default: Loaded}));
        await flush();
        expect(container.innerHTML).toBe("<b>page Ann</b>");
    });

    it("does not show the loading component before its delay (a spinner that flashes)", async () => {
        jest.useFakeTimers();
        try {
            const seen = [];
            const Loading = props => {
                seen.push(props.pastDelay);
                return null;
            };
            const Page = Loadable({
                loader: () => new Promise(() => undefined),
                loading: Loading,
                delay: 200
            });
            render(React.createElement(Page));
            expect(seen[0]).toBe(false);
            act(() => {
                jest.advanceTimersByTime(250);
            });
            expect(seen[seen.length - 1]).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });

    it("loads once, for every use, and has preload", async () => {
        const loader = jest.fn(async () => ({
            __esModule: true,
            default: () => React.createElement("i", null, "x")
        }));
        const Page = Loadable({loader, loading: () => null});
        await Page.preload();
        const a = render(React.createElement(Page));
        const b = render(React.createElement(Page));
        await flush();
        expect(a.container.innerHTML).toBe("<i>x</i>");
        expect(b.container.innerHTML).toBe("<i>x</i>");
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it("tells the loading component the error when the module cannot be loaded, and loads again on retry", async () => {
        let attempt = 0;
        const loader = jest.fn(async () => {
            attempt++;
            if (attempt === 1) throw new Error("chunk failed");
            return {
                __esModule: true,
                default: () => React.createElement("u", null, "ok")
            };
        });
        const Loading = props =>
            props.error
                ? React.createElement(
                      "button",
                      {onClick: props.retry},
                      "retry: " + props.error.message
                  )
                : React.createElement("span", null, "...");
        const Page = Loadable({loader, loading: Loading, delay: 0});
        const {container} = render(React.createElement(Page));
        await flush();
        expect(container.textContent).toBe("retry: chunk failed");
        await act(async () => {
            container.querySelector("button").click();
        });
        await flush();
        expect(container.innerHTML).toBe("<u>ok</u>");
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it("takes a module without an ES default as the component, and a `render` of its own", async () => {
        const Plain = Loadable({
            loader: async () => {
                const PlainComponent = () =>
                    React.createElement("s", null, "plain");
                return PlainComponent;
            },
            loading: () => null
        });
        const a = render(React.createElement(Plain));
        await flush();
        expect(a.container.innerHTML).toBe("<s>plain</s>");
        const Own = Loadable({
            loader: async () => ({greeting: "hi"}),
            loading: () => null,
            render: (loaded, props) =>
                React.createElement(
                    "em",
                    null,
                    loaded.greeting + " " + props.who
                )
        });
        const b = render(React.createElement(Own, {who: "you"}));
        await flush();
        expect(b.container.innerHTML).toBe("<em>hi you</em>");
    });
});
