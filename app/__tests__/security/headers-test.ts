// What the page is served with. The policy in the page's own <meta> tag, the one the
// nginx example sends as a header, and the pieces of the page that must not come from
// anywhere else are kept in step here.
import {readFileSync} from "fs";
import {join} from "path";

const root = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const metaPolicy = (): string => {
    const match = read("app/assets/index.hbs").match(
        /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
    );
    if (!match) throw new Error("the page has no content security policy");
    return match[1];
};

const directives = (policy: string): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    policy
        .split(";")
        .map(part => part.trim())
        .filter(Boolean)
        .forEach(part => {
            const [name, ...values] = part.split(/\s+/);
            out[name] = values;
        });
    return out;
};

describe("the page's content security policy", () => {
    const policy = directives(metaPolicy());

    it("takes scripts from the app's own origin only", () => {
        expect(policy["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
        expect(policy["script-src"]).not.toContain("'unsafe-eval'");
        expect(metaPolicy()).not.toMatch(/cdnjs|alicdn|unpkg|jsdelivr/);
    });

    it("lets the page talk to secure hosts and the local node, nothing in clear text, not everything", () => {
        const connect = policy["connect-src"];
        expect(connect).not.toContain("*");
        expect(connect).not.toContain("http:");
        expect(connect).not.toContain("ws:");
        expect(connect).toEqual(
            expect.arrayContaining(["'self'", "wss:", "https:"])
        );
    });

    it("shuts the doors a script would use to get out or in", () => {
        expect(policy["object-src"]).toEqual(["'none'"]);
        expect(policy["base-uri"]).toEqual(["'self'"]);
        expect(policy["form-action"]).toEqual(["'self'"]);
    });
});

describe("the nginx examples", () => {
    const https = read("conf/nginx.https.conf.example");
    const plain = read("conf/nginx.conf");

    const headerPolicy = (): Record<string, string[]> => {
        const match = https.match(
            /add_header Content-Security-Policy "([^"]*)" always;/
        );
        if (!match) throw new Error("no policy in the HTTPS example");
        return directives(match[1]);
    };

    it("send the page's policy as a header, and add that a page cannot be framed", () => {
        const header = headerPolicy();
        const meta = directives(metaPolicy());
        Object.keys(meta).forEach(name =>
            expect(header[name]).toEqual(meta[name])
        );
        expect(header["frame-ancestors"]).toEqual(["'none'"]);
        // nothing in the header that the page's own policy does not have, but that
        expect(Object.keys(header).filter(name => !(name in meta))).toEqual([
            "frame-ancestors"
        ]);
    });

    it("the HTTPS example redirects http, sends HSTS, and hides what it should", () => {
        expect(https).toMatch(/return 301 https:\/\/\$host\$request_uri;/);
        expect(https).toMatch(
            /Strict-Transport-Security "max-age=31536000; includeSubDomains"/
        );
        [
            "X-Content-Type-Options",
            "Referrer-Policy",
            "X-Frame-Options",
            "Permissions-Policy"
        ].forEach(header => expect(https).toContain(header));
        expect(https).toMatch(/ssl_protocols\s+TLSv1\.2 TLSv1\.3;/);
        expect(https).toMatch(/location ~ \\\.map\$ \{ return 404; \}/);
        expect(https).toContain("server_tokens   off;");
    });

    it("the plain config has the headers that do not need HTTPS, and no HSTS", () => {
        [
            "X-Content-Type-Options",
            "Referrer-Policy",
            "X-Frame-Options",
            "Permissions-Policy"
        ].forEach(header => expect(plain).toContain(header));
        expect(plain).not.toContain("Strict-Transport-Security");
    });

    it("are well formed: braces match and every directive ends", () => {
        [https, plain].forEach(text => {
            const code = text
                .split("\n")
                .filter(line => !line.trim().startsWith("#"))
                .join("\n");
            expect((code.match(/\{/g) || []).length).toBe(
                (code.match(/\}/g) || []).length
            );
            code.split("\n").forEach(line => {
                const t = line.trim();
                if (!t || t === "}" || t.endsWith("{") || t.endsWith(";"))
                    return;
                // a list of values over several lines (gzip_types) and a closing brace line
                expect(/^[A-Za-z0-9/+._*-]+$/.test(t) || t.endsWith("}")).toBe(
                    true
                );
            });
        });
    });
});

describe("the password strength library", () => {
    it("is part of the app, not fetched from a CDN", () => {
        const pkg = JSON.parse(read("package.json"));
        expect(pkg.dependencies.zxcvbn).toBeDefined();
        expect(pkg.dependencies["zxcvbn-async"]).toBeUndefined();
        expect(read("app/lib/common/passwordStrength.ts")).not.toMatch(
            /https?:\/\//
        );
    });
});
