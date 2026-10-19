import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import AssetLogo from "../../components/Utility/AssetLogo";

describe("AssetLogo", () => {
    it("shows the logo file of an asset that has one", () => {
        const {container} = render(<AssetLogo symbol="XBTSX.USDT" />);
        const img = container.querySelector("img") as HTMLImageElement;
        expect(img).not.toBeNull();
        expect(img.getAttribute("src")).toMatch(
            /asset-symbols\/xbtsx\.usdt\.png$/
        );
        expect(img.getAttribute("alt")).toBe("");
    });

    it("gives a gateway-wrapped coin the coin's logo", () => {
        const {container} = render(<AssetLogo symbol="HONEST.ETH" size={24} />);
        const img = container.querySelector("img") as HTMLImageElement;
        expect(img.getAttribute("src")).toMatch(/asset-symbols\/eth\.png$/);
        expect(img.style.width).toBe("24px");
    });

    it("draws the coin's first letter for an asset without a logo", () => {
        const {container} = render(<AssetLogo symbol="DEFI.BTSEUR" />);
        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toBe("D"); // a token of its own
        const gateway = render(<AssetLogo symbol="HONEST.XAU" />);
        expect(gateway.container.textContent).toBe("X"); // the coin's
    });

    it("falls back to the letter when the file fails to load", () => {
        const {container} = render(<AssetLogo symbol="BTS" />);
        const img = container.querySelector("img") as HTMLImageElement;
        fireEvent.error(img);
        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toBe("B");
    });

    it("copes with no symbol", () => {
        const {container} = render(<AssetLogo symbol={undefined} />);
        expect(container.textContent).toBe("?");
    });
});
