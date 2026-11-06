import * as React from "react";
import {render} from "@testing-library/react";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";

describe("design-system/Row", () => {
    it("renders its children as a flex container", () => {
        const {container} = render(
            <Row>
                <Col span={12}>a</Col>
                <Col span={12}>b</Col>
            </Row>
        );
        const row = container.firstChild as HTMLElement;
        expect(row.style.display).toBe("flex");
    });

    it("applies negative margin and distributes gutter padding onto its children", () => {
        const {container} = render(
            <Row gutter={16}>
                <Col span={12}>a</Col>
                <Col span={12}>b</Col>
            </Row>
        );
        const row = container.firstChild as HTMLElement;
        expect(row.style.marginLeft).toBe("-8px");
        expect(row.style.marginRight).toBe("-8px");

        const [first, second] = Array.from(row.children) as HTMLElement[];
        expect(first.style.paddingLeft).toBe("8px");
        expect(first.style.paddingRight).toBe("8px");
        expect(second.style.paddingLeft).toBe("8px");
    });

    it("forwards a ref to the rendered element", () => {
        const ref = React.createRef<HTMLDivElement>();
        render(<Row ref={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("passes through className and event handlers", () => {
        const onClick = jest.fn();
        const {container} = render(
            <Row className="custom-row" onClick={onClick}>
                content
            </Row>
        );
        const row = container.firstChild as HTMLElement;
        expect(row.className).toBe("custom-row");
        row.click();
        expect(onClick).toHaveBeenCalled();
    });
});
