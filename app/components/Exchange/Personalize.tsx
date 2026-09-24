// TypeScript/functional-component port of the legacy Personalize.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the Exchange screen's settings
// modal (chart options, order-book grouping/orientation, panel
// grouping, general display toggles). Purely presentational/local-state;
// every toggle here just forwards to a caller-supplied callback prop
// (mostly landing in `SettingsActions.changeViewSetting` further up in
// the still-legacy `Exchange.jsx`), no transaction logic. Mechanical,
// line-for-line translation, no logic changes.
//
// Confirmed dead, dropped: the local `open`/`smallScreen` state fields -
// both initialized (the latter via `UNSAFE_componentWillMount`, from
// `window.innerWidth`), neither ever read anywhere in the file (every
// actual screen-size check in `render()` reads the *prop*
// `this.props.smallScreen`/`this.props.tinyScreen`, not this local
// state) - dropping both makes `UNSAFE_componentWillMount` itself
// removable too. Also dropped: the dynamic-string `ref={this.props.modalId}`
// on `<Modal>` - never read via `this.refs` anywhere.
import * as React from "react";
import {
    Button,
    Form,
    Select,
    Switch,
    InputNumber,
    Modal,
    Icon,
    Tooltip
} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {GroupOrderLimitSelector} from "./OrderBook";
import SettingsActions from "actions/SettingsActions";

interface PersonalizeProps {
    viewSettings: any;
    visible: boolean;
    modalId?: string;
    hideModal: () => void;
    onChangeChartHeight: (...args: any[]) => any;
    onSetAutoscroll: (...args: any[]) => any;
    onSetPanelTabs: (...args: any[]) => any;
    panelTabs: any;
    chartType: string;
    chartHeight: any;
    tinyScreen?: boolean;
    smallScreen?: boolean;
    onToggleChart: (...args: any[]) => any;
    chartTools?: boolean;
    onChartTools: (...args: any[]) => any;
    chartZoom?: boolean;
    onChartZoom: (...args: any[]) => any;
    trackedGroupsConfig?: any;
    handleGroupOrderLimitChange: (...args: any[]) => any;
    currentGroupOrderLimit?: any;
    verticalOrderBook: any;
    onMoveOrderBook: (...args: any[]) => any;
    flipBuySell: any;
    onFlipBuySell: (...args: any[]) => any;
    flipOrderBook: any;
    onFlipOrderBook: (...args: any[]) => any;
    buySellTop: any;
    onToggleBuySellPosition: (...args: any[]) => any;
    orderBookReversed?: boolean;
    onOrderBookReversed: (...args: any[]) => any;
    singleColumnOrderForm?: boolean;
    onToggleSingleColumnOrderForm: (...args: any[]) => any;
    mirrorPanels: any;
    onMirrorPanels: (...args: any[]) => any;
    hideScrollbars?: boolean;
    onToggleScrollbars: (...args: any[]) => any;
    hideFunctionButtons?: boolean;
    onHideFunctionButtons: (...args: any[]) => any;
}

