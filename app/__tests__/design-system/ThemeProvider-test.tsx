import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {ThemeProvider, useTheme} from "../../design-system/ThemeProvider";

function ToggleProbe() {
    const {theme, toggleTheme} = useTheme();
    return (
        <button onClick={toggleTheme}>{`theme:${theme}`}</button>
    );
}

describe("design-system/ThemeProvider", () => {
    beforeEach(() => {
        try {
            window.localStorage.clear();
        } catch (e) {
            // ignore
        }
        document.documentElement.removeAttribute("data-theme");
    });

    it("uncontrolled: defaults to dark and toggles its own state", () => {
        const {getByText} = render(
            <ThemeProvider>
                <ToggleProbe />
            </ThemeProvider>
        );
        expect(getByText("theme:dark")).toBeTruthy();
        fireEvent.click(getByText("theme:dark"));
        expect(getByText("theme:light")).toBeTruthy();
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "light"
        );
    });

    it("controlled: defers to the value/onChange props instead of its own state", () => {
        const onChange = jest.fn();
        const {getByText, rerender} = render(
            <ThemeProvider value="light" onChange={onChange}>
                <ToggleProbe />
            </ThemeProvider>
        );
        expect(getByText("theme:light")).toBeTruthy();

        fireEvent.click(getByText("theme:light"));
        // Controlled: clicking calls onChange, but the displayed theme does
        // NOT flip on its own until the parent re-renders with a new value
        // — this component isn't the source of truth here.
        expect(onChange).toHaveBeenCalledWith("dark");
        expect(getByText("theme:light")).toBeTruthy();

        rerender(
            <ThemeProvider value="dark" onChange={onChange}>
                <ToggleProbe />
            </ThemeProvider>
        );
        expect(getByText("theme:dark")).toBeTruthy();
    });
});
