// TypeScript/functional-component port of the legacy
// PredictionMarketDetailsTable.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive check per AGENTS.md: grepped this file for
// `Actions\.`/`Api\.`/`WalletApi`/`WalletDb`/`ApplicationApi`/
// `add_type_operation`/`process_transaction` - none appear. This is a
// pure display/table component: its "action" column just calls the
// `onOppose`/`onCancel` prop callbacks it's handed with the row's data,
// it never builds, signs or submits a transaction itself (the real
// caller, `PredictionMarkets.jsx`'s `onOppose`/`onCancelOpinion`, does
// that - out of scope, not touched by this batch). No wallet-unlock/
// key/password/brainkey handling anywhere in this file.
//
// Structural change: the original was a plain `Component` with no
// constructor/state and no `ChainStore.subscribe` of its own (unlike
// several other files in this migration, it does NOT extend
// `BindToChainState` and never calls `useChainStoreTick`'s legacy
// equivalent) - it only reads `ChainStore.getAccount(...)` synchronously
// inside `render()`/sorter callbacks, relying on the parent re-rendering
// it (`PredictionMarkets.jsx` itself does subscribe to chain state via
// `connect`) to pick up fresher data. Ported as a plain function
// component with no hooks at all, preserving that same "re-renders only
// when the parent re-renders" behavior exactly.
//
// `currentAccount` (`ChainTypes.ChainAccount.isRequired` in the
// original) is never resolved by a `BindToChainState` wrap in this file
// either - the real caller (`PredictionMarkets.jsx`, wrapped in
// `bindToCurrentAccount`) already passes an already-resolved
// `Immutable.Map` account object with a working `.get("id")`, so this
// prop is typed loosely as `any` rather than re-implementing chain
// resolution that was never present here.
//
// Preserved verbatim (not "cleaned up"): the `sorter_inactive` key used
// on several columns (`order_id`, `opinionator`, `opinion`, `premium`,
// `commission`, `potentialProfit`) is not part of antd `Table`'s column
// API (only `sorter` is read) - these columns are therefore
// intentionally non-sortable in the UI while still carrying a comparator
// function that is never invoked; kept as inert data exactly as in the
// original rather than removed, since it's config data, not a dead
// variable/method.
//
// `predictionMarketData` defaults to `{}` per the original's
// `defaultProps`, even though `render()` unconditionally does
// `.opinions.filter(...)` on it (which would throw if that default were
// ever actually hit) - in practice the sole real caller only ever
// renders this component when `predictionMarketData.opinions` is
// already populated, so this was never exercised; preserved as-is
// rather than "fixed" defensively.
import * as React from "react";
import counterpart from "counterpart";
import LinkToAccountById from "../Utility/LinkToAccountById";
import {Button} from "../../design-system/Button";
import {Icon} from "../../design-system/Icon";
import {Tooltip} from "../../design-system/Tooltip";
import {ChainStore} from "bitsharesjs";
import PaginatedList from "components/Utility/PaginatedList";
import FormattedAsset from "../Utility/FormattedAsset";

interface PredictionMarketDetailsTableProps {
    predictionMarketData?: any;
    onOppose: (dataItem: any) => void;
    onCancel: (dataItem: any) => void;
    currentAccount: any;
    detailsSearchTerm?: string;
    opinionFilter?: string;
}

