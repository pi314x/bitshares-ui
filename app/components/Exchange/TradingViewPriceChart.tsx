// TypeScript/function-component port of the legacy
// TradingViewPriceChart.jsx (Exchange/ final batch,
// docs/UI_MIGRATION_PLAN.md Phase 8). Mechanical translation, no logic
// changes intended - the third-party TradingView charting library
// (`charting_library/charting_library.esm`, `require()`d dynamically,
// same as the original) is excluded from `tsc`'s `include` set
// (`tsconfig.json`'s `exclude: [..., "charting_library"]`) and from the
// webpack build per the 2 known pre-existing `charting_library.esm`
// build errors this migration already treats as expected/out of scope
// - not touched here.
//
// Not security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`Actions\.`/`ApplicationApi\.` - none appear). Calls
// `SettingsActions.addChartLayout` (`onSubmitConfirmation`, and again
// inside `onRow`'s click handler) and `SettingsActions.deleteChartLayout`
// (`handleDelete`) - these persist the user's saved chart-layout
// preferences (a TradingView "save object" blob + a name/symbol/date),
// not wallet/key data - transcribed verbatim, same payload shapes.
//
// DOM-ref-to-third-party-library handling, checked against this
// directory's already-ported siblings before choosing an approach:
// `DepthHighChart.tsx` (Highcharts, via `react-highcharts`) keeps a
// `React.useRef<any>(null)` for the chart instance/that library's own
// ref prop. This file's TradingView widget isn't attached via a React
// ref at all, in the original *or* here - `new TradingView.widget({...,
// container: "tv_chart", ...})` finds its DOM container by the literal
// string id on the `<div id="tv_chart">` below (unchanged), exactly as
// the original class did. The one real DOM ref in this file is the
// save-layout `<Input ref={...}>` (an ant-design/`bitshares-ui-style-
// guide` component, not a bare host element) that `onSubmitConfirmation`
// reads back via `.current.state.value` - the same pattern already
// established at `Wallet/ImportKeys.tsx`'s `wifInputRef` (`React.useRef
// <any>(null)`), reused here as `layoutName`.
//
// Structural changes:
// - `this.tvWidget` (an instance field mutated by `loadTradingView`,
//   read by `_setSymbol`/`onSubmitConfirmation`/`loadLastChart`/`onRow`)
//   becomes `tvWidgetRef` (`useRef<any>(null)`).
// - `componentDidMount` (unconditional `loadTradingView(this.props)`)
//   and `componentWillUnmount` (`this.props.dataFeed.clearSubs()`) are
//   combined into one mount-only `useEffect(() => {...; return () =>
//   {...};}, [])`. The unmount cleanup reads `propsRef.current.dataFeed`
//   (a plain `useRef` mirror of `props`, kept in sync on every render -
//   this migration's established `stateRef` pattern, applied to props
//   here) rather than the closed-over `props` from mount time, matching
//   the original's `this.props` always reading the *current* props at
//   unmount, not a stale snapshot.
// - `UNSAFE_componentWillReceiveProps(np)` (`if (!np.marketReady)
//   return; if (!this.props.dataFeed && np.dataFeed)
//   this.loadTradingView(np);`) becomes a second effect keyed on
//   `[props.marketReady, props.dataFeed]`, mount-skipped via the
//   established `isMountRef` guard (`UNSAFE_componentWillReceiveProps`
//   never fires on mount in the original either). It reads the
//   *previous* render's props from `instancePropsRef` - a second ref,
//   updated to the latest `props` only at the *end* of this effect -
//   to stand in for `this.props` at the exact moment the original's
//   `UNSAFE_componentWillReceiveProps` runs, which is still the
//   *pre-update* value (React only commits `this.props = nextProps`
//   *after* this lifecycle returns). This matters because
//   `loadTradingView` itself reads three fields
//   (`mobile`/`chartZoom`/`chartTools`, see below) via `this.props`
//   directly rather than via its own `props` parameter - preserved by
//   passing both the incoming props (`np`) and this stale
//   `instancePropsRef.current` snapshot into `loadTradingView`
//   separately.
// - `shouldComponentUpdate` is a pure re-render guard (no
//   `componentDidUpdate` exists in this file for it to also gate) -
//   dropped entirely per this migration's convention; it cannot change
//   the real DOM/TradingView side effects, which are keyed off the two
//   effects above and off per-render event-handler closures, not off
//   whether `render()` itself happens to run.
// - `_onWheel`: defined and (at the very end of `loadTradingView`)
//   rebound to a fresh `this._onWheel = this._onWheel.bind(this)`, but
//   grepped for every other reference to it in this file (and
//   app-wide) - it is never attached to any `addEventListener`/`onWheel`
//   anywhere, so it never actually ran. Dropped as confirmed dead,
//   along with its orphaned rebinding line and its
//   `console.log("Test wheel interception")` body.
//
// Preserved bugs/quirks, not fixed:
// - `loadTradingView`'s `preset: this.props.mobile ? "mobile" : ""` and
//   its two `if (this.props.mobile || !this.props.chartZoom)`/
//   `if (this.props.mobile || !this.props.chartTools)` feature-toggle
//   checks read `this.props` (the component's *own*, current-at-call-
//   time props) rather than the `props` parameter `loadTradingView`
//   otherwise uses throughout for everything else (`buckets`,
//   `bucketSize`, `quoteSymbol`, `baseSymbol`, `locale`, `theme`, ...).
//   The two are only actually different values when `loadTradingView`
//   is invoked from the `UNSAFE_componentWillReceiveProps` path with
//   `np` while `this.props` still holds the pre-update props - at mount
//   (`componentDidMount`) they're identical. Reproduced via the
//   `loadTradingView(np, instanceProps)` second parameter described
//   above, defaulting to `np` (so the mount call site, which passes the
//   same object for both, behaves identically to the original).
// - `currentPeriod` is read from props by this file's only real caller
//   (`Exchange.tsx`) but never referenced anywhere in the original
//   class body (grepped: no match) - kept in the props interface below
//   as accepted-but-unused, same treatment as other such props
//   elsewhere in this migration.
// - `onSubmitConfirmation`'s `layoutName.current.state.value = null`
//   (a direct mutation of the ant-design `Input`'s internal React state
//   object, not a proper controlled-input reset) is kept verbatim, same
//   as `ImportKeys.tsx`'s identical-shape `wifInputRef` read. The
//   original wraps it in `this.setState({showSaveModal: false},
//   callback)`'s post-commit callback; since the mutation is a direct,
//   React-bypassing ref write with no dependency on `showSaveModal`
//   having actually re-rendered first, it's run immediately after
//   `mergeState({showSaveModal: false})` instead (no observable
//   difference - `setState`'s callback form has no `useState` hook
//   equivalent anyway).
import * as React from "react";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TradingView = require("../../../charting_library/charting_library.esm");
import colors from "assets/colors";
import {getResolutionsFromBuckets, getTVTimezone} from "./tradingViewClasses";
import {Modal, Input, Table, Button, Icon} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import Translate from "react-translate-component";
import {useAltStore} from "../../next/hooks/useAltStore";

