// TypeScript/functional-component port of the legacy RecentTransactions.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Two exported components, both originally wrapped with
// `BindToChainState`:
//
// `RecentTransactions`: the original's `connect(BindToChainState(
// Component), {listenTo: [SettingsStore], getProps})` collapses into a
// single `RecentTransactionsContainer` (`useAltStore(SettingsStore)` for
// `marketDirections`, then resolving the required `accountsList` prop).
// `accountsList` is a `ChainTypes.ChainAccountsList`, so its resolution
// loop increments its index *after* assigning (no sparse-array quirk,
// unlike `chain_objects_list`/`chain_assets_list` - see
// `NestedApprovalState.tsx`'s header for the general distinction). No
// `tempComponent`/`show_loader` option was passed to `BindToChainState`
// here, so the Container's fallback while `accountsList` is unresolved
// is the default blank `<span />`.
//
// `TransactionWrapper`: a `BindToChainState`-wrapped render-prop
// component (`{this.props.children(this.props)}`), replaced by a
// Container resolving `asset`/`to`/`fromAccount` the usual way, passing
// the resolved props back into the render-prop function exactly as
// `BindToChainState`'s own `<Component {...props} {...this.state}/>`
// merge would.
//
// `shouldComponentUpdate` (a large multi-field shallow-equality gate
// across both props and state) has no hooks equivalent for a component
// gating its own re-renders this way, and is dropped - it doesn't change
// any rendered output.
//
// Dropped as confirmed dead (found while porting): `state.rows`
// (initialized to `[]`, never read anywhere); `_onIncreaseLimit` (never
// wired to any element - `<PaginatedList>` isn't given an
// increase-limit/load-more callback prop at all); `this.refs.transactions`
// in `componentDidMount` (no element in `render()` ever sets
// `ref="transactions"` - it's a leftover from the commented-out
// `ps.initialize(t)` perfect-scrollbar call). Also dropped: `maxHeight`
// and `headerHeight` as `render()`-body locals - both were already
// read into local variables in the original `render()` and then never
// actually used in its returned JSX (only inside the now-dropped
// `shouldComponentUpdate`/inside `_setHeaderHeight`, which still reads
// `state.headerHeight` directly, unaffected by this).
//
// The one real string ref, `ref="header"` (read via `.offsetHeight` in
// `_setHeaderHeight`, called once from `componentDidMount` when
// `!fullHeight`), becomes a `useRef()` attached to the same
// conditionally-rendered `<div>` (only rendered when `!dashboard`).
// Preserved verbatim, not "fixed": if a caller ever passed
// `dashboard={true}` together with `fullHeight={false}` (no current call
// site does - every `dashboard` usage also sets `fullHeight`), the
// original would throw reading `.offsetHeight` off an unset ref, and
// this port throws reading `.offsetHeight` off a `null` ref for the same
// reason - not a behavior this port is responsible for correcting.
import * as React from "react";
import {Fragment} from "react";
import Translate from "react-translate-component";
import JSONModal from "components/Modal/JSONModal";
import {Icon as AntIcon} from "bitshares-ui-style-guide";
import {
    ChainTypes as grapheneChainTypes,
    ChainStore
} from "bitsharesjs";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import cnames from "classnames";
import PaginatedList from "../Utility/PaginatedList";
const {operations} = (grapheneChainTypes as any);
import LoadingIndicator from "../LoadingIndicator";
import {Tooltip, Modal, Button, Select, Input} from "bitshares-ui-style-guide";
const ops = Object.keys(operations);
import {Link} from "react-router-dom";
import FormattedAsset from "../Utility/FormattedAsset";
import BlockTime from "../Blockchain/BlockTime";
import OperationAnt from "../Blockchain/OperationAnt";
import SettingsStore from "stores/SettingsStore";
import PendingBlock from "../Utility/PendingBlock";
import utils from "common/utils";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const operation = new (OperationAnt as any)();

