// `tsc` resolves a `./Foo.js` import to `Foo.ts(x)` and Jest never loads most
// screens, so an import of a file that no longer exists (renamed, converted,
// deleted) can pass typecheck and tests and then break `webpack`, which is only
// run by hand or at release time. This walks every static import/require/
// dynamic import in app/ and fails when a relative or app-rooted specifier
// resolves to nothing on disk.
import * as fs from "fs";
import * as path from "path";

const appDir = path.join(__dirname, "..");
const nodeModules = path.join(__dirname, "../../node_modules");
const EXTENSIONS = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".coffee",
    ".scss",
    ".css",
    ".md"
];
// webpack `resolve.modules` / `resolve.alias` roots (see webpack.config.js, tsconfig paths)
const ROOTS = [appDir, path.join(appDir, "lib")];
// handled by aliases/loaders rather than the file system
const SPECIAL = [/^counterpart$/, /^worker-loader/, /^file-loader/, /^!!/];

function walk(dir: string, out: string[] = []): string[] {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            // app/test is the old, stale mocha folder
            if (["__tests__", "test", "node_modules", "assets"].includes(name))
                continue;
            walk(full, out);
        } else if (/\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name)) {
            out.push(full);
        }
    }
    return out;
}

function exists(base: string): boolean {
    for (const ext of EXTENSIONS) {
        const file = base + ext;
        if (fs.existsSync(file) && fs.statSync(file).isFile()) return true;
    }
    return ["index.ts", "index.tsx", "index.js", "index.jsx"].some(index =>
        fs.existsSync(path.join(base, index))
    );
}

function stripComments(source: string): string {
    return source
        .split("\n")
        .filter(line => !/^\s*(\/\/|\*(?!\/))/.test(line))
        .join("\n");
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(?:\/\*.*?\*\/\s*)?["']([^"'\s,]+)["']/gm;

function resolves(from: string, specifier: string): boolean {
    const clean = specifier.replace(/\?.*$/, "");
    if (SPECIAL.some(pattern => pattern.test(specifier))) return true;
    if (clean.startsWith("."))
        return exists(path.resolve(path.dirname(from), clean));
    if (ROOTS.some(root => exists(path.join(root, clean)))) return true;
    const segments = clean.split("/");
    const pkg = clean.startsWith("@")
        ? segments.slice(0, 2).join("/")
        : segments[0];
    return fs.existsSync(path.join(nodeModules, pkg));
}

describe("imports", () => {
    it("every import in app/ resolves to a file or a package", () => {
        const unresolved: string[] = [];
        walk(appDir).forEach(file => {
            const source = stripComments(fs.readFileSync(file, "utf8"));
            let match: RegExpExecArray | null;
            SPECIFIER.lastIndex = 0;
            while ((match = SPECIFIER.exec(source))) {
                if (!resolves(file, match[1])) {
                    unresolved.push(
                        `${path.relative(appDir, file)} -> ${match[1]}`
                    );
                }
            }
        });
        expect(unresolved).toEqual([]);
    });

    it("the check itself catches the failure it exists for", () => {
        // A file that was converted from Foo.js to Foo.tsx but is still imported as "./Foo.js".
        const dir = path.join(appDir, "components/DepositWithdraw");
        expect(
            resolves(path.join(dir, "x.tsx"), "./DepositWithdrawAssetSelector")
        ).toBe(true);
        expect(
            resolves(
                path.join(dir, "x.tsx"),
                "./DepositWithdrawAssetSelector.js"
            )
        ).toBe(false);
    });
});
