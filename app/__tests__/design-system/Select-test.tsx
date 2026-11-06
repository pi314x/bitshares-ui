import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Select} from "../../design-system/Select";

describe("design-system/Select", () => {
    it("shows the placeholder closed, and opens the option list on click", () => {
        const {getByText, queryByRole} = render(
            <Select placeholder="Pick an asset">
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        expect(getByText("Pick an asset")).toBeTruthy();
        expect(queryByRole("listbox")).toBeNull();

        fireEvent.click(getByText("Pick an asset"));
        expect(queryByRole("listbox")).toBeTruthy();
        expect(getByText("USD")).toBeTruthy();
    });

    it("calls onChange and onSelect with the chosen value, and closes", () => {
        const onChange = jest.fn();
        const onSelect = jest.fn();
        const {getByText, queryByRole} = render(
            <Select
                placeholder="Pick an asset"
                onChange={onChange}
                onSelect={onSelect}
            >
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick an asset"));
        fireEvent.click(getByText("USD"));
        expect(onChange).toHaveBeenCalledWith("USD");
        expect(onSelect).toHaveBeenCalledWith("USD");
        expect(queryByRole("listbox")).toBeNull();
        expect(getByText("USD")).toBeTruthy();
    });

    it("does not select a disabled option", () => {
        const onChange = jest.fn();
        const {getByText} = render(
            <Select placeholder="Pick" onChange={onChange}>
                <Select.Option value="a" disabled>
                    A (disabled)
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.click(getByText("A (disabled)"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("still fires a click on interactive content nested inside a disabled option", () => {
        const onChange = jest.fn();
        const onCheckboxClick = jest.fn();
        const {getByText, getByLabelText} = render(
            <Select placeholder="Pick" onChange={onChange}>
                <Select.Option value="a" disabled>
                    <label>
                        <input
                            type="checkbox"
                            aria-label="toggle a"
                            onClick={onCheckboxClick}
                        />
                        A
                    </label>
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.click(getByLabelText("toggle a"));
        expect(onCheckboxClick).toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("applies an Option's own className to its rendered row", () => {
        const {getByText} = render(
            <Select placeholder="Pick">
                <Select.Option value="a" className="my-option">
                    A
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        expect(getByText("A").className).toContain("my-option");
    });

    it("applies dropdownClassName to the open dropdown panel", () => {
        const {getByText, getByRole} = render(
            <Select placeholder="Pick" dropdownClassName="my-dropdown">
                <Select.Option value="a">A</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        expect(getByRole("listbox").className).toContain("my-dropdown");
    });

    it("filters options by typed text when showSearch is set", () => {
        const {getByText, getByDisplayValue, queryByText} = render(
            <Select placeholder="Pick" showSearch>
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {target: {value: "us"}});
        expect(getByText("USD")).toBeTruthy();
        expect(queryByText("BTS")).toBeNull();
    });

    it("shows notFoundContent when no option matches the search", () => {
        const {getByText, getByDisplayValue} = render(
            <Select placeholder="Pick" showSearch notFoundContent="No match">
                <Select.Option value="BTS">BTS</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {
            target: {value: "zzz"}
        });
        expect(getByText("No match")).toBeTruthy();
    });

    it("calls onSearch with the raw typed text on every keystroke", () => {
        const onSearch = jest.fn();
        const {getByText, getByDisplayValue} = render(
            <Select placeholder="Pick" showSearch onSearch={onSearch}>
                <Select.Option value="BTS">BTS</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {target: {value: "zzz"}});
        expect(onSearch).toHaveBeenCalledWith("zzz");
    });

    it("shows the option's value, not its children, as the closed label when optionLabelProp is value", () => {
        const {getByText, queryByText} = render(
            <Select placeholder="Pick" value="rudex" optionLabelProp="value">
                <Select.Option value="rudex">
                    RuDex <span>(balance: 5)</span>
                </Select.Option>
            </Select>
        );
        expect(getByText("rudex")).toBeTruthy();
        expect(queryByText("RuDex")).toBeNull();
    });

    it("stays controlled when value is passed, ignoring its own selection state", () => {
        const {getByText} = render(
            <Select value="BTS" onChange={() => {}}>
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("BTS"));
        fireEvent.click(getByText("USD"));
        // Controlled: the displayed value only changes if a new `value`
        // prop is passed in, not from the click itself.
        expect(getByText("BTS")).toBeTruthy();
    });

    it("lets the dropdown grow past the trigger's width when dropdownMatchSelectWidth is false", () => {
        const {getByRole} = render(
            <Select
                value="BTS"
                onChange={() => {}}
                dropdownMatchSelectWidth={false}
            >
                <Select.Option value="BTS">BTS</Select.Option>
            </Select>
        );
        fireEvent.click(getByRole("button"));
        // The list is portalled to <body> so no container can clip it.
        const dropdown = document.body.querySelector(
            '[role="listbox"]'
        ) as HTMLElement;
        expect(dropdown.className).toMatch(/dropdownAutoWidth/);
    });

    it("draws the list on <body>, outside a clipping container", () => {
        const {getByRole, container} = render(
            <div style={{overflow: "hidden"}}>
                <Select value="BTS" onChange={() => {}}>
                    <Select.Option value="BTS">BTS</Select.Option>
                </Select>
            </div>
        );
        fireEvent.click(getByRole("button"));
        const list = document.body.querySelector('[role="listbox"]');
        expect(list).toBeTruthy();
        expect(container.contains(list)).toBe(false);
    });

    it("selects an option by click and closes (portal outside-click safe)", () => {
        const onChange = jest.fn();
        const {getByRole, getByText} = render(
            <Select value="BTS" onChange={onChange}>
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByRole("button"));
        const option = getByText("USD");
        fireEvent.mouseDown(option);
        fireEvent.click(option);
        expect(onChange).toHaveBeenCalledWith("USD");
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    });
});

describe("design-system/Select option triggerLabel", () => {
    it("shows the option's triggerLabel in the closed select, not its row", () => {
        const {getByRole} = render(
            <Select value="g1" style={{width: 200}}>
                <Select.Option value="g1" triggerLabel="PirateCash">
                    PirateCash <span>12.00 BTC</span>
                </Select.Option>
                <Select.Option value="g2">Other</Select.Option>
            </Select>
        );
        expect(getByRole("button").textContent).toContain("PirateCash");
        expect(getByRole("button").textContent).not.toContain("12.00");
    });

    // A 100px fee asset field at the right edge of a phone opened a list as wide as the field,
    // from the field's left edge: out of the window, the options cut off after their first letter.
    describe("a list under a small field at the edge of the window", () => {
        const original = Element.prototype.getBoundingClientRect;
        const clientWidth = Object.getOwnPropertyDescriptor(
            Element.prototype,
            "clientWidth"
        );

        beforeEach(() => {
            Object.defineProperty(document.documentElement, "clientWidth", {
                configurable: true,
                value: 400
            });
            Element.prototype.getBoundingClientRect = function(this: Element) {
                // the field: 100px wide, its right edge 10px from the window's
                if (this.tagName === "DIV" && !this.getAttribute("role")) {
                    return {
                        left: 290,
                        right: 390,
                        top: 100,
                        bottom: 130,
                        width: 100,
                        height: 30,
                        x: 290,
                        y: 100
                    } as DOMRect;
                }
                return original.call(this);
            };
        });

        afterEach(() => {
            Element.prototype.getBoundingClientRect = original;
            delete (document.documentElement as any).clientWidth;
            if (clientWidth) void clientWidth;
        });

        it("is as wide as an asset name needs and stays inside the window", () => {
            const {getByText, getByRole} = render(
                <Select placeholder="Fee asset" style={{width: 100}}>
                    <Select.Option value="XBTSX.A">XBTSX.A</Select.Option>
                </Select>
            );
            fireEvent.click(getByText("Fee asset"));
            const list = getByRole("listbox") as HTMLElement;
            const left = parseFloat(list.style.left);
            const width = parseFloat(list.style.width);
            expect(width).toBeGreaterThanOrEqual(160);
            expect(left).toBeGreaterThanOrEqual(8);
            expect(left + width).toBeLessThanOrEqual(400 - 8);
        });
    });

    // A phone's keyboard comes up when the search box of the list gets the focus, and shrinks the window:
    // the list used to flip from under its field to above it (and onto other content) at that moment,
    // because it chose its side again with the smaller window.
    describe("a list on a phone, when the keyboard shrinks the window", () => {
        const original = Element.prototype.getBoundingClientRect;
        const height = Object.getOwnPropertyDescriptor(window, "innerHeight");
        let field = {top: 531, bottom: 569};

        const shrinkTo = (innerHeight: number) => {
            Object.defineProperty(window, "innerHeight", {
                configurable: true,
                value: innerHeight
            });
            fireEvent(window, new Event("resize"));
        };

        beforeEach(() => {
            Object.defineProperty(document.documentElement, "clientWidth", {
                configurable: true,
                value: 390
            });
            Object.defineProperty(window, "innerHeight", {
                configurable: true,
                value: 844
            });
            Element.prototype.getBoundingClientRect = function(this: Element) {
                // the field
                if (this.tagName === "DIV" && !this.getAttribute("role")) {
                    return {
                        left: 20,
                        right: 370,
                        top: field.top,
                        bottom: field.bottom,
                        width: 350,
                        height: field.bottom - field.top,
                        x: 20,
                        y: field.top
                    } as DOMRect;
                }
                return original.call(this);
            };
        });

        afterEach(() => {
            Element.prototype.getBoundingClientRect = original;
            delete (document.documentElement as any).clientWidth;
            if (height) Object.defineProperty(window, "innerHeight", height);
            field = {top: 531, bottom: 569};
        });

        const open = () => {
            const view = render(
                <Select showSearch placeholder="Choose an asset">
                    <Select.Option value="BTS">BTS</Select.Option>
                </Select>
            );
            fireEvent.click(view.getByText("Choose an asset"));
            return view.getByRole("listbox") as HTMLElement;
        };

        it("stays under its field, where there was room when it opened", () => {
            const list = open();
            expect(list.style.top).toBe("573px");
            expect(list.style.bottom).toBe("");
            // the keyboard takes the lower half of the screen
            shrinkTo(494);
            expect(list.style.top).toBe("573px");
            expect(list.style.bottom).toBe("");
        });

        it("stays above its field, where there was none below when it opened", () => {
            field = {top: 700, bottom: 738};
            const list = open();
            expect(list.style.top).toBe("");
            expect(list.style.bottom).toBe("148px");
            // a smaller window does not turn it round, and it is placed against the new window
            shrinkTo(800);
            expect(list.style.top).toBe("");
            expect(list.style.bottom).toBe("104px");
        });

        it("decides its side afresh each time it opens", () => {
            const view = render(
                <Select showSearch placeholder="Choose an asset">
                    <Select.Option value="BTS">BTS</Select.Option>
                </Select>
            );
            field = {top: 700, bottom: 738};
            fireEvent.click(view.getByText("Choose an asset"));
            expect((view.getByRole("listbox") as HTMLElement).style.top).toBe(
                ""
            );
            fireEvent.keyDown(document, {key: "Escape"});
            expect(view.queryByRole("listbox")).toBeNull();
            // the page scrolled: the field is high on the screen now
            field = {top: 100, bottom: 138};
            fireEvent.click(view.getByText("Choose an asset"));
            expect((view.getByRole("listbox") as HTMLElement).style.top).toBe(
                "142px"
            );
        });
    });
});
