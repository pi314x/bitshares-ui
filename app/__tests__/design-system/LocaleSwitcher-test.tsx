import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {LocaleSwitcher} from "../../design-system/LocaleSwitcher";

describe("design-system/LocaleSwitcher", () => {
    it("shows a display name for the current locale on the trigger", () => {
        const {getByText} = render(
            <LocaleSwitcher
                currentLocale="de"
                locales={["en", "de", "fr"]}
                onSelect={() => {}}
            />
        );
        expect(getByText("Deutsch")).toBeTruthy();
    });

    it("opens the menu and calls onSelect with the clicked locale code", () => {
        const onSelect = jest.fn();
        const {getByText} = render(
            <LocaleSwitcher
                currentLocale="en"
                locales={["en", "de", "fr"]}
                onSelect={onSelect}
            />
        );
        fireEvent.click(getByText("English"));
        fireEvent.click(getByText("Français"));
        expect(onSelect).toHaveBeenCalledWith("fr");
    });

    it("falls back to the raw code for a locale with no display name", () => {
        const {getByText} = render(
            <LocaleSwitcher
                currentLocale="xx"
                locales={["xx"]}
                onSelect={() => {}}
            />
        );
        expect(getByText("xx")).toBeTruthy();
    });
});
