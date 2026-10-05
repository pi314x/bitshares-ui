// TypeScript/function-component port of the legacy NewsHeadline.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical translation, no logic
// changes except where noted. Not security-sensitive per AGENTS.md
// (grepped for `WalletDb`/`WalletApi`/`Actions\.`/`ApplicationApi\.` -
// only hit is `SettingsActions.hideNewsHeadline(...)`, which just
// persists a dismissed-news-item hash to local settings, nothing
// wallet/key related).
//
// Structural change (not a behavior change): the original's
// `connect(NewsHeadline, {listenTo: [SettingsStore], getProps() {return
// {hiddenNewsHeadline: SettingsStore.getState().hiddenNewsHeadline};}})`
// is replaced by an outer `NewsHeadline` wrapper calling `useAltStore
// (SettingsStore)` and passing the derived `hiddenNewsHeadline` into
// `NewsHeadlineCore`, following this migration's established `connect`
// -> `useAltStore` translation (e.g. `AccountPortfolioList.tsx`'s header
// comment). Prop precedence is preserved exactly: alt-react's `connect`
// renders `<Component {...this.props} {...this.getNextProps()} />`, i.e.
// store-derived props always win - the wrapper spreads `{...props}`
// first, `hiddenNewsHeadline={...}` after (moot in practice: the only
// call site, `App.jsx`'s `<NewsHeadline />`, passes no props at all).
//
// Dropped as confirmed dead:
// - `import {getNotifications, getGateways} from "../../lib/chain/
//   onChainConfig"`: `getGateways` is never referenced anywhere else in
//   this file, AND `onChainConfig.js` doesn't even export a function by
//   that name (grepped its `export {...}` list) - this was always an
//   `undefined` import, dropped entirely.
// - `getNewsFromGitHub` (a full method, fetching a news.json from
//   GitHub): its only reference anywhere in the file is a commented-out
//   call in `componentDidMount` (`//this.getNewsFromGitHub.call(this);`)
//   - never actually invoked - dropped along with that dead comment.
//
// Lifecycle translation:
// - `componentDidMount`'s (now the only) live call, `getNewsThroughAsset()`,
//   becomes a mount-only `useEffect`. That function reads
//   `this.props.hiddenNewsHeadline` only *after* its `await
//   getNotifications()` resolves, i.e. the CURRENT prop value at
//   resolution time, not whatever it was when the effect fired - this is
//   replicated with the established `stateRef` mirror pattern (a ref
//   kept in sync with `hiddenNewsHeadline` on every render) instead of a
//   plain closure, which would otherwise freeze the mount-time value.
// - `static getDerivedStateFromProps(props, state)` (re-filters
//   `state.news` against the newly-changed `props.hiddenNewsHeadline`
//   whenever its `.size` differs from the previously-seen size, tracked
//   in `state.hiddenNewsHeadlineSize`, initialized to `0`) is replicated
//   with a render-phase conditional `setState` call guarded by a
//   `useRef` (also initialized to `0`, matching the constructor) - React's
//   own documented-safe "adjust state during render" pattern, the same
//   class of translation already used for this migration's other
//   `getDerivedStateFromProps` ports (see `SignedMessage.tsx`'s header
//   comment for the precedent, and `MarginPositionsTable.tsx`'s for the
//   `useMemo`-shaped alternative that doesn't apply here since this one
//   needs to keep accumulating onto the *previous* `news` value, not a
//   stable input).
// - `shouldComponentUpdate(props, state)` (true only when the filtered
//   news count or `hiddenNewsHeadline.size` actually changed) is a pure
//   render-gate with no `componentDidUpdate` in this file to replicate -
//   dropped entirely per this migration's established treatment of pure
//   perf guards.
// - `onClose(item)`'s `.bind(this, item)` becomes a plain arrow function
//   closing over `item` at the call site.
//
// Preserved quirks (not "fixed"):
// - `filterNews` returns `{...Object.values(news).filter(...)}` -
//   spreading a filtered *array* into an object literal, which produces
//   a plain object keyed by numeric-string indices ("0", "1", ...)
//   rather than an array. `Object.keys(...)`/`Object.values(...)`
//   (the only operations ever performed on `state.news` elsewhere in
//   this file) behave identically on that shape as they would on a real
//   array, so this is kept verbatim rather than "fixed" to return an
//   actual array; `news` is typed loosely (`any`) to avoid implying
//   either shape.
// - `new Date(item.begin_date.split(".").reverse())`/`new
//   Date(item.end_date.split(".").reverse())` pass a plain `string[]`
//   (reversed "DD.MM.YYYY".split(".") pieces) directly into the `Date`
//   constructor rather than joining it into a string first. This isn't
//   a documented `Date` constructor overload (TypeScript's own `Date`
//   typings don't accept an array, forcing an `as any` cast below, purely
//   to satisfy the type checker - the runtime call is unchanged), but
//   V8 (Chrome/Electron, this app's only real runtime) coerces the array
//   to its comma-joined `toString()` ("2024,01,15") and parses that
//   leniently into the intended date, so this has always worked in
//   practice despite not being a correct use of the constructor -
//   verified directly against this Node/V8 version before porting.
// - The `urls.forEach(url => {...})` loop reassigns `content` from a
//   string to a JSX `<span>` on its first match, then calls
//   `content.split(url)` again on every subsequent match using that same
//   variable - a pre-existing bug that only works correctly for a single
//   URL match per news item (a second match would call `.split` on a
//   JSX element). Kept verbatim; `content` is typed `any` to allow both
//   shapes without fighting the type checker.
import * as React from "react";
import {Alert, Icon} from "bitshares-ui-style-guide";
import {Carousel} from "antd";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import {hash} from "bitsharesjs";
import {getNotifications} from "../../lib/chain/onChainConfig";
import {useAltStore} from "../../next/hooks/useAltStore";

