import {explorerTabFor} from "../../components/Explorer/explorerTabs";

describe("explorerTabFor", () => {
    it("shows the blockchain at plain /explorer when nothing was chosen before", () => {
        expect(explorerTabFor("/explorer", null)).toBe("/explorer/blocks");
        expect(explorerTabFor("/explorer/", null)).toBe("/explorer/blocks");
    });

    it("shows the tab that was used last at plain /explorer", () => {
        expect(explorerTabFor("/explorer", "/explorer/assets")).toBe(
            "/explorer/assets"
        );
    });

    it("keeps the tab the address names, whatever was remembered", () => {
        expect(explorerTabFor("/explorer/witnesses", "/explorer/assets")).toBe(
            "/explorer/witnesses"
        );
    });

    it("falls back to the blockchain for an address that is not a tab", () => {
        expect(explorerTabFor("/explorer/nonsense", null)).toBe(
            "/explorer/blocks"
        );
    });
});
