// `_palette.scss` is the single source of colour values (theme.scss and the
// legacy theme sheets read it); `tokens.ts` is the typed mirror for TS code.
// They are two files because TypeScript cannot generate SCSS, so this test is
// what keeps them from drifting apart.
import * as fs from "fs";
import * as path from "path";
import {themes, ThemeTokens} from "../../design-system/tokens";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chartColors = require("../../assets/colors");

const palette = fs.readFileSync(
    path.join(__dirname, "../../design-system/_palette.scss"),
    "utf8"
);

function scssValue(name: string): string {
    const match = palette.match(
        new RegExp(`^\\$${name}:\\s*(#[0-9a-fA-F]{6});`, "m")
    );
    if (!match) throw new Error(`$${name} is missing from _palette.scss`);
    return match[1].toUpperCase();
}

// camelCase token name -> kebab-case palette suffix
const kebab = (key: string) =>
    key.replace(/[A-Z0-9]/g, c => "-" + c.toLowerCase());

describe("colour palette", () => {
    (["dark", "light"] as const).forEach(theme => {
        it(`tokens.ts matches _palette.scss for the ${theme} theme`, () => {
            (Object.keys(themes[theme]) as Array<keyof ThemeTokens>).forEach(
                key => {
                    expect([
                        key,
                        scssValue(`palette-${theme}-${kebab(key)}`)
                    ]).toEqual([key, themes[theme][key].toUpperCase()]);
                }
            );
        });
    });

    it("keeps text on the accent colour readable in both themes", () => {
        // WCAG relative luminance contrast, the same maths a reviewer would use.
        const lum = (hex: string) => {
            const [r, g, b] = [1, 3, 5]
                .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
                .map(c =>
                    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
                );
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const contrast = (a: string, b: string) => {
            const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };
        expect(
            contrast(themes.dark.accent, themes.dark.onAccent)
        ).toBeGreaterThan(4.5);
        expect(
            contrast(themes.light.accent, themes.light.onAccent)
        ).toBeGreaterThan(4.5);
        // body text, secondary text and the up/down colours on the surfaces they sit on
        (["dark", "light"] as const).forEach(theme => {
            const t = themes[theme];
            expect(contrast(t.ink, t.surface)).toBeGreaterThan(7);
            expect(contrast(t.ink2, t.surface)).toBeGreaterThan(4.5);
            expect(contrast(t.muted, t.surface)).toBeGreaterThan(4.5);
            expect(contrast(t.up, t.surface)).toBeGreaterThan(4.5);
            expect(contrast(t.down, t.surface)).toBeGreaterThan(4.5);
            expect(contrast(t.warn, t.surface)).toBeGreaterThan(4.5);
        });
    });

    it("colours the depth/price charts from the same palette", () => {
        expect(chartColors.darkTheme.bgColor.toUpperCase()).toBe(
            themes.dark.surface
        );
        expect(chartColors.darkTheme.bidColor.toUpperCase()).toBe(
            themes.dark.up
        );
        expect(chartColors.darkTheme.askColor.toUpperCase()).toBe(
            themes.dark.down
        );
        expect(chartColors.lightTheme.bgColor.toUpperCase()).toBe(
            themes.light.surface
        );
        expect(chartColors.lightTheme.bidColor.toUpperCase()).toBe(
            themes.light.up
        );
        expect(chartColors.lightTheme.askColor.toUpperCase()).toBe(
            themes.light.down
        );
    });
});