const Option = (Select as any).Option;
import AccountHistoryExporter, {
    FULL,
    COINBASE
} from "../../services/AccountHistoryExporter";
import {settingsAPIs} from "api/apiConfig";

// `ES_WRAPPER_LIST` is currently declared as an empty array literal (all
// entries commented out) in the still-`.js` `apiConfig`, so TS infers it
// as `never[]` there; aliased to `any[]` here rather than casting at
// every call site.
const esWrapperList: any[] = settingsAPIs.ES_WRAPPER_LIST;

const LinkComponent = Link as React.ComponentType<any>;

function compareOps(b: any, a: any) {
    if (a.block_num === b.block_num) {
        if (a.trx_in_block !== b.trx_in_block) {
            return a.trx_in_block - b.trx_in_block;
        }

        if (a.op_in_trx !== b.op_in_trx) {
            return a.op_in_trx - b.op_in_trx;
        }
        return a.virtual_op - b.virtual_op;
    } else {
        return a.block_num - b.block_num;
    }
}

interface RecentTransactionsState {
    limit: number;
    fetchingAccountHistory: boolean;
    headerHeight: number;
    filter: string;
    accountHistoryError: any;
    showModal: boolean;
    esNodeCustom: boolean;
    esNode: any;
    visibleId: any;
}

interface RecentTransactionsCoreProps {
    accountsList: any[];
    compactView?: boolean;
    limit?: number;
    maxHeight?: number;
    fullHeight?: boolean;
    showFilters?: boolean;
    filter?: any;
    customFilter?: any;
    style?: any;
    dashboard?: any;
    title?: any;
    marketDirections?: any;
    [key: string]: any;
}

