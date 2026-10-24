import * as React from "react";
import {render} from "@testing-library/react";
import {Steps} from "../../design-system/Steps";

describe("design-system/Steps", () => {
    it("renders a title per step", () => {
        const {getByText} = render(
            <Steps current={0}>
                <Steps.Step key="a" title="First" />
                <Steps.Step key="b" title="Second" />
                <Steps.Step key="c" title="Third" />
            </Steps>
        );
        expect(getByText("First")).toBeTruthy();
        expect(getByText("Second")).toBeTruthy();
        expect(getByText("Third")).toBeTruthy();
    });

    it("marks steps before current as finished and the rest as waiting", () => {
        const {container} = render(
            <Steps current={1}>
                <Steps.Step key="a" title="First" />
                <Steps.Step key="b" title="Second" />
                <Steps.Step key="c" title="Third" />
            </Steps>
        );
        // `[class*='step']` would also match the outer `.steps`
        // container (its class literally contains the substring
        // "step"), so select each step's direct children instead.
        const steps = container.querySelectorAll(
            "[class*='steps'] > [class*='step']"
        );
        expect(steps[0].className).toMatch(/finish/);
        expect(steps[1].className).toMatch(/process/);
        expect(steps[2].className).toMatch(/wait/);
    });

    it("renders a dot per step when progressDot is set, a number otherwise", () => {
        const {container: dotted} = render(
            <Steps current={0} progressDot>
                <Steps.Step key="a" title="First" />
            </Steps>
        );
        expect(dotted.querySelector("[class*='dot']")).toBeTruthy();

        const {container: numbered} = render(
            <Steps current={0}>
                <Steps.Step key="a" title="First" />
            </Steps>
        );
        expect(numbered.querySelector("[class*='number']")).toBeTruthy();
        expect(numbered.querySelector("[class*='number']")?.textContent).toBe(
            "1"
        );
    });

    it("supports destructuring Step off Steps directly", () => {
        const {Step} = Steps;
        const {getByText} = render(
            <Steps current={0}>
                <Step key="only" title="Only" />
            </Steps>
        );
        expect(getByText("Only")).toBeTruthy();
    });
});
