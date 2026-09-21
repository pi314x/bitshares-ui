// jdenticon.updateById() draws into a real 2D canvas context, which jsdom
// (the Jest test environment) doesn't implement without the native `canvas`
// package. Mock it out — this test is about Identicon's own render output
// (the <canvas> element and its sizing), not jdenticon's drawing.
jest.mock("jdenticon", () => ({updateById: jest.fn()}));

import * as React from "react";
import {render} from "@testing-library/react";

const Identicon = require("../../../components/Account/Identicon.jsx")
    .default;

describe("<Identicon>", function() {
    it("renders a canvas sized to 2x the given width/height", function() {
        const {container} = render(
            <Identicon account="init0" size={{height: 30, width: 40}} />
        );
        const canvas = container.querySelector("canvas");
        expect(canvas).not.toBeNull();
        expect(canvas.getAttribute("width")).toBe("80");
        expect(canvas.getAttribute("height")).toBe("60");
    });

});