function RecentTransactionsCore({
    accountsList,
    compactView,
    limit: limitProp = 25,
    fullHeight = false,
    showFilters = false,
    filter,
    customFilter,
    style: styleProp,
    dashboard,
    title,
    marketDirections
}: RecentTransactionsCoreProps) {
    const [state, setState] = React.useState<RecentTransactionsState>({
        limit: limitProp,
        fetchingAccountHistory: false,
        headerHeight: 85,
        filter: "all",
        accountHistoryError: false,
        showModal: false,
        esNodeCustom: false,
        esNode:
            esWrapperList.length > 0
                ? esWrapperList[0].url
                : null,
        visibleId: ""
    });

    const mergeState = (partial: Partial<RecentTransactionsState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const useCustom = counterpart.translate("account.export_modal.use_custom");

    const headerRef = React.useRef<any>(null);

    const setHeaderHeight = () => {
        const height = headerRef.current.offsetHeight;

        if (height !== state.headerHeight) {
            mergeState({
                headerHeight: height
            });
        }
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            if (!fullHeight) {
                setHeaderHeight();
            }
        }
    }, []);

    const esNodeChange = (e: any) => {
        let newValue = null;
        if (e.target) {
            newValue = e.target.value;
        } else {
            newValue = e;
        }
        if (newValue == useCustom) {
            mergeState({
                esNode: "",
                esNodeCustom: true
            });
        } else {
            mergeState({
                esNode: newValue
            });
        }
    };

    const showExportModal = () => {
        mergeState({
            showModal: true
        });
    };

    const hideExportModal = () => {
        mergeState({
            showModal: false
        });
    };

    const getHistory = (
        accountsListArg: any,
        filterOp: any,
        customFilterArg: any
    ) => {
        let history: any[] = [];
        const seen_ops = new Set();
        for (const account of accountsListArg) {
            if (account) {
                const h = account.get("history");
                if (h)
                    history = history.concat(
                        h
                            .toJS()
                            .filter(
                                (op: any) =>
                                    !seen_ops.has(op.id) && seen_ops.add(op.id)
                            )
                    );
            }
        }
        if (filterOp) {
            history = history.filter((a: any) => {
                return a.op[0] === operations[filterOp];
            });
        }

        if (customFilterArg) {
            history = history.filter((a: any) => {
                const finalValue = customFilterArg.fields.reduce(
                    (final: any, filterField: any) => {
                        switch (filterField) {
                            case "asset_id":
                                return (
                                    final &&
                                    a.op[1]["amount"][filterField] ===
                                        customFilterArg.values[filterField]
                                );
                            default:
                                return (
                                    final &&
                                    a.op[1][filterField] ===
                                        customFilterArg.values[filterField]
                                );
                        }
                    },
                    true
                );
                return finalValue;
            });
        }
        return history;
    };

    const generateCSV = async (exportType: any) => {
        if (__DEV__) {
            console.log("intializing fetching of ES data");
        }
        try {
            const AHE = new (AccountHistoryExporter as any)();

            mergeState({
                fetchingAccountHistory: true,
                showModal: false
            });

            await AHE.generateCSV(accountsList, state.esNode, exportType);

            mergeState({
                fetchingAccountHistory: false,
                accountHistoryError: null
            });
        } catch (err) {
            console.error(err);
            mergeState({
                fetchingAccountHistory: false,
                accountHistoryError: err,
                esNodeCustom: false,
                esNode:
                    esWrapperList.length > 0
                        ? esWrapperList[0].url
                        : null
            });
        }
    };

    const onChangeFilter = (value: any) => {
        mergeState({
            filter: value
        });
    };

    const openJSONModal = (id: any) => {
        mergeState({visibleId: id});
    };

    const closeJSONModal = () => {
        mergeState({visibleId: ""});
    };

    const getDataSource = (o: any, current_account_id: any) => {
        const fee = o.op[1].fee;
        const trxTypes = counterpart.translate("transaction.trxTypes");
        const info = operation.getColumn(
            o.op,
            current_account_id,
            o.block_num,
            o.result,
            marketDirections
        );
        fee.amount = parseInt(fee.amount, 10);
        const dynGlobalObject: any = ChainStore.getObject("2.1.0");
        const lastIrreversibleBlockNum = dynGlobalObject.get(
            "last_irreversible_block_num"
        );
        return {
            key: o.id,
            id: (
                <Fragment>
                    <span
                        className="cursor-pointer"
                        onClick={() => openJSONModal(o.id)}
                    >
                        {o.id} <AntIcon type="file-search" />
                    </span>
                    <JSONModal
                        visible={state.visibleId === o.id}
                        operation={o.op}
                        title={(trxTypes as any)[ops[o.op[0]] || ""]}
                        hideModal={closeJSONModal}
                    />
                </Fragment>
            ),
            type: (
                <LinkComponent
                    className="inline-block"
                    data-place="bottom"
                    data-tip={counterpart.translate("tooltip.show_block", {
                        block: (utils as any).format_number(o.block_num, 0)
                    })}
                    to={`/block/${o.block_num}/${o.trx_in_block}`}
                >
                    <span className={cnames("label", info.color || "info")}>
                        {(trxTypes as any)[ops[o.op[0]]]}
                    </span>
                </LinkComponent>
            ),
            info: (
                <div>
                    <div>
                        <span>{info.column}</span>
                    </div>
                    <div style={{fontSize: 14, paddingTop: 5}}>
                        {o.block_num > lastIrreversibleBlockNum ? (
                            <PendingBlock blockNumber={o.block_num} />
                        ) : null}
                    </div>
                </div>
            ),
            fee: <FormattedAsset amount={fee.amount} asset={fee.asset_id} />,
            time: <BlockTime block_number={o.block_num} fullDate={true} />
        };
    };

    const {limit} = state;
    const current_account_id =
        accountsList.length === 1 && accountsList[0]
            ? accountsList[0].get("id")
            : null;
    const history = getHistory(
        accountsList,
        showFilters && state.filter !== "all" ? state.filter : filter,
        customFilter
    ).sort(compareOps);
    const historyCount = history.length;

    const style = styleProp ? styleProp : {width: "100%", height: "100%"};

    let options = null;
    if (true || showFilters) {
        options = [
            "all",
            "transfer",
            "limit_order_create",
            "limit_order_cancel",
            "fill_order",
            "account_create",
            "account_update",
            "asset_create",
            "witness_withdraw_pay",
            "vesting_balance_withdraw"
        ].map(type => {
            return (
                <Option value={type} key={type}>
                    {counterpart.translate("transaction.trxTypes." + type)}
                </Option>
            );
        });
    }

    const hideFee = false;

    const display_history = history.length
        ? history.slice(0, limit).map((o: any) => {
              return getDataSource(o, current_account_id);
          })
        : [];
    const action = (
        <div className="total-value" key="total_value">
            <span style={{textAlign: "center"}}>&nbsp;</span>
        </div>
    );

    const footer = (
        <div>
            <Button onClick={() => generateCSV(FULL)} type="primary">
                <Translate content="account.export_modal.full_report" />
            </Button>
            <Button onClick={() => generateCSV(COINBASE)} type="primary">
                <Translate content="account.export_modal.coinbase_report" />
            </Button>
        </div>
    );

    return (
        <div className="recent-transactions no-overflow" style={style}>
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={<Translate content="account.export_modal.title" />}
                visible={state.showModal}
                id="transaction_confirm_modal"
                footer={footer}
                overlay={true}
                onCancel={hideExportModal}
                noCloseBtn={true}
            >
                <p>
                    <Translate content="account.export_modal.description" />
                </p>
                {state.esNodeCustom ? (
                    <Input
                        type="text"
                        value={state.esNode}
                        onChange={esNodeChange}
                    />
                ) : (
                    <Select
                        showSearch
                        value={state.esNode}
                        onChange={esNodeChange}
                        style={{
                            width: "100%"
                        }}
                    >
                        {esWrapperList.concat([
                            {url: useCustom}
                        ]).map((wrapper: any) => (
                            <Select.Option key={wrapper.url}>
                                {wrapper.url}
                            </Select.Option>
                        ))}
                    </Select>
                )}
            </Modal>

            <div className="generic-bordered-box">
                {dashboard ? null : (
                    <div ref={headerRef}>
                        <div className="block-content-header">
                            <span>
                                {title ? (
                                    title
                                ) : (
                                    <Translate content="account.recent" />
                                )}
                            </span>
                        </div>
                    </div>
                )}
                <div className="header-selector">
                    <div className="filter inline-block">
                        {showFilters ? (
                            <Tooltip
                                placement="bottom"
                                title={counterpart.translate(
                                    "tooltip.filter_ops"
                                )}
                            >
                                <Select
                                    style={{
                                        width: "210px"
                                    }}
                                    value={state.filter}
                                    onChange={onChangeFilter}
                                >
                                    {options}
                                </Select>
                            </Tooltip>
                        ) : null}

                        {historyCount > 0 &&
                        dashboard &&
                        state.esNode !== null ? (
                            <Tooltip
                                placement="bottom"
                                title={counterpart.translate(
                                    "transaction.csv_tip"
                                )}
                            >
                                <a
                                    className="inline-block iconLinkAndLabel"
                                    onClick={showExportModal}
                                    style={{
                                        marginLeft: "1rem"
                                    }}
                                >
                                    <Icon name="excel" size="1x" />
                                    <Translate content="account.download_history" />
                                </a>
                            </Tooltip>
                        ) : null}
                    </div>
                    {state.accountHistoryError && (
                        <div
                            className="has-error"
                            style={{paddingLeft: "0.75rem"}}
                        >
                            <Translate content="account.history_error" />
                        </div>
                    )}
                </div>
                <PaginatedList
                    withTransition
                    className={
                        "table table-striped " +
                        (compactView ? "compact" : "") +
                        (dashboard ? " dashboard-table table-hover" : "")
                    }
                    header={[
                        {
                            title: (
                                <Translate content="account.transactions.id" />
                            ),
                            dataIndex: "id",
                            align: "left",
                            render: (item: any) => {
                                return (
                                    <span style={{whiteSpace: "nowrap"}}>
                                        {item}
                                    </span>
                                );
                            }
                        },
                        !compactView
                            ? {
                                  title: (
                                      <Translate content="account.transactions.type" />
                                  ),
                                  dataIndex: "type",
                                  align: "left"
                              }
                            : {},
                        {
                            title: (
                                <Translate content="account.transactions.info" />
                            ),
                            dataIndex: "info",
                            align: "left",
                            render: (item: any) => {
                                return (
                                    <span
                                        style={{
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        {item}
                                    </span>
                                );
                            }
                        },
                        !hideFee
                            ? {
                                  title: (
                                      <Translate content="account.transactions.fee" />
                                  ),
                                  dataIndex: "fee",
                                  align: "left",
                                  render: (item: any) => {
                                      return (
                                          <span
                                              style={{
                                                  whiteSpace: "nowrap"
                                              }}
                                          >
                                              {item}
                                          </span>
                                      );
                                  }
                              }
                            : {},
                        {
                            title: (
                                <Translate
                                    style={{whiteSpace: "nowrap"} as any}
                                    content="account.transactions.time"
                                />
                            ),
                            dataIndex: "time",
                            render: (item: any) => {
                                return (
                                    <span style={{whiteSpace: "nowrap"}}>
                                        {item}
                                    </span>
                                );
                            }
                        }
                    ]}
                    rows={display_history}
                    label="utility.total_x_operations"
                    extraRow={action}
                />

                {state.fetchingAccountHistory && <LoadingIndicator />}
            </div>
        </div>
    );
}

function resolveAccountsList(prop: any, autosubscribe?: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        if (obj_id) {
            result[index] = (ChainStore as any).getAccount(
                obj_id,
                autosubscribe
            );
        }
        ++index;
    });
    return result;
}

