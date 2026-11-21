// Characterization tests for app/lib/i18n/translateShim.js: the same props rendered by the REAL `react-translate-component`
// package (imported here by its on-disk path, which the moduleNameMapper alias does not touch) and by the shim must give the
// same markup. The package reads the translator from legacy context and React 18 says so in the console: that is what the
// shim is for, and what is muted here.
import * as React from "react";
import {render, act} from "@testing-library/react";
import counterpart from "counterpart";
import ShimTranslate from "lib/i18n/translateShim";

const RealTranslate = require("../../../node_modules/react-translate-component/index.js");

beforeAll(() => {
    counterpart.registerTranslations("en", {
        hello: "Hello",
        greet: "Hello %(name)s, you have %(count)s new",
        html: "<b>bold</b> %(what)s",
        nested: {key: "Nested text"},
        placeholder_text: "Type here",
        title_text: "A title"
    });
    counterpart.registerTranslations("de", {hello: "Hallo"});
    counterpart.setLocale("en");
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());
afterEach(() => counterpart.setLocale("en"));

const markup = (Component, props, children) => {
    const {container, unmount} = render(
        React.createElement(Component, props, children)
    );
    const html = container.innerHTML;
    unmount();
    return html;
};

describe("the shim renders what the package renders", () => {
    const cases = [
        ["a key", {content: "hello"}],
        ["a nested key", {content: "nested.key"}],
        ["another element", {content: "hello", component: "h3"}],
        [
            "a class name and other attributes",
            {content: "hello", className: "x y", id: "z", "data-k": "v"}
        ],
        ["values given as props", {content: "greet", name: "Ann", count: 3}],
        [
            "values given in `with`",
            {content: "greet", with: {name: "Bo", count: 5}}
        ],
        [
            "a value that is an element",
            {
                content: "greet",
                name: React.createElement("i", null, "Cy"),
                count: 1
            }
        ],
        ["unsafe html", {content: "html", unsafe: true, what: "done"}],
        [
            "a text content element (interpolated, no wrapper)",
            {content: "greet", component: "option", name: "Di", count: 2}
        ],
        [
            "translated attributes",
            {
                component: "input",
                attributes: {
                    placeholder: "placeholder_text",
                    title: "title_text"
                }
            }
        ],
        [
            "no content: the element with its children",
            {component: "p", className: "c"},
            "plain child"
        ],
        ["a fixed locale", {content: "hello", locale: "de"}],
        ["a missing key", {content: "no.such.key"}]
    ];
    cases.forEach(([name, props, children]) => {
        it(name, () => {
            expect(markup(ShimTranslate, props, children)).toBe(
                markup(RealTranslate, props, children)
            );
        });
    });

    it("renders again in the new language when the language changes", () => {
        const real = render(
            React.createElement(RealTranslate, {content: "hello"})
        );
        const shim = render(
            React.createElement(ShimTranslate, {content: "hello"})
        );
        expect(shim.container.innerHTML).toBe(real.container.innerHTML);
        act(() => counterpart.setLocale("de"));
        expect(shim.container.textContent).toBe("Hallo");
        expect(shim.container.innerHTML).toBe(real.container.innerHTML);
        // a component that was unmounted does not listen any more
        shim.unmount();
        real.unmount();
        expect(() => act(() => counterpart.setLocale("en"))).not.toThrow();
    });

    it("keeps the fixed language of a `locale` prop when the language changes", () => {
        const shim = render(
            React.createElement(ShimTranslate, {content: "hello", locale: "de"})
        );
        act(() => counterpart.setLocale("en"));
        expect(shim.container.textContent).toBe("Hallo");
    });

    it("has the helpers of the package that the app could use", () => {
        expect(typeof ShimTranslate.translate).toBe("function");
        expect(ShimTranslate.getLocale()).toBe("en");
        expect(ShimTranslate.textContentComponents).toEqual(
            RealTranslate.textContentComponents
        );
        expect(
            render(ShimTranslate.translate("hello")).container.innerHTML
        ).toBe(render(RealTranslate.translate("hello")).container.innerHTML);
    });
});
