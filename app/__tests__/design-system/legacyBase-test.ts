// The trimmed legacy stylesheet carries antd's form reset
// (`button, input, optgroup, select, textarea { font-family/-size/line-height/
// color: inherit }`) once per theme. Written as `body.darkTheme button` it has
// specificity (0,1,2) and beat every single-class rule of the design system:
// buttons ignored their own font size and text colour (accent buttons got the
// page's ink colour instead of --on-accent, white-ish text on cyan in the dark
// theme) and the left rail's links were all link-blue with no visible active
// item. Wrapped in :where() it has specificity 0 and still beats the browser
// default, but never a component class. This pins that.
import * as fs from "fs";
import * as path from "path";

const css = fs.readFileSync(
    path.join(__dirname, "../../assets/stylesheets/vendors/legacy-base.css"),
    "utf8"
);

describe("legacy-base.css form reset", () => {
    ["darkTheme", "lightTheme", "midnightTheme"].forEach(theme => {
        it(`is zero-specificity for ${theme}`, () => {
            const reset = `:where(body.${theme} button,body.${theme} input,body.${theme} optgroup,body.${theme} select,body.${theme} textarea){margin:0;font-family:inherit;font-size:inherit;line-height:inherit;color:inherit}`;
            expect(css).toContain(reset);
            // and no copy of it left at normal specificity
            expect(css).not.toMatch(
                new RegExp(
                    `(^|[};])body\\.${theme} button,body\\.${theme} input,body\\.${theme} optgroup`
                )
            );
        });
    });
});
