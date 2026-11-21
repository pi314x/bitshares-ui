import * as React from "react";
import {render} from "@testing-library/react";
import {Col} from "../../design-system/Col";

describe("design-system/Col", () => {
    it("sizes itself as a fraction of 24 columns when span is given", () => {
        const {container} = render(<Col span={12}>content</Col>);
        const col = container.firstChild as HTMLElement;
        expect(col.style.flex).toBe("0 0 50%");
        expect(col.style.maxWidth).toBe("50%");
    });

    it("sizes to its content when span is omitted", () => {
        const {container} = render(<Col>content</Col>);
        const col = container.firstChild as HTMLElement;
        expect(col.style.flex).toBe("");
        expect(col.style.maxWidth).toBe("");
    });

    it("applies offset as a left margin fraction", () => {
        const {container} = render(
            <Col span={6} offset={4}>
                content
            </Col>
        );
        const col = container.firstChild as HTMLElement;
        expect(col.style.marginLeft).toBe(`${(4 / 24) * 100}%`);
    });

    it("forwards a ref and passes through className/style", () => {
        const ref = React.createRef<HTMLDivElement>();
        const {container} = render(
            <Col ref={ref} className="custom-col" style={{padding: "10px"}}>
                content
            </Col>
        );
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        const col = container.firstChild as HTMLElement;
        expect(col.className).toBe("custom-col");
        expect(col.style.padding).toBe("10px");
    });
});
