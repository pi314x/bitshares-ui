import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {PageHead} from "../design-system/PageHead";
import {toPairs} from "lodash-es";
import HelpContent, {getHelpTitles} from "./Utility/HelpContent";
import {Input} from "../design-system/Input";
import {useMediaQuery} from "../next/hooks/useMediaQuery";
import {filterHelp, structuredHelp} from "./Help/helpStructure";
import styles from "./Help.module.scss";

interface HelpProps {
    match: {params: Record<string, any>};
}

const t = (key: string) => counterpart.translate(`help_page.${key}`);

// The help, laid out like the rest of the app: a page title, then the table of
// contents (grouped like the menu) next to the page that is open. On a phone
// the contents fold away above the page. Pages are the markdown files under
// app/help/<locale>/ (HelpContent); the grouping and titles are in
// Help/helpStructure.ts and each locale's toc.md.
export default function Help({match}: HelpProps) {
    const path =
        toPairs(match.params)
            .map((p: any) => p[1])
            .join("/") || "index";
    const locale = counterpart.getLocale() || "en";
    const titles = React.useMemo(() => getHelpTitles(locale), [locale]);
    const groups = React.useMemo(() => structuredHelp(titles), [titles]);
    const [query, setQuery] = React.useState("");
    const shown = filterHelp(groups, query);
    const phone = useMediaQuery("(max-width: 860px)");
    const [open, setOpen] = React.useState(false);

    // the reading order, for Previous / Next
    const order = groups.reduce(
        (all: string[], group) => all.concat(group.entries.map(e => e.path)),
        ["index"]
    );
    const at = order.indexOf(path);
    const previous = at > 0 ? order[at - 1] : null;
    const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
    const titleOf = (p: string) => (p === "index" ? t("title") : titles[p]);
    const current = titleOf(path) || t("title");

    const link = (p: string, label: string) => (
        <Link
            to={p === "index" ? "/help" : `/help/${p}`}
            className={`${styles.entry} ${p === path ? styles.active : ""}`}
            aria-current={p === path ? "page" : undefined}
            onClick={() => setOpen(false)}
        >
            {label}
        </Link>
    );

    const contents = (
        <nav className={styles.toc} aria-label={t("contents")}>
            <Input
                value={query}
                placeholder={t("search")}
                onChange={(e: any) => setQuery(e.target.value)}
                className={styles.search}
            />
            {!query ? (
                <ul className={styles.list}>
                    <li>{link("index", t("title"))}</li>
                </ul>
            ) : null}
            {shown.length === 0 ? (
                <p className={styles.none}>{t("no_match")}</p>
            ) : null}
            {shown.map(group => (
                <section key={group.key} className={styles.group}>
                    <h2 className={styles.groupTitle}>
                        {counterpart.translate(`help_page.groups.${group.key}`)}
                    </h2>
                    <ul className={styles.list}>
                        {group.entries.map(entry => (
                            <li key={entry.path}>
                                {link(entry.path, entry.title)}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </nav>
    );

    return (
        <div className={styles.page}>
            <PageHead flush title={t("title")} />
            <div className={styles.layout}>
                {phone ? (
                    <details
                        className={styles.fold}
                        open={open}
                        onToggle={e =>
                            setOpen(
                                (e.currentTarget as HTMLDetailsElement).open
                            )
                        }
                    >
                        <summary className={styles.summary}>
                            <span className={styles.summaryLabel}>
                                {t("contents")}
                            </span>
                            <span className={styles.summaryCurrent}>
                                {current}
                            </span>
                        </summary>
                        {contents}
                    </details>
                ) : (
                    <aside className={styles.side}>{contents}</aside>
                )}

                <article className={styles.article}>
                    <HelpContent path={path} />
                    <div className={styles.pager}>
                        {previous ? (
                            <Link
                                className={styles.pagerLink}
                                to={
                                    previous === "index"
                                        ? "/help"
                                        : `/help/${previous}`
                                }
                            >
                                <span className={styles.pagerLabel}>
                                    {t("previous")}
                                </span>
                                {titleOf(previous)}
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next ? (
                            <Link
                                className={`${styles.pagerLink} ${styles.pagerNext}`}
                                to={`/help/${next}`}
                            >
                                <span className={styles.pagerLabel}>
                                    {t("next")}
                                </span>
                                {titleOf(next)}
                            </Link>
                        ) : null}
                    </div>
                </article>
            </div>
        </div>
    );
}
