// The top bar decides from the balance chip's WIDTH whether it has room. While the amount is loading the chip said
// only "…", so it always had room: on a phone it stood in the bar (with its eye) for as long as the chain took to
// load and went when the amount arrived and did not fit. A loading chip reserves the width of an amount, so the
// answer is the same before and after (jsdom has no layout: what can be pinned is the rule and the attribute it hangs on).
import {readFileSync} from "fs";
import {join} from "path";

const root = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("the balance chip while it loads", () => {
    const style = read("app/next/BalanceChip.module.scss");
    const chip = read("app/next/BalanceChip.tsx");

    it("reserves the width of an amount for the loading amount", () => {
        const rule = style.match(
            /\.chip\[data-balance="loading"\]\s+\.amount\s*\{([^}]*)\}/
        );
        expect(rule).not.toBeNull();
        const body = (rule as RegExpMatchArray)[1];
        const width = body.match(/min-width:\s*(\d+)ch/);
        expect(width).not.toBeNull();
        // "172,098.52263 BTS" is about 16ch; much less would let the chip in on a phone again
        expect(Number((width as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(
            14
        );
        // a width only holds on a box that has one
        expect(body).toMatch(/display:\s*inline-block/);
    });

    it("marks the loading chip with the attribute the rule hangs on", () => {
        expect(chip).toMatch(
            /data-balance=\{loading \? "loading" : hidden \? "hidden" : "shown"\}/
        );
    });
});