export default function Personalize(props: PersonalizeProps) {
    const {
        viewSettings,
        visible,
        hideModal,
        onChangeChartHeight,
        onSetAutoscroll,
        onSetPanelTabs,
        panelTabs,
        chartType,
        chartHeight,
        tinyScreen,
        smallScreen,
        onToggleChart,
        chartTools,
        onChartTools,
        chartZoom,
        onChartZoom,
        trackedGroupsConfig,
        handleGroupOrderLimitChange,
        currentGroupOrderLimit,
        verticalOrderBook,
        onMoveOrderBook,
        flipBuySell,
        onFlipBuySell,
        flipOrderBook,
        onFlipOrderBook,
        buySellTop,
        onToggleBuySellPosition,
        orderBookReversed,
        onOrderBookReversed,
        singleColumnOrderForm,
        onToggleSingleColumnOrderForm,
        mirrorPanels,
        onMirrorPanels,
        hideScrollbars,
        onToggleScrollbars,
        hideFunctionButtons,
        onHideFunctionButtons
    } = props;

    const [autoScroll, setAutoScroll] = React.useState(() =>
        viewSettings.get("global_AutoScroll", true)
    );

    function onClose() {
        hideModal();
    }

    function setChartHeight(value: any) {
        onChangeChartHeight({
            value: value
        });
    }

    function setAutoscroll(target: any) {
        const newState = target == 1 ? true : false;

        setAutoScroll(newState);

        (SettingsActions as any).changeViewSetting({
            global_AutoScroll: newState
        });

        onSetAutoscroll(newState);
    }

    function getGroupingOptions(selectKey: string) {
        return (
            <Select
                placeholder={counterpart.translate(
                    "settings.placeholder_select"
                )}
                style={{width: "100%"}}
                onChange={(value: any) => onSetPanelTabs(selectKey, value)}
                value={panelTabs[selectKey]}
            >
                <Select.Option value={0}>
                    <Translate content="exchange.settings.options.grouping_standalone" />
                </Select.Option>
                <Select.Option value={1}>
                    <Translate content="exchange.settings.options.grouping_1" />
                </Select.Option>
                <Select.Option value={2}>
                    <Translate content="exchange.settings.options.grouping_2" />
                </Select.Option>
            </Select>
        );
    }

    return (
        <Modal
            title={counterpart.translate("exchange.settings.header.title")}
            visible={visible}
            id={props.modalId}
            overlay={true}
            footer={[
                <Button key={"close"} onClick={onClose}>
                    {counterpart.translate("modal.close")}
                </Button>
            ]}
            onCancel={onClose}
            noHeaderContainer
        >
            <Form.Item>
                <header>
                    <Translate content="exchange.settings.header.chart_options" />
                </header>

                {!tinyScreen ? (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.chart_type" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_type"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_reload"
                                    )}
                                >
                                    <Icon type="info-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={chartType}
                                onChange={onToggleChart}
                            >
                                <Select.Option value="market_depth">
                                    {counterpart.translate(
                                        "exchange.order_depth"
                                    )}
                                </Select.Option>
                                <Select.Option value="price_chart">
                                    {counterpart.translate(
                                        "exchange.price_history"
                                    )}
                                </Select.Option>
                                <Select.Option value={"hidden_chart"}>
                                    {counterpart.translate(
                                        "exchange.settings.options.hidden_chart"
                                    )}
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                ) : null}

                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-6">
                        <h6 style={{margin: 9}}>
                            <Translate content="exchange.settings.title.chart_height" />
                            &nbsp;
                            <Tooltip
                                title={counterpart.translate(
                                    "exchange.settings.tooltip.chart_height"
                                )}
                            >
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </h6>
                    </div>
                    <div className="small-6">
                        <InputNumber
                            value={
                                typeof chartHeight === "number" && chartHeight
                            }
                            onChange={setChartHeight}
                        />
                    </div>
                </div>

                {!tinyScreen && chartType == "price_chart" && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.chart_tools" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_tools"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_reload"
                                    )}
                                >
                                    <Icon type="info-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={chartTools}
                                onChange={onChartTools}
                            />
                        </div>
                    </div>
                )}

                {!tinyScreen && chartType == "price_chart" && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.chart_zoom" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_zoom"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.chart_reload"
                                    )}
                                >
                                    <Icon type="info-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={chartZoom}
                                onChange={onChartZoom}
                            />
                        </div>
                    </div>
                )}

                <header>
                    <Translate content="exchange.settings.header.order_options" />
                </header>
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-6">
                        <h6 style={{margin: 9}}>
                            <Translate content="exchange.settings.title.order_book_grouping" />
                            &nbsp;
                            <Tooltip
                                title={counterpart.translate(
                                    "exchange.settings.tooltip.order_book_grouping"
                                )}
                            >
                                <Icon type="question-circle" theme="filled" />
                            </Tooltip>
                        </h6>
                    </div>
                    <div className="small-6">
                        {trackedGroupsConfig ? (
                            <GroupOrderLimitSelector
                                globalSettingsSelector={true}
                                trackedGroupsConfig={trackedGroupsConfig}
                                handleGroupOrderLimitChange={
                                    handleGroupOrderLimitChange
                                }
                                currentGroupOrderLimit={currentGroupOrderLimit}
                            />
                        ) : null}
                    </div>
                </div>

                {!tinyScreen && !smallScreen && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.order_style" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.order_style"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={verticalOrderBook.toString()}
                                onSelect={onMoveOrderBook}
                            >
                                <Select.Option value={"true"}>
                                    <Translate content="exchange.settings.options.vertical" />
                                </Select.Option>
                                <Select.Option value={"false"}>
                                    <Translate content="exchange.settings.options.horizontal" />
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Orientation Order Form */}
                {(!tinyScreen && !verticalOrderBook) || smallScreen ? (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingTop: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.position_order_form" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.position_order_form"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={flipBuySell.toString()}
                                onSelect={onFlipBuySell}
                            >
                                <Select.Option value={"false"}>
                                    <Translate content="exchange.settings.options.position_order_form_opt1" />
                                </Select.Option>
                                <Select.Option value={"true"}>
                                    <Translate content="exchange.settings.options.position_order_form_opt2" />
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                ) : null}

                {/* Orientation Order Book */}
                {(!tinyScreen && !verticalOrderBook) || smallScreen ? (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingTop: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.position_order_orders" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.position_order_orders"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={flipOrderBook.toString()}
                                onSelect={onFlipOrderBook}
                            >
                                <Select.Option value={"false"}>
                                    <Translate content="exchange.settings.options.position_order_orders_opt1" />
                                </Select.Option>
                                <Select.Option value={"true"}>
                                    <Translate content="exchange.settings.options.position_order_orders_opt2" />
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                ) : null}

                {/* Asset / Order Form Position */}
                {(!tinyScreen && !verticalOrderBook) || smallScreen ? (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingTop: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.position_order_asset" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.position_order_asset"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={buySellTop.toString()}
                                onSelect={onToggleBuySellPosition}
                            >
                                <Select.Option value={"false"}>
                                    <Translate content="exchange.settings.options.position_order_asset_opt1" />
                                </Select.Option>
                                <Select.Option value={"true"}>
                                    <Translate content="exchange.settings.options.position_order_asset_opt2" />
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                ) : null}

                {!tinyScreen && verticalOrderBook ? (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingTop: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.orderbook_auto_scroll" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.orderbook_auto_scroll"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={autoScroll}
                                onChange={setAutoscroll}
                            />
                        </div>
                    </div>
                ) : null}

                {!tinyScreen && verticalOrderBook ? (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.reverse_order_book" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.reverse_order_book"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={orderBookReversed}
                                onChange={onOrderBookReversed}
                            />
                        </div>
                    </div>
                ) : null}

                {!tinyScreen && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6" style={{paddingRight: 5}}>
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.single_colum_order_form" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.single_colum_order_form"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={singleColumnOrderForm}
                                onChange={onToggleSingleColumnOrderForm}
                            />
                        </div>
                    </div>
                )}

                {!tinyScreen && (
                    <header>
                        <Translate content="exchange.settings.header.panel_grouping" />
                        &nbsp;
                        <Tooltip
                            title={counterpart.translate(
                                "exchange.settings.tooltip.panel_grouping"
                            )}
                        >
                            <Icon type="question-circle" theme="filled" />
                        </Tooltip>
                    </header>
                )}
                {!tinyScreen && (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingBottom: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.my_trades" />
                            </h6>
                        </div>
                        <div className="small-6">
                            {getGroupingOptions("my_history")}
                        </div>
                    </div>
                )}
                {!tinyScreen && (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingBottom: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.market_trades" />
                            </h6>
                        </div>
                        <div className="small-6">
                            {getGroupingOptions("history")}
                        </div>
                    </div>
                )}
                {!tinyScreen && (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingBottom: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.open_orders" />
                            </h6>
                        </div>
                        <div className="small-6">
                            {getGroupingOptions("my_orders")}
                        </div>
                    </div>
                )}
                {!tinyScreen && (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingBottom: "0.5em"}}
                    >
                        <div className="small-6">
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.settlements" />
                            </h6>
                        </div>
                        <div className="small-6">
                            {getGroupingOptions("open_settlement")}
                        </div>
                    </div>
                )}

                {!tinyScreen && (
                    <header>
                        <Translate content="exchange.settings.header.general" />
                    </header>
                )}

                {!tinyScreen && !smallScreen && (
                    <div
                        className="grid-block no-overflow wrap shrink"
                        style={{paddingBottom: "0.5em"}}
                    >
                        <div className="small-6" style={{paddingRight: 5}}>
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.market_location" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.market_location"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Select
                                placeholder={counterpart.translate(
                                    "settings.placeholder_select"
                                )}
                                style={{width: "100%"}}
                                value={mirrorPanels.toString()}
                                onSelect={onMirrorPanels}
                            >
                                <Select.Option value={"false"}>
                                    <Translate content="settings.left" />
                                </Select.Option>
                                <Select.Option value={"true"}>
                                    <Translate content="settings.right" />
                                </Select.Option>
                            </Select>
                        </div>
                    </div>
                )}

                {!tinyScreen && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6" style={{paddingRight: 5}}>
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.reduce_scrollbars" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.reduce_scrollbars"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.reload"
                                    )}
                                >
                                    <Icon type="info-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={hideScrollbars}
                                onChange={onToggleScrollbars}
                            />
                        </div>
                    </div>
                )}

                {!tinyScreen && (
                    <div className="grid-block no-overflow wrap shrink">
                        <div className="small-6" style={{paddingRight: 5}}>
                            <h6 style={{margin: 9}}>
                                <Translate content="exchange.settings.title.hide_function_buttons" />
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "exchange.settings.tooltip.hide_function_buttons"
                                    )}
                                >
                                    <Icon type="question-circle" theme="filled" />
                                </Tooltip>
                            </h6>
                        </div>
                        <div className="small-6">
                            <Switch
                                style={{margin: 6}}
                                checked={hideFunctionButtons}
                                onChange={onHideFunctionButtons}
                            />
                        </div>
                    </div>
                )}
            </Form.Item>
        </Modal>
    );
}
