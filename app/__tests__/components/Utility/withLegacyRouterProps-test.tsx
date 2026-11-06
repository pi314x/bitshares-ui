import * as React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {
    withLegacyRouterProps,
    LegacyRouterProps
} from "../../../components/Utility/withLegacyRouterProps";

function Probe(props: Partial<LegacyRouterProps> & {extra?: string}) {
    const {match, history, location, extra} = props;
    return (
        <div>
            <span data-testid="data">{match!.params.data}</span>
            <span data-testid="url">{match!.url}</span>
            <span data-testid="path">{location!.pathname}</span>
            <span data-testid="extra">{extra}</span>
            <button onClick={() => history!.push("/other/42")}>push</button>
            <button onClick={() => history!.replace("/other/7")}>
                replace
            </button>
            <button onClick={() => history!.goBack()}>back</button>
        </div>
    );
}
const Wrapped = withLegacyRouterProps(Probe);

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={["/", path]} initialIndex={1}>
            <Routes>
                <Route
                    path="/invoice/:data"
                    element={<Wrapped extra="kept" />}
                />
                <Route path="/other/:data" element={<Wrapped />} />
                <Route path="/" element={<span>home</span>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("withLegacyRouterProps", () => {
    it("injects match.params, match.url and location like react-router v5", () => {
        renderAt("/invoice/pay");
        expect(screen.getByTestId("data").textContent).toBe("pay");
        expect(screen.getByTestId("url").textContent).toBe("/invoice/pay");
        expect(screen.getByTestId("path").textContent).toBe("/invoice/pay");
    });

    it("passes the component's own props through", () => {
        renderAt("/invoice/pay");
        expect(screen.getByTestId("extra").textContent).toBe("kept");
    });

    it("history.push navigates, history.replace replaces, goBack returns", () => {
        renderAt("/invoice/pay");
        fireEvent.click(screen.getByText("push"));
        expect(screen.getByTestId("path").textContent).toBe("/other/42");
        expect(screen.getByTestId("data").textContent).toBe("42");

        fireEvent.click(screen.getByText("replace"));
        expect(screen.getByTestId("path").textContent).toBe("/other/7");

        // push added one entry and replace swapped it, so one step back
        // lands on the original /invoice/pay entry.
        fireEvent.click(screen.getByText("back"));
        expect(screen.getByTestId("path").textContent).toBe("/invoice/pay");
    });

    it("gives the wrapper a readable display name", () => {
        expect(Wrapped.displayName).toBe("withLegacyRouterProps(Probe)");
    });
});