export interface TradingViewPriceChartProps {
    dataFeed?: any;
    theme?: string;
    buckets?: any;
    bucketSize?: any;
    currentPeriod?: any;
    chartHeight?: any;
    chartZoom?: boolean;
    chartTools?: boolean;
    mobile?: boolean;
    locale?: string;
    quoteSymbol?: string;
    baseSymbol?: string;
    marketReady?: boolean;
    charts?: any;
    [key: string]: any;
}

interface TradingViewPriceChartState {
    showSaveModal: boolean;
    showLoadModal: boolean;
    error: any;
}

function TradingViewPriceChartCore(props: TradingViewPriceChartProps) {
    const [state, setState] = React.useState<TradingViewPriceChartState>({
        showSaveModal: false,
        showLoadModal: false,
        error: false
    });
    const mergeState = (patch: Partial<TradingViewPriceChartState>) =>
        setState(prev => ({...prev, ...patch}));

    const layoutName = React.useRef<any>(null);
    const tvWidgetRef = React.useRef<any>(null);
    const propsRef = React.useRef(props);
    propsRef.current = props;
    const instancePropsRef = React.useRef(props);
    const isMountRef = React.useRef(true);

    const resetError = () => {
        mergeState({error: false});
    };

    const hideModal = () => {
        resetError();
        mergeState({showSaveModal: false, showLoadModal: false});
    };

    const loadLastChart = () => {
        const {charts, quoteSymbol, baseSymbol} = propsRef.current;

        const chart = charts
            .toArray()
            .filter(
                (chart: any) =>
                    chart.symbol === quoteSymbol + "_" + baseSymbol &&
                    chart.enabled
            );
        chart[0] && tvWidgetRef.current.load(chart[0].object);
    };

    const setSymbol = (ticker: string) => {
        if (tvWidgetRef.current) {
            tvWidgetRef.current.chart().removeAllShapes();
            loadLastChart();
            tvWidgetRef.current.setSymbol(
                ticker,
                getResolutionsFromBuckets([propsRef.current.bucketSize])[0]
            );
        }
    };

    const loadTradingView = (np: any, instanceProps: any = np) => {
        const {dataFeed} = np;
        const themeColors = (colors as any)[np.theme];

        if (!dataFeed) return;
        if (!!tvWidgetRef.current) return;

        if (__DEV__)
            console.log(
                "currentResolution",
                getResolutionsFromBuckets([np.bucketSize])[0],
                "symbol",
                np.quoteSymbol + "_" + np.baseSymbol,
                "timezone:",
                getTVTimezone()
            );

        dataFeed.update({
            resolutions: np.buckets,
            ticker: np.quoteSymbol + "_" + np.baseSymbol,
            interval: getResolutionsFromBuckets([np.bucketSize])[0]
        });

        const disabled_features = [
            "symbol_info",
            "symbol_search_hot_key",
            "border_around_the_chart",
            "header_symbol_search",
            "header_compare",
            "header_saveload",
            "header_settings"
        ];

        const enabled_features: string[] = [];

        if (instanceProps.mobile || !instanceProps.chartZoom) {
            disabled_features.push("chart_scroll");
            disabled_features.push("chart_zoom");
        }

        if (instanceProps.mobile || !instanceProps.chartTools) {
            disabled_features.push("left_toolbar");
            disabled_features.push("chart_crosshair_menu");
            disabled_features.push("chart_events");
            disabled_features.push("footer_share_buttons");
            disabled_features.push("footer_screenshot");
            disabled_features.push("timeframes_toolbar");
            disabled_features.push("footer_publish_idea_button");
            disabled_features.push("caption_buttons_text_if_possible");
            disabled_features.push("line_tool_templates");
            disabled_features.push("widgetbar_tabs");
            disabled_features.push("support_manage_drawings");
            disabled_features.push("support_multicharts");
            disabled_features.push("right_bar_stays_on_scroll");
            disabled_features.push("charts_auto_save");
            disabled_features.push("edit_buttons_in_legend");
            disabled_features.push("context_menus");
            disabled_features.push("control_bar");
            disabled_features.push("header_fullscreen_button");
            disabled_features.push("header_widget");
            disabled_features.push("symbollist_context_menu");
            disabled_features.push("show_pro_features");
        } else {
            enabled_features.push("study_templates");
            enabled_features.push("keep_left_toolbar_visible_on_small_screens");
        }

        if (__DEV__) console.log("*** Load Chart ***");
        if (__DEV__) console.time("*** Chart load time: ");

        // resolution / interval: length of one bar
        // frame: total timeframe shown on the chart
        // (in below list, text is frame)
        const allTimes = np.buckets.map((bucket: any) => {
            return {
                text: getResolutionsFromBuckets([bucket * 250], true)[0],
                resolution: getResolutionsFromBuckets([bucket])[0]
            };
        });
        tvWidgetRef.current = new TradingView.widget({
            fullscreen: false,
            symbol: np.quoteSymbol + "_" + np.baseSymbol,
            interval: getResolutionsFromBuckets([np.bucketSize])[0],
            timeframe: getResolutionsFromBuckets([np.bucketSize * 250], true)[0],
            time_frames: allTimes,
            library_path: `${
                __ELECTRON__ ? __BASE_URL__ : ""
            }/charting_library/`,
            datafeed: dataFeed,
            container: "tv_chart",
            charts_storage_url: "https://saveload.tradingview.com",
            charts_storage_api_version: "1.1",
            client_id: "tradingview.com",
            user_id: "public_user_id",
            autosize: true,
            locale: np.locale,
            timezone: getTVTimezone(),
            // toolbar_bg: themeColors.bgColor,
            // theme: (props.theme == "darkTheme") ? "dark" : "light",
            overrides: {
                "paneProperties.background": themeColors.bgColor,
                "paneProperties.horzGridProperties.color":
                    themeColors.axisLineColor,
                "paneProperties.vertGridProperties.color":
                    themeColors.axisLineColor
                // "scalesProperties.lineColor": themeColors.axisLineColor,
                // "scalesProperties.textColor": themeColors.textColor,
                // "scalesProperties.backgroundColor": themeColors.bgColor,
                // "mainSeriesProperties.candleStyle.upColor": "#",
                // "mainSeriesProperties.candleStyle.downColor": "#",
                // "mainSeriesProperties.hollowCandleStyle.upColor": "#",
                // "mainSeriesProperties.hollowCandleStyle.downColor": "#",
                // "mainSeriesProperties.haStyle.upColor": "#",
                // "mainSeriesProperties.haStyle.downColor": "#"
            },
            custom_css_url: np.theme + ".css",
            enabled_features: enabled_features,
            disabled_features: disabled_features,
            debug: false,
            preset: instanceProps.mobile ? "mobile" : ""
        });
        tvWidgetRef.current.onChartReady(() => {
            const widget = tvWidgetRef.current;
            if (__DEV__) console.log("*** Chart Ready ***");
            if (__DEV__) console.timeEnd("*** Chart load time: ");
            if (!instanceProps.mobile && instanceProps.chartTools) {
                widget.headerReady().then(() => {
                    if (__DEV__) console.log("*** Header Ready ***");
                    const loadButton = tvWidgetRef.current.createButton();
                    loadButton.setAttribute(
                        "title",
                        counterpart.translate("exchange.load_custom_charts")
                    );
                    loadButton.classList.add("apply-common-tooltip");
                    loadButton.addEventListener("click", () => {
                        mergeState({showLoadModal: true});
                    });
                    loadButton.innerHTML = `<span>${counterpart.translate(
                        "exchange.chart_load"
                    )}</span>`;
                    const saveButton = tvWidgetRef.current.createButton();
                    saveButton.setAttribute(
                        "title",
                        counterpart.translate("exchange.save_custom_charts")
                    );
                    saveButton.classList.add("apply-common-tooltip");
                    saveButton.addEventListener("click", () => {
                        mergeState({showSaveModal: true});
                    });
                    saveButton.innerHTML = `<span>${counterpart.translate(
                        "exchange.chart_save"
                    )}</span>`;
                });
            }
            dataFeed.update({
                onMarketChange: setSymbol
            });
            loadLastChart();
        });
    };

    React.useEffect(() => {
        loadTradingView(propsRef.current);
        instancePropsRef.current = propsRef.current;

        return () => {
            propsRef.current.dataFeed.clearSubs();
        };
    }, []);

    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            instancePropsRef.current = props;
            return;
        }

        if (!props.marketReady) {
            instancePropsRef.current = props;
            return;
        }

        if (!instancePropsRef.current.dataFeed && props.dataFeed) {
            loadTradingView(props, instancePropsRef.current);
        }

        instancePropsRef.current = props;
    }, [props.marketReady, props.dataFeed]);

    const onSubmitConfirmation = () => {
        const error = props.charts.some(
            (chart: any) =>
                chart.key === layoutName.current.state.value &&
                chart.symbol === props.quoteSymbol + "_" + props.baseSymbol
        );
        if (!error) {
            resetError();
            tvWidgetRef.current.save(function(object: any) {
                const chart: any = {};
                chart.key = layoutName.current.state.value || "";
                chart.object = object;
                chart.name = layoutName.current.state.value || "";
                chart.symbol = props.quoteSymbol + "_" + props.baseSymbol;
                chart.modified = new Date().toLocaleDateString("en-US");
                SettingsActions.addChartLayout(chart);
                mergeState({showSaveModal: false});
                if (layoutName.current.state) {
                    layoutName.current.state.value = null;
                }
            });
        } else {
            mergeState({error});
        }
    };

    const handleDelete = (name: string) => {
        SettingsActions.deleteChartLayout(name);
    };

    const {charts, quoteSymbol, baseSymbol} = props;
    const {error} = state;
    const _error = error ? "has-error" : "";
    const dataSource = charts
        .toArray()
        .filter((chart: any) => chart.symbol === quoteSymbol + "_" + baseSymbol);
    const columns = [
        {
            title: counterpart.translate("exchange.layout_name"),
            dataIndex: "name",
            key: "name"
        },
        {
            title: counterpart.translate("exchange.modified"),
            dataIndex: "modified",
            key: "modified"
        },
        {
            title: counterpart.translate("exchange.actions"),
            dataIndex: "actions",
            key: "actions",
            render: (text: any, record: any) => {
                return (
                    <Icon
                        style={{width: "32px"}}
                        onClick={() => handleDelete(record.name)}
                        type="delete"
                    />
                );
            }
        }
    ];

    const onRow = (record: any) => {
        return {
            onClick: (event: any) => {
                if (event.target.localName === "td") {
                    hideModal();
                    SettingsActions.addChartLayout(record);
                    tvWidgetRef.current.load(record.object);
                } else if (
                    event.currentTarget.parentElement.childElementCount === 1
                )
                    hideModal();
            }
        };
    };

    return (
        <div className="small-12">
            <div
                className="exchange-bordered"
                style={{height: props.chartHeight + "px"}}
                id="tv_chart"
            />
            <Modal
                title={counterpart.translate("exchange.load_chart_layout")}
                closable={false}
                visible={state.showLoadModal}
                footer={[
                    <Button key="cancel" onClick={hideModal}>
                        {counterpart.translate("modal.close")}
                    </Button>
                ]}
            >
                <Table dataSource={dataSource || []} columns={columns} onRow={onRow} />
            </Modal>
            <Modal
                title={counterpart.translate("exchange.save_new_chart_layout")}
                closable={false}
                visible={state.showSaveModal}
                footer={[
                    <Button key="submit" type="primary" onClick={onSubmitConfirmation}>
                        {counterpart.translate("modal.save")}
                    </Button>,
                    <Button key="cancel" onClick={hideModal}>
                        {counterpart.translate("modal.close")}
                    </Button>
                ]}
            >
                <div>
                    {error ? (
                        <span className={_error}>
                            <Translate content="exchange.chart_error" />
                        </span>
                    ) : null}
                    <span
                        className={_error}
                        style={{
                            borderBottom: "#A09F9F 1px dotted"
                        }}
                    >
                        <Input
                            placeholder={counterpart.translate(
                                "exchange.enter_chart_layout_name"
                            )}
                            ref={layoutName}
                            onChange={resetError}
                            onPressEnter={onSubmitConfirmation}
                        />
                    </span>
                </div>
            </Modal>
        </div>
    );
}

export default function TradingViewPriceChart(props: TradingViewPriceChartProps) {
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <TradingViewPriceChartCore
            {...props}
            charts={settingsState.chartLayouts}
        />
    );
}