function getHeader(
    currentAccount: any,
    opinionFilter: string | undefined,
    onOppose: (dataItem: any) => void,
    onCancel: (dataItem: any) => void
): any[] {
    const currentAccountId = currentAccount.get("id");
    return [
        {
            title: "#",
            dataIndex: "order_id",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                return a.order_id > b.order_id
                    ? 1
                    : a.order_id < b.order_id
                        ? -1
                        : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <span>{item}</span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.details.predictor"),
            dataIndex: "opinionator",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                const a_name = (ChainStore as any)
                    .getAccount(a.opinionator)
                    .get("name");
                const b_name = (ChainStore as any)
                    .getAccount(b.opinionator)
                    .get("name");
                return a_name > b_name ? 1 : a_name < b_name ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <LinkToAccountById account={item} />
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.details.prediction"),
            dataIndex: "opinion",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                return a.opinion > b.opinion
                    ? 1
                    : a.opinion < b.opinion
                        ? -1
                        : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <span>
                            {counterpart.translate(
                                "prediction.details." +
                                    (item == "yes"
                                        ? "proves_true"
                                        : "incorrect")
                            )}
                        </span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate(
                "prediction.details.predicated_likelihood"
            ),
            dataIndex: "likelihood",
            align: "left",
            sortOrder: opinionFilter == "yes" ? "descend" : "ascend",
            sorter: (a: any, b: any) => {
                return a.likelihood > b.likelihood
                    ? 1
                    : a.likelihood < b.likelihood
                        ? -1
                        : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <span>{(item * 100).toPrecision(3)}%</span>
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.details.premium"),
            dataIndex: "premium",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                return a.amount > b.amount ? 1 : a.amount < b.amount ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                        />
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.details.commission"),
            dataIndex: "commission",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                return a.fee > b.fee ? 1 : a.fee < b.fee ? -1 : 0;
            },
            render: (item: any, row: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                        />
                        &nbsp;(
                        {(
                            (row.commission.amount / row.premium.amount) *
                            100
                        ).toPrecision(3)}
                        %)
                    </div>
                );
            }
        },
        {
            title: counterpart.translate(
                "prediction.details.potential_profit"
            ),
            dataIndex: "potentialProfit",
            align: "left",
            sorter_inactive: (a: any, b: any) => {
                return a.amount > b.amount ? 1 : a.amount < b.amount ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <div
                        style={{
                            whiteSpace: "nowrap"
                        }}
                    >
                        <FormattedAsset
                            amount={item.amount}
                            asset={item.asset_id}
                        />
                    </div>
                );
            }
        },
        {
            title: counterpart.translate("prediction.overview.action"),
            align: "left",
            render: (dataItem: any) => {
                return (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "right"
                        }}
                    >
                        {currentAccountId &&
                        dataItem.opinionator === currentAccountId ? (
                            <Button
                                onClick={() => {
                                    onCancel(dataItem);
                                }}
                            >
                                {counterpart.translate(
                                    "prediction.details.cancel"
                                )}
                            </Button>
                        ) : (
                            <React.Fragment>
                                <span>
                                    <Tooltip
                                        title={counterpart.translate(
                                            dataItem.opinion == "yes"
                                                ? "prediction.tooltips.oppose_proves_true"
                                                : "prediction.tooltips.oppose_is_incorrect"
                                        )}
                                    >
                                        <Icon
                                            style={{
                                                fontSize: "1.3rem",
                                                marginRight: "0.5rem"
                                            }}
                                            type="question-circle"
                                            theme="filled"
                                        />
                                    </Tooltip>
                                    <Button
                                        onClick={() => {
                                            onOppose(dataItem);
                                        }}
                                    >
                                        {counterpart.translate(
                                            "prediction.details.oppose"
                                        )}
                                    </Button>
                                </span>
                            </React.Fragment>
                        )}
                    </div>
                );
            }
        }
    ];
}

export default function PredictionMarketDetailsTable({
    predictionMarketData = {},
    onOppose,
    onCancel,
    currentAccount,
    detailsSearchTerm,
    opinionFilter
}: PredictionMarketDetailsTableProps) {
    const header = getHeader(currentAccount, opinionFilter, onOppose, onCancel);

    let filteredOpinions = predictionMarketData.opinions.filter(
        (item: any) => {
            const accountName = (ChainStore as any).getAccount(item.opinionator)
                ? (ChainStore as any).getAccount(item.opinionator).get("name")
                : null;
            if (detailsSearchTerm) {
                if (
                    (accountName + "\0" + item.opinion)
                        .toUpperCase()
                        .indexOf(detailsSearchTerm) === -1
                ) {
                    return false;
                }
            }
            if (opinionFilter) {
                if (opinionFilter == "all") {
                    return true;
                } else {
                    if (!(opinionFilter == item.opinion)) {
                        return false;
                    }
                }
            }
            return true;
        }
    );

    let i = 0;
    filteredOpinions = filteredOpinions.map((item: any) => ({
        ...item,
        key: `${item.order_id}${i++}`
    }));

    return (
        <PaginatedList rows={filteredOpinions} header={header} pageSize={10} />
    );
}
