import * as fs from "fs";
import * as path from "path";
import {assetLogoName} from "../../lib/common/assetLogo";
import {ASSET_LOGO_NAMES} from "../../lib/common/assetLogoNames";

const folder = path.join(__dirname, "../../assets/asset-symbols");

describe("assetLogoName", () => {
    const known = new Set([
        "bts",
        "eth",
        "usd",
        "xbtsx.usdt",
        "xbtsx.btc",
        "btc"
    ]);

    it("takes the exact symbol, whatever its case", () => {
        expect(assetLogoName("BTS", known)).toBe("bts");
        expect(assetLogoName("XBTSX.USDT", known)).toBe("xbtsx.usdt");
        expect(assetLogoName("xbtsx.usdt", known)).toBe("xbtsx.usdt");
    });

    it("gives a bitAsset the coin's logo", () => {
        expect(assetLogoName("bitUSD", known)).toBe("usd");
    });

    it("gives a gateway-wrapped coin the coin's logo", () => {
        expect(assetLogoName("HONEST.ETH", known)).toBe("eth");
        expect(assetLogoName("BTWTY.BTC", known)).toBe("btc");
    });

    it("does not guess for anything else", () => {
        expect(assetLogoName("DEFI.BTSEUR", known)).toBeNull();
        expect(assetLogoName("TWENTIX.BTSPOOL", known)).toBeNull();
        expect(assetLogoName("SOMETHING.ETH", known)).toBeNull(); // not a gateway
        expect(assetLogoName("NOLOGO", known)).toBeNull();
        expect(assetLogoName("", known)).toBeNull();
        expect(assetLogoName(null, known)).toBeNull();
    });

    it("knows the logos taken over from the extension", () => {
        expect(assetLogoName("XBTSX.ETH")).toBe("xbtsx.eth");
        expect(assetLogoName("XBTSX.USDC")).toBe("xbtsx.usdc");
        expect(assetLogoName("IOB.XRP")).toBe("iob.xrp");
        expect(assetLogoName("HONEST.ETH")).toBe("eth");
    });
});

describe("the shipped logos", () => {
    it("are the files in app/assets/asset-symbols (regenerate assetLogoNames.ts when they change)", () => {
        const files = fs
            .readdirSync(folder)
            .filter(f => f.endsWith(".png") && f !== "unknown.png")
            .map(f => f.slice(0, -4))
            .sort();
        expect([...ASSET_LOGO_NAMES].sort()).toEqual(files);
    });

    it("are all part of the build (symbols.js requires every file)", () => {
        const source = fs.readFileSync(path.join(folder, "symbols.js"), "utf8");
        const missing = ASSET_LOGO_NAMES.filter(
            name => source.indexOf(`./${name}.png"`) === -1
        );
        expect(missing).toEqual([]);
    });

    it("are lowercase names (the app asks for the lowercase symbol)", () => {
        expect(ASSET_LOGO_NAMES.filter(n => n !== n.toLowerCase())).toEqual([]);
    });
});
