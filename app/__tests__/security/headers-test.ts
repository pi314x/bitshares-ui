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

describe("the container image", () => {
    const dockerfile = read("Dockerfile");
    const csp = read("conf/headers.csp.conf");
    const common = read("conf/headers.common.conf");
    const plain = read("conf/nginx.container.conf");
    const tls = read("conf/nginx.container.tls.conf");

    it("sends the page's own policy as a header, with frame-ancestors", () => {
        const match = csp.match(
            /add_header Content-Security-Policy "([^"]*)" always;/
        );
        if (!match) throw new Error("no policy in conf/headers.csp.conf");
        const header = directives(match[1]);
        const meta = directives(metaPolicy());
        Object.keys(meta).forEach(name =>
            expect(header[name]).toEqual(meta[name])
        );
        expect(Object.keys(header).filter(name => !(name in meta))).toEqual([
            "frame-ancestors"
        ]);
        expect(header["frame-ancestors"]).toEqual(["'none'"]);
    });

    it("has the headers of the HTTPS example in the shared snippet", () => {
        [
            "Strict-Transport-Security",
            "X-Content-Type-Options",
            "Referrer-Policy",
            "X-Frame-Options",
            "Permissions-Policy",
            "Cross-Origin-Opener-Policy"
        ].forEach(header => expect(common).toContain(header));
    });

    it("puts both snippets where nginx would otherwise drop them: every location that adds a header", () => {
        [plain, tls].forEach(config => {
            // (a quoted value, such as a regex with braces, is not part of the structure)
            const code = config
                .split("\n")
                .filter(line => !line.trim().startsWith("#"))
                .join("\n")
                .replace(/"[^"]*"/g, '""');
            // the page carries the policy and the common headers beside its cache header
            const page = code.match(/location = \/index\.html \{[^}]*\}/);
            expect(page && page[0]).toContain("headers.csp.conf");
            expect(page && page[0]).toContain("headers.common.conf");
            // every location with an add_header of its own includes the common ones again
            const blocks = code.match(/location [^{]*\{[^}]*\}/g) || [];
            blocks
                .filter(block => block.includes("add_header"))
                .forEach(block =>
                    expect(block).toContain("headers.common.conf")
                );
        });
    });

    it("quotes a location pattern with braces (nginx reads a bare { as the start of a block and refuses the file)", () => {
        [plain, tls, read("conf/nginx.https.conf.example")].forEach(config =>
            config
                .split("\n")
                .filter(line => /^\s*location\s+~/.test(line))
                .forEach(line => {
                    const pattern = line.replace(/^\s*location\s+~\*?\s+/, "");
                    if (
                        /[{}]/.test(pattern.replace(/\s*\{\s*(return.*)?$/, ""))
                    ) {
                        expect(pattern.startsWith('"')).toBe(true);
                    }
                })
        );
    });

    it("runs unprivileged, with a health check, and writes only to /tmp", () => {
        expect(dockerfile).toContain("nginx-unprivileged");
        expect(dockerfile).toMatch(/HEALTHCHECK/);
        expect(dockerfile).toMatch(/EXPOSE 8080/);
        [plain, tls].forEach(config => {
            expect(config).toContain("pid /tmp/nginx.pid;");
            expect(config).toContain("location = /healthz");
            expect(config).not.toMatch(/listen\s+(80|443)\b/);
        });
        expect(tls).toMatch(/listen 8443 ssl;/);
        expect(tls).toMatch(/return 301 https:\/\/\$host\$request_uri;/);
        expect(tls).toMatch(/ssl_protocols\s+TLSv1\.2 TLSv1\.3;/);
        expect(plain).not.toMatch(/ssl_certificate/);
    });

    it("builds from the lockfile in a stage of its own and ships none of the build tools", () => {
        expect(dockerfile).toMatch(/FROM node:\d+[^\n]* AS build/);
        expect(dockerfile).not.toMatch(/FROM node:6/);
        expect(dockerfile).toContain("yarn install --frozen-lockfile");
        expect(dockerfile).toMatch(
            /COPY --from=build \/app\/build\/dist\/ \/usr\/share\/nginx\/html\//
        );
        // the last stage is the server
        const last = dockerfile.split(/^FROM /m).pop() as string;
        expect(last.startsWith("nginxinc/nginx-unprivileged")).toBe(true);
        expect(last).not.toMatch(/node|yarn|npm/i);
    });

    it("keeps keys and local settings out of the build context", () => {
        const ignore = read(".dockerignore");
        [".git", "node_modules", "build", ".env*", "*.wif"].forEach(entry =>
            expect(ignore.split("\n")).toContain(entry)
        );
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