const getNewsItemHash = (news: any) => {
    return hash
        .sha1(news.type + news.begin_date + news.end_date + news.content)
        .toString("hex");
};

// See header comment: deliberately keeps the original's "spread an array
// into an object literal" shape verbatim.
const filterNews = (news: any, hiddenNewsHeadline: any) => {
    return {
        ...Object.values(news).filter((item: any) => {
            if (
                typeof item == "object" &&
                item.type &&
                item.begin_date &&
                item.end_date &&
                item.content
            ) {
                return hiddenNewsHeadline.indexOf(getNewsItemHash(item)) == -1;
            } else {
                return false;
            }
        })
    };
};

export interface NewsHeadlineProps {
    hiddenNewsHeadline?: any;
}

function NewsHeadlineCore(props: {hiddenNewsHeadline: any}) {
    const {hiddenNewsHeadline} = props;
    const [news, setNews] = React.useState<any>({});

    // `stateRef` mirror pattern: lets the async `getNewsThroughAsset`
    // below read the CURRENT `hiddenNewsHeadline` at the time its
    // `await` resolves, matching `this.props.hiddenNewsHeadline` in the
    // original (not the value captured when the effect first fired).
    const hiddenNewsHeadlineRef = React.useRef(hiddenNewsHeadline);
    hiddenNewsHeadlineRef.current = hiddenNewsHeadline;

    React.useEffect(() => {
        const getNewsThroughAsset = async () => {
            const notificationList = await getNotifications();
            const filtered = filterNews(
                notificationList,
                hiddenNewsHeadlineRef.current
            );
            setNews(filtered);
        };
        getNewsThroughAsset();
    }, []);

    // Render-phase conditional `setState`, replicating
    // `getDerivedStateFromProps` - see header comment.
    const prevHiddenSizeRef = React.useRef(0);
    if (hiddenNewsHeadline.size !== prevHiddenSizeRef.current) {
        prevHiddenSizeRef.current = hiddenNewsHeadline.size;
        setNews((prevNews: any) => filterNews(prevNews, hiddenNewsHeadline));
    }

    const onClose = (item: any) => {
        const _hash = getNewsItemHash(item);
        if (hiddenNewsHeadline.indexOf(getNewsItemHash(item)) == -1) {
            SettingsActions.hideNewsHeadline(_hash);
        }
    };

    if (!Object.keys(news).length) {
        return null;
    }
    const renderAlert = Object.values(news).reduce(
        (acc: any[], item: any, index: number) => {
            const now = new Date();
            const type = item.type === "critical" ? "error" : item.type; // info & warning
            const begin = new Date(item.begin_date.split(".").reverse() as any);
            const end = new Date(item.end_date.split(".").reverse() as any);
            let content: any = item.content;
            if (now >= begin && now <= end) {
                // only recognize links that start with http and are ended with an exclamation mark
                const urlTest = /(https?):\/\/(www\.)?[^!]+/g;
                const urls = content.match(urlTest);
                if (urls && urls.length) {
                    urls.forEach((url: string) => {
                        const _split = content.split(url);
                        content = (
                            <span>
                                {_split[0]}
                                <a
                                    target="_blank"
                                    className="external-link"
                                    rel="noopener noreferrer"
                                    href={url}
                                    style={{cursor: "pointer"}}
                                >
                                    {url}
                                </a>
                                {_split[1]}
                            </span>
                        );
                    });
                }
                acc = [
                    ...acc,
                    <div className="git-info" key={`git-alert${index}`}>
                        <Alert type={type} message={content} banner />
                        {type === "info" || type === "warning" ? (
                            <Icon
                                type="close"
                                className="close-icon"
                                style={{cursor: "pointer"}}
                                onClick={() => onClose(item)}
                            />
                        ) : null}
                    </div>
                ];
            }
            return acc;
        },
        [] as any[]
    );
    return (
        <Carousel autoplaySpeed={15000} autoplay dots={false}>
            {renderAlert}
        </Carousel>
    );
}

export default function NewsHeadline(props: NewsHeadlineProps) {
    const settingsState = useAltStore<any>(SettingsStore as any);

    return (
        <NewsHeadlineCore
            {...props}
            hiddenNewsHeadline={settingsState.hiddenNewsHeadline}
        />
    );
}