interface RecentTransactionsContainerProps {
    accountsList: any;
    marketDirections?: any;
    [key: string]: any;
}

function RecentTransactionsContainer({
    accountsList,
    ...rest
}: RecentTransactionsContainerProps) {
    useChainStoreTick();
    const settingsState = useAltStore<any>(SettingsStore);

    if (!accountsList || !accountsList.size) {
        return <span />;
    }

    const resolvedAccountsList = resolveAccountsList(accountsList);

    return (
        <RecentTransactionsCore
            {...rest}
            accountsList={resolvedAccountsList}
            marketDirections={settingsState.marketDirections}
        />
    );
}

export {RecentTransactionsContainer as RecentTransactions};

interface TransactionWrapperCoreProps {
    asset: any;
    to: any;
    fromAccount: any;
    children: (props: any) => React.ReactNode;
    [key: string]: any;
}

function TransactionWrapper(props: TransactionWrapperCoreProps) {
    return <span className="wrapper">{props.children(props)}</span>;
}

interface TransactionWrapperContainerProps {
    asset?: any;
    to: any;
    fromAccount: any;
    children: (props: any) => React.ReactNode;
    [key: string]: any;
}

function TransactionWrapperContainer({
    asset = "1.3.0",
    to,
    fromAccount,
    children,
    ...rest
}: TransactionWrapperContainerProps) {
    useChainStoreTick();
    const resolvedAsset = ChainStore.getAsset(asset);
    const resolvedTo = (ChainStore as any).getAccount(to, undefined);
    const resolvedFromAccount = (ChainStore as any).getAccount(
        fromAccount,
        undefined
    );

    if (!resolvedAsset || !resolvedTo || !resolvedFromAccount) {
        return <span />;
    }

    return (
        <TransactionWrapper
            {...rest}
            asset={resolvedAsset}
            to={resolvedTo}
            fromAccount={resolvedFromAccount}
        >
            {children}
        </TransactionWrapper>
    );
}

export {TransactionWrapperContainer as TransactionWrapper};
