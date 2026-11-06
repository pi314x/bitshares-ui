import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {Carousel} from "../../design-system/Carousel";

function visible(container: HTMLElement) {
    return Array.from(container.querySelectorAll("[aria-hidden=false]")).map(
        n => n.textContent
    );
}

describe("design-system/Carousel", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("shows only the first slide initially", () => {
        const {container} = render(
            <Carousel dots={false}>
                <div>one</div>
                <div>two</div>
            </Carousel>
        );
        expect(visible(container)).toEqual(["one"]);
    });

    it("advances every autoplaySpeed and wraps around when autoplay is on", () => {
        const {container} = render(
            <Carousel autoplay autoplaySpeed={1000} dots={false}>
                <div>one</div>
                <div>two</div>
            </Carousel>
        );
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(visible(container)).toEqual(["two"]);
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(visible(container)).toEqual(["one"]);
    });

    it("does not advance without autoplay, and pauses while hovered", () => {
        const {container} = render(
            <Carousel autoplaySpeed={1000}>
                <div>one</div>
                <div>two</div>
            </Carousel>
        );
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(visible(container)).toEqual(["one"]);

        const {container: c2} = render(
            <Carousel autoplay autoplaySpeed={1000}>
                <div>a</div>
                <div>b</div>
            </Carousel>
        );
        fireEvent.mouseEnter(c2.firstChild as Element);
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(visible(c2)).toEqual(["a"]);
    });

    it("renders dots by default and selects a slide when one is clicked", () => {
        const {container, getByLabelText} = render(
            <Carousel>
                <div>one</div>
                <div>two</div>
            </Carousel>
        );
        fireEvent.click(getByLabelText("Slide 2"));
        expect(visible(container)).toEqual(["two"]);
    });

    it("renders no dots when dots is false", () => {
        const {queryByLabelText} = render(
            <Carousel dots={false}>
                <div>one</div>
                <div>two</div>
            </Carousel>
        );
        expect(queryByLabelText("Slide 1")).toBeNull();
    });
});
