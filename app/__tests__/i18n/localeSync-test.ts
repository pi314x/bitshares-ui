// English is the source of the locale files (AGENTS.md): every key it has, every other locale
// has too, so that a screen added in English is not "missing translation" or English text in
// another language by accident. The MCP screens (the `mcp` block) are also checked for what a
// translation must not change: the named parameters, the literal percent signs, the backticks
// around commands and file names, and the technical words.
import {readdirSync, readFileSync} from "fs";
import {join} from "path";

const dir = join(__dirname, "../../assets/locales");
const files = readdirSync(dir).filter(name => /^locale-\w+\.json$/.test(name));
const read = (file: string) =>
    JSON.parse(readFileSync(join(dir, file), "utf8"));

const flat = (
    node: any,
    path: string[] = [],
    out: Record<string, string> = {}
) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
        Object.keys(node).forEach(key => flat(node[key], [...path, key], out));
    } else if (typeof node === "string") {
        out[path.join(".")] = node;
    }
    return out;
};

const english = flat(read("locale-en.json"));
const params = (text: string) => (text.match(/%\(\w+\)s/g) || []).sort();
const count = (text: string, part: string) => text.split(part).length - 1;

// words that stay as they are in every language (names of programs, settings and files)
const KEPT = [
    "MCP_ENABLED",
    "MCP_TRADING_ENABLED",
    "docs/MCP.md",
    "opencode",
    "Claude Code",
    "Claude Desktop",
    "Codex",
    "HTTP",
    "CORS",
    "stdio",
    "284C-5198",
    "~/.codex/config.toml",
    "/path/to/bitshares-ui",
    "BitShares Desk"
];

describe("every locale has every key English has", () => {
    files
        .filter(file => file !== "locale-en.json")
        .forEach(file => {
            it(file, () => {
                const have = flat(read(file));
                const missing = Object.keys(english).filter(
                    key => !(key in have)
                );
                expect(missing).toEqual([]);
            });
        });
});

describe("the MCP strings keep what a translation must not change", () => {
    files
        .filter(file => file !== "locale-en.json")
        .forEach(file => {
            it(file, () => {
                const have = flat(read(file));
                const problems: string[] = [];
                Object.keys(english)
                    .filter(key => key.indexOf("mcp.") === 0)
                    .forEach(key => {
                        const source = english[key];
                        const text = have[key] || "";
                        if (params(source).join() !== params(text).join()) {
                            problems.push(`${key}: parameters`);
                        }
                        if (count(source, "%%") !== count(text, "%%")) {
                            problems.push(`${key}: percent signs`);
                        }
                        if (count(source, "`") !== count(text, "`")) {
                            problems.push(`${key}: backticks`);
                        }
                        KEPT.forEach(word => {
                            if (
                                source.indexOf(word) !== -1 &&
                                text.indexOf(word) === -1
                            ) {
                                problems.push(`${key}: ${word}`);
                            }
                        });
                    });
                expect(problems).toEqual([]);
            });
        });

    it("a language other than English really has its own words (not English copied)", () => {
        const copied = (file: string) => {
            const have = flat(read(file));
            return Object.keys(english).filter(
                key =>
                    key.indexOf("mcp.") === 0 &&
                    english[key].length > 40 &&
                    have[key] === english[key]
            );
        };
        files
            .filter(file => file !== "locale-en.json")
            .forEach(file => expect(copied(file)).toEqual([]));
    });
});
