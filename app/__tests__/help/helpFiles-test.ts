// The help pages are plain markdown under `app/help/<locale>/`; `HelpContent`
// serves the page of the user's locale and falls back to English per page.
// These tests keep the translations honest: every UI locale has every page,
// and a translation keeps everything the page machinery or the reader relies
// on - section markers, {placeholders}, links, URLs and addresses - identical
// to the English source.
import * as fs from "fs";
import * as path from "path";

const HELP_DIR = path.join(__dirname, "../../help");
const LOCALES_DIR = path.join(__dirname, "../../assets/locales");

// Legal text: a translation without legal review could change its meaning, so
// the English original is shown in every language (HelpContent falls back).
const ENGLISH_ONLY = ["disclaimer.md"];

function listMarkdown(dir: string, prefix = ""): string[] {
    return fs
        .readdirSync(path.join(dir, prefix), {withFileTypes: true})
        .reduce((files: string[], entry) => {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory())
                return files.concat(listMarkdown(dir, rel));
            return entry.name.endsWith(".md") ? files.concat(rel) : files;
        }, [])
        .sort();
}

function read(locale: string, file: string): string {
    return fs.readFileSync(path.join(HELP_DIR, locale, file), "utf8");
}

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort();

const sections = (text: string) =>
    uniqueSorted(
        (text.match(/\[#\s?.+?\s?\]/g) || []).map(s => s.replace(/\s/g, ""))
    );
const placeholders = (text: string) =>
    uniqueSorted(text.match(/\{[A-Za-z]+\}/g) || []);
const urls = (text: string) =>
    uniqueSorted(text.match(/https?:\/\/[^\s)\]>"]+/g) || []);
const identifiers = (text: string) =>
    uniqueSorted(text.match(/[A-Za-z0-9]{25,}/g) || []);
// `[label](target)`: the targets inside the app (help pages and routes).
const links = (text: string) =>
    uniqueSorted(
        (text.match(/\]\(([^)\s]+)\)/g) || [])
            .map(s => s.slice(2, -1))
            .filter(target => !/^https?:/.test(target))
    );
// Help-page links as `adjust_links` in HelpContent resolves them: relative to
// the help root, `.md` optional, `/help/` optional. Everything else that starts
// with a slash is an app route (`/borrow`, `/settings`, `/account/...`).
const helpTargets = (text: string) =>
    links(text)
        .filter(
            target => !target.startsWith("/") || target.startsWith("/help/")
        )
        .map(target => target.replace(/^\/help\//, "").replace(/\.md$/, ""));

const english = listMarkdown(path.join(HELP_DIR, "en"));
const known = english.map(file => file.replace(/\.md$/, ""));
const uiLocales = fs
    .readdirSync(LOCALES_DIR)
    .map(name => (name.match(/^locale-(.+)\.json$/) || [])[1])
    .filter(Boolean)
    .sort();
const translated = uiLocales.filter(locale => locale !== "en");

describe("help files", () => {
    it("has an English source for every UI locale", () => {
        expect(uiLocales).toContain("en");
        uiLocales.forEach(locale => {
            expect(fs.existsSync(path.join(HELP_DIR, locale))).toBe(true);
        });
    });

    it("has no help directory for a locale the UI does not offer", () => {
        const dirs = fs
            .readdirSync(HELP_DIR, {withFileTypes: true})
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();
        expect(dirs).toEqual(uiLocales);
    });

    it("links every English page that other pages point to", () => {
        english.forEach(file => {
            helpTargets(read("en", file)).forEach(target => {
                expect({file, target, exists: known.includes(target)}).toEqual({
                    file,
                    target,
                    exists: true
                });
            });
        });
    });

    it("has no leftover placeholder text", () => {
        uiLocales.forEach(locale => {
            listMarkdown(path.join(HELP_DIR, locale)).forEach(file => {
                expect({
                    locale,
                    file,
                    todo: /TODO/.test(read(locale, file))
                }).toEqual({
                    locale,
                    file,
                    todo: false
                });
            });
        });
    });

    translated.forEach(locale => {
        describe(locale, () => {
            const files = listMarkdown(path.join(HELP_DIR, locale));

            it("translates every English page", () => {
                const expected = english.filter(f => !ENGLISH_ONLY.includes(f));
                expect(expected.filter(file => !files.includes(file))).toEqual(
                    []
                );
            });

            it("has no page without an English source", () => {
                expect(files.filter(file => !english.includes(file))).toEqual(
                    []
                );
            });

            it("does not translate the English-only pages", () => {
                expect(files.filter(f => ENGLISH_ONLY.includes(f))).toEqual([]);
            });

            files
                .filter(file => english.includes(file))
                .forEach(file => {
                    it(`${file} keeps sections, placeholders and links`, () => {
                        const source = read("en", file);
                        const text = read(locale, file);
                        expect(text.trim().length).toBeGreaterThan(0);
                        expect(sections(text)).toEqual(sections(source));
                        expect(placeholders(text)).toEqual(
                            placeholders(source)
                        );
                        // Every link must land on a page that exists.
                        expect(
                            helpTargets(text).filter(
                                target => !known.includes(target)
                            )
                        ).toEqual([]);
                        // Gateway pages carry deposit addresses and memo
                        // formats that must be copied exactly.
                        if (file.startsWith("gateways/")) {
                            expect(urls(text)).toEqual(urls(source));
                            expect(identifiers(text)).toEqual(
                                identifiers(source)
                            );
                        }
                    });
                });
        });
    });
});
