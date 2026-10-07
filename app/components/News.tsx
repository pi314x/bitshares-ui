// TypeScript/functional-component port of the legacy News.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: purely fetches and displays a
// list of public Hive blog posts.
//
// `@hiveio/hive-js` ships no type declarations - added to `app/types
// /vendor-shims.d.ts` (the established pattern for such packages) rather
// than casting at each call site.
//
// `componentDidMount` (attaches a `resize` listener, fetches discussions)
// + `componentWillUnmount` (removes the listener) become one mount-only
// `useEffect` whose cleanup function removes the listener - the standard
// hooks idiom for this exact class pattern. No unmount guard is added
// around the `api.getDiscussionsByTrending` callback's `setState` calls -
// the original has none either (a `setState`-after-unmount would already
// just warn, not crash, in the original), so none is added here.
//
// Preserved verbatim: `smartTitle`'s truncation does `Math.floor(width -
// 450) / 6`, not `Math.floor((width - 450) / 6)` - the division happens
// *after* flooring, which can hand `.slice()` a non-integer end index
// (silently truncated by `.slice()` itself). Not "fixed" here.
import * as React from "react";
import counterpart from "counterpart";
import {api} from "@hiveio/hive-js";
import Translate from "react-translate-component";
import LoadingIndicator from "./LoadingIndicator";
import utils from "common/utils";
import {getHiveNewsTag} from "../branding";

const query = {tag: (getHiveNewsTag as any)(), limit: 20};

const alignRight = {textAlign: "right" as const};
const alignLeft = {textAlign: "left" as const};
const rowHeight = {height: "2rem"};
const bodyCell = {padding: "0.5rem 1rem"};
const headerCell = {padding: "0.85rem 1rem"};

const leftCell = {...alignLeft, ...bodyCell};
const rightCell = {...alignRight, ...bodyCell};

const leftCellHeader = {...alignLeft, ...headerCell};
const rightCellHeader = {...alignRight, ...headerCell};

const secondCol = {...leftCell, width: "180px"};

const SomethingWentWrong = () => (
    <p>
        <Translate content="news.errors.fetch" />
    </p>
);

const ReusableLink = ({
    data,
    url,
    isLink = false
}: {
    data: any;
    url: string;
    isLink?: boolean;
}) => (
    <a
        href={`https://steemit.com${url}`}
        rel="noreferrer noopener"
        target="_blank"
        style={{display: "block"}}
        className={!isLink ? "primary-text" : "external-link"}
    >
        {(utils as any).sanitize(data)}
    </a>
);

const NewsTable = ({data, width}: {data: any[]; width: number}) => {
    return (
        <table
            className="table table-hover dashboard-table"
            style={{fontSize: "0.85rem"}}
        >
            <thead>
                <tr>
                    <th style={rightCellHeader}>
                        <Translate
                            component="span"
                            content="account.votes.line"
                        />
                    </th>
                    <th style={leftCellHeader}>
                        <Translate
                            component="span"
                            content="explorer.block.date"
                        />
                    </th>
                    <th style={leftCellHeader}>
                        <Translate component="span" content="news.subject" />
                    </th>
                    <th style={leftCellHeader}>
                        <Translate component="span" content="news.author" />
                    </th>
                </tr>
            </thead>
            <tbody>
                {data.map((singleNews, iter) => {
                    const theAuthor = singleNews.parentAuthor
                        ? singleNews.parentAuthor
                        : singleNews.author;
                    const formattedDate = counterpart.localize(
                        new Date(singleNews.created)
                    );
                    const smartTitle =
                        singleNews.title.length * 6 > width - 450
                            ? `${singleNews.title.slice(
                                  0,
                                  Math.floor(width - 450) / 6
                              )}...`
                            : singleNews.title;
                    return (
                        <tr key={`${singleNews.title.slice(0, 10)}${iter}`}>
                            <td style={rightCell}>
                                <ReusableLink
                                    data={iter + 1}
                                    url={singleNews.url}
                                />
                            </td>
                            <td style={secondCol}>
                                <ReusableLink
                                    data={formattedDate}
                                    url={singleNews.url}
                                />
                            </td>
                            <td style={leftCell}>
                                <ReusableLink
                                    data={smartTitle}
                                    url={singleNews.url}
                                    isLink
                                />
                            </td>
                            <td style={leftCell}>
                                <ReusableLink
                                    data={theAuthor}
                                    url={singleNews.url}
                                />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
            <thead>
                <tr style={rowHeight}>
                    <th style={rightCell} />
                    <th style={leftCell} />
                    <th style={leftCell} />
                    <th style={leftCell} />
                </tr>
            </thead>
        </table>
    );
};

interface NewsState {
    isLoading: boolean;
    isWrong: boolean;
    discussions: any[];
    width: number;
}

export default function News() {
    const [state, setState] = React.useState<NewsState>({
        isLoading: true,
        isWrong: false,
        discussions: [],
        width: 1200
    });
    const mergeState = (patch: Partial<NewsState>) =>
        setState(prev => ({...prev, ...patch}));

    React.useEffect(() => {
        const updateDimensions = () => {
            mergeState({width: window.innerWidth});
        };

        const orderDiscussions = (discussions: any[]) => {
            const orderedDiscussions = discussions.sort(
                (a, b) =>
                    (new Date(b.created) as any) - (new Date(a.created) as any)
            );
            mergeState({discussions: orderedDiscussions, isLoading: false});
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        if (!query.tag) {
            setTimeout(() => {
                mergeState({isLoading: false, isWrong: false});
            }, 100);
        } else {
            api.getDiscussionsByTrending(query, (err: any, result: any) => {
                if (err) {
                    mergeState({isLoading: false, isWrong: true});
                    return;
                }
                orderDiscussions(result);
            });
        }

        return () => {
            window.removeEventListener("resize", updateDimensions);
        };
    }, []);

    const {isLoading, isWrong, discussions, width} = state;

    return (
        <div className="grid-block page-layout">
            <div className="grid-block vertical">
                <div className="account-tabs">
                    <div className="tab-content">
                        <div className="grid-block vertical">
                            {isWrong && <SomethingWentWrong />}
                            {isLoading ? <LoadingIndicator /> : null}
                            {!isWrong && !isLoading && (
                                <NewsTable width={width} data={discussions} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
