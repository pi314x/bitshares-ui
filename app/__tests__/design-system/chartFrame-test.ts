// The TradingView chart fills its frame: a legacy rule (`#tv_chart { padding-right: 12px }`, made for the old page's scrollbar) left
// a 12px strip at the chart's right edge on every screen width, so no style sheet may pad `#tv_chart` again.
import * as fs from "fs";
import * as path from "path";

const sheets = [
    "../../assets/stylesheets/layout/_page_layout.scss",
    "../../design-system/exchange-layout.scss"
];

describe("the chart's frame", () => {
    it("does not pad the TradingView container", () => {
        const withPadding = /tv_chart[^{}]*\{[^{}]*padding/;
        sheets.forEach(sheet => {
            const source = fs.readFileSync(path.join(__dirname, sheet), "utf8");
            expect({sheet, padded: withPadding.test(source)}).toEqual({
                sheet,
                padded: false
            });
        });
    });

    it("still frames the chart with the shared bordered box", () => {
        const source = fs.readFileSync(path.join(__dirname, sheets[0]), "utf8");
        expect(source).toMatch(/\.exchange-bordered\s*\{[^}]*border:/);
        // the depth chart keeps its own padding
        expect(source).toMatch(/#depth_chart\s*\{[^}]*padding/);
    });
});
