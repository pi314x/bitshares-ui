// Characterization tests for app/lib/i18n/intlShim.js: dates and numbers are formatted by the REAL react-intl 2 (imported by
// its on-disk path) and by the shim, with the app's named formats and the props the app passes; the text must be the same.
// (The package provides its locale through legacy context, which React 18 reports in the console: muted here.)
import * as React from "react";
import {render, act} from "@testing-library/react";
import {
    IntlProvider as ShimProvider,
    FormattedDate as ShimDate,
    FormattedNumber as ShimNumber,
    FormattedRelative as ShimRelative
} from "lib/i18n/intlShim";
import intlData from "components/Utility/intlData";

const real = require("../../../node_modules/react-intl/lib/index.js");

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

const text = (Provider, locale, element) => {
    const {container, unmount} = render(
        React.createElement(
            Provider,
            {locale, formats: intlData.formats, initialNow: 0},
            element
        )
    );
    const out = container.textContent;
    unmount();
    return out;
};

const WHEN = Date.UTC(2026, 10, 3, 14, 5, 9);

describe("dates", () => {
    ["en", "de", "fr"].forEach(locale => {
        ["full", "short", "time"].forEach(format => {
            it(`the named format "${format}" in ${locale}`, () => {
                expect(
                    text(
                        ShimProvider,
                        locale,
                        React.createElement(ShimDate, {value: WHEN, format})
                    )
                ).toBe(
                    text(
                        real.IntlProvider,
                        locale,
                        React.createElement(real.FormattedDate, {
                            value: WHEN,
                            format
                        })
                    )
                );
            });
        });
        it(`no format in ${locale}, and a date given as an object or a string`, () => {
            [WHEN, new Date(WHEN), "2026-11-03T14:05:09Z"].forEach(value => {
                expect(
                    text(
                        ShimProvider,
                        locale,
                        React.createElement(ShimDate, {value})
                    )
                ).toBe(
                    text(
                        real.IntlProvider,
                        locale,
                        React.createElement(real.FormattedDate, {value})
                    )
                );
            });
        });
    });
});

describe("numbers", () => {
    const cases = [
        {
            value: 1234567.891,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        },
        {value: 0.5, minimumFractionDigits: 5, maximumFractionDigits: 5},
        {value: 12, minimumFractionDigits: 0, maximumFractionDigits: 8},
        {value: -0.000123, style: "decimal"},
        {value: 42}
    ];
    ["en", "de", "fr"].forEach(locale => {
        cases.forEach((props, i) => {
            it(`case ${i} in ${locale}`, () => {
                expect(
                    text(
                        ShimProvider,
                        locale,
                        React.createElement(ShimNumber, props)
                    )
                ).toBe(
                    text(
                        real.IntlProvider,
                        locale,
                        React.createElement(real.FormattedNumber, props)
                    )
                );
            });
        });
    });
});

describe("relative times", () => {
    // (the package words them from its own data: the wording is compared for the cases the app shows)
    const at = ms => ({value: WHEN + ms, initialNow: WHEN});
    const second = 1000,
        minute = 60 * second,
        hour = 60 * minute,
        day = 24 * hour;
    [
        ["a few seconds ago", -5 * second],
        ["a minute", -minute],
        ["minutes ago", -5 * minute],
        ["an hour", -hour],
        ["hours ago", -3 * hour],
        ["days ago", -4 * day],
        ["in a while", 2 * hour]
    ].forEach(([name, ms]) => {
        it(name, () => {
            const shim = text(
                ShimProvider,
                "en",
                React.createElement(ShimRelative, at(ms))
            );
            const pkg = text(
                real.IntlProvider,
                "en",
                React.createElement(real.FormattedRelative, at(ms))
            );
            // same words, or the same meaning in the browser's own wording: both are about the same distance
            expect(shim).toMatch(/\d|now|yesterday|tomorrow|last|next|ago|in /);
            expect(shim.replace(/\s+/g, " ").toLowerCase()).toBe(
                pkg.replace(/\s+/g, " ").toLowerCase()
            );
        });
    });

    it("moves on with its interval", () => {
        jest.useFakeTimers();
        const clock = jest.spyOn(Date, "now");
        try {
            const start = 1700000000000;
            clock.mockReturnValue(start);
            const {container} = render(
                React.createElement(
                    ShimProvider,
                    {locale: "en", formats: {}},
                    React.createElement(ShimRelative, {
                        value: start - 10 * 1000,
                        updateInterval: 1000,
                        initialNow: start
                    })
                )
            );
            const before = container.textContent;
            expect(before).toMatch(/10 seconds ago/);
            clock.mockReturnValue(start + 3 * 60 * 1000);
            act(() => {
                jest.advanceTimersByTime(2000);
            });
            expect(container.textContent).not.toBe(before);
            expect(container.textContent).toMatch(/minutes? ago/);
        } finally {
            clock.mockRestore();
            jest.useRealTimers();
        }
    });
});
