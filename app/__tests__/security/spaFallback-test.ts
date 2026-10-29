// Every address of the app has to answer with index.html, also one with a dot in its last
// part: the market of a gateway asset is /market/IOB.XRP_BTS, and a server that takes
// that for a file answers "Cannot GET /market/IOB.XRP_BTS".
import {readFileSync} from "fs";
import {join} from "path";

const root = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// the middleware webpack-dev-server runs for `historyApiFallback`
// eslint-disable-next-line @typescript-eslint/no-var-requires
const history = require("connect-history-api-fallback");

const rewrite = (options: any, url: string): string => {
    const req: any = {
        method: "GET",
        url,
        headers: {accept: "text/html,application/xhtml+xml"}
    };
    history(options)(req, {}, () => undefined);
    return req.url;
};

const MARKETS = [
    "/market/IOB.XRP_BTS",
    "/market/XBTSX.USDT_BTS",
    "/market/BTS_USD",
    "/account/as-a-bell/permissions",
    "/asset/GDEX.BTC"
];

describe("the dev server's fallback to index.html", () => {
    it("is set to let a dot in the last part through", () => {
        expect(read("webpack.config.js")).toMatch(
            /historyApiFallback:\s*\{\s*disableDotRule:\s*true\s*\}/
        );
    });

    it("sends every address of the app to the page", () => {
        MARKETS.forEach(url =>
            expect(rewrite({disableDotRule: true}, url)).toBe("/index.html")
        );
    });

    it("would not, with the default rule (why the option is needed)", () => {
        expect(rewrite({}, "/market/IOB.XRP_BTS")).toBe("/market/IOB.XRP_BTS");
    });
});

describe("the nginx files", () => {
    [
        "conf/nginx.container.conf",
        "conf/nginx.https.conf.example",
        "conf/nginx.conf"
    ].forEach(file => {
        it(`${file} gives every address that is not a file the page`, () => {
            const text = read(file);
            // the catch-all location falls back to /index.html ...
            expect(text).toMatch(
                /location \/ \{[^}]*try_files \$uri \/index\.html;/
            );
            // ... and no location of a file extension catches /market/IOB.XRP_BTS
            // (an extension rule has to be anchored to a hashed or listed one)
            text.split("\n")
                .filter(line => /^\s*location ~/.test(line))
                .forEach(line => {
                    const pattern = (line.match(
                        /location ~\*? "?([^"{]*?)"? \{/
                    ) || [])[1];
                    if (!pattern) return;
                    expect(
                        new RegExp(pattern).test("/market/IOB.XRP_BTS")
                    ).toBe(false);
                });
        });
    });
});
