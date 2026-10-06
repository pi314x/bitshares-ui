// TypeScript/functional-component port of the legacy Htlc.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md, in a narrower way than it first looks:
// this file itself never calls `HtlcActions.create`/`redeem`/`extend` (the
// real on-chain HTLC-creation/redeem/extend transaction dispatch) - that
// lives entirely in the already-ported `Modal/HtlcModal.tsx`'s `onSubmit`,
// which this file's `showModal`/`<HtlcModal>` rendering only opens.
// `showModal` itself only prefetches the `to`/`from` accounts and the
// transfer asset into `ChainStore`'s cache (via `FetchChainObjects`) before
// revealing the modal with the selected `{type, payload}` operation - that
// prefetch-then-open sequencing is preserved exactly, unchanged.
//
// `shouldComponentUpdate(np, ns)` (comparing `props.currentAccount`,
// `JSON.stringify(state.htlc_list)`, `state.isModalVisible`,
// `state.tableIsLoading`, `state.filterString` against the incoming
// values) is a pure re-render guard with no side effects of its own - but
// it also gates whether `componentDidUpdate` (which unconditionally calls
// `_update()`, per its own comment "always update, relies on push from
// backend when account permission change") gets to run at all. Per this
// migration's established treatment (see `ReportModal.tsx`'s header
// comment for the general rule), the gating half is dropped and the
// `componentDidUpdate` side effect becomes a `useEffect` keyed on exactly
// the same fields `shouldComponentUpdate` compared: `[currentAccount,
// JSON.stringify(state.htlc_list), state.isModalVisible,
// state.tableIsLoading, state.filterString]`, calling `update()` inside -
// this reproduces the gating without reimplementing the boolean logic
// itself, including its recursive "settle" behavior (since `update()`
// itself rewrites `htlc_list`/`tableIsLoading`, which are themselves two
// of this effect's own dependencies, the effect keeps re-firing exactly
// as `componentDidUpdate` would keep getting invoked by React after each
// of `_update()`'s several `setState` calls in the original, until the
// values stop changing).
// `componentDidMount() { this._update(); }` becomes its own, separate
// mount-only `useEffect(() => { update(); }, [])`. Combined with the
// dependency-keyed effect above (which - like every `useEffect` -  also
// runs once after the initial render, regardless of its dependency array
// having "just" been populated for the first time), `update()` ends up
// invoked twice in quick succession on mount here, instead of the
// original class's single `componentDidMount`-only call (the original's
// `componentDidUpdate` never fires on the same mount that
// `componentDidMount` does). This is a genuine, minor behavior difference
// from strict hooks translation of two separately-specified lifecycle
// methods, not a bug in the reasoning above - called out explicitly since
// it doesn't fit this migration's "preserve every quirk exactly" rule.
// It's harmless in practice: `update()` is idempotent (always fully
// recomputes `htlc_list` from the current `currentAccount`/`ChainStore`
// state, with no accumulating side effect), so the extra call just
// re-fetches the same table data once more before it settles.
//
// Preserved verbatim (not "fixed"), several pre-existing bugs/quirks:
// - `hideModal`'s `setState({isModalVisible: false, operation: null})`:
//   `operation` was never a declared state field (the real field is
//   `operationData`) - so this never actually clears the cached operation
//   data, only a dead, undeclared key. Kept as-is via a targeted `as any`
//   cast rather than "fixing" it to clear `operationData`.
// - `render()`'s `dataSource.length && dataSource.filter(...)` - the
//   `.filter(...)` call's own return value is discarded (only the
//   left-hand `dataSource.length &&` short-circuit has any effect), so
//   this whole statement is a no-op; the original's own comment ("if
//   filter is chained to map, possible bugs with initial render of
//   table") is kept alongside it.
// - The `amount` column's `sorter`: reads `a.rawData.op[1].amount.amount`,
//   but `rawData` (a spread of the raw HTLC chain object) has no `op`
//   field anywhere (only `.transfer`/`.conditions`) - clicking to sort by
//   this column would throw at runtime. Transcribed verbatim regardless.
// - `render()`'s `!!this.state.errorMessage` check: `errorMessage` was
//   never a declared state field either (`HtlcState` below has no such
//   key) - always `undefined`, so that error `<span>` can never actually
//   render. Kept via an `as any` read rather than adding a real
//   `errorMessage` field to state.
// - The `console.log("Loading HTLC table for", accountId)` inside
//   `update()` (gated by `__DEV__`) only logs the account id, never a
//   password/private key/brainkey - kept, per AGENTS.md's rule that only
//   logging of actual secret material must be dropped, not all logging.
import * as React from "react";
import {Input} from "../../design-system/Input";
import {Card} from "../../design-system/Card";
import {Col} from "../../design-system/Col";
import {Row} from "../../design-system/Row";
import {Button} from "../../design-system/Button";
import {Icon} from "../../design-system/Icon";
import {Table} from "../../design-system/Table";
import {Tooltip} from "../../design-system/Tooltip";
import counterpart from "counterpart";
import {ChainStore, FetchChainObjects} from "bitsharesjs";
import utils from "common/utils";
import HtlcModal from "../Modal/HtlcModal";
import LinkToAssetById from "../Utility/LinkToAssetById";
import {bindToCurrentAccount} from "../Utility/BindToCurrentAccount";

interface HtlcState {
    isModalVisible: boolean;
    filterString: string;
    operationData: any;
    htlc_list: any[];
    tableIsLoading: boolean;
}

interface HtlcProps {
    currentAccount: any;
}

function Htlc({currentAccount}: HtlcProps) {
    const [state, setState] = React.useState<HtlcState>({
        isModalVisible: false,
        filterString: "",
        operationData: undefined,
        htlc_list: [],
        tableIsLoading: false
    });
    const mergeState = (patch: Partial<HtlcState>) =>
        setState(prev => ({...prev, ...patch}));

    const update = async () => {
        const accountId = currentAccount.get("id");

        if (__DEV__) {
            console.log("Loading HTLC table for", accountId);
        }
        mergeState({
            tableIsLoading: true
        });
        const htlc_from = currentAccount.get("htlcs_from").toJS() || [];
        const htlc_to = currentAccount.get("htlcs_to").toJS() || [];
        mergeState({
            htlc_list: htlc_from
                .concat(htlc_to)
                .map((_item: any) => (ChainStore as any).getObject(_item))
                .map((_item: any) => (!!_item.toJS ? _item.toJS() : undefined)),
            tableIsLoading: false
        });
    };

    // Mirrors componentDidMount: runs once on mount - see file header for
    // why this, combined with the effect below, calls update() twice in
    // quick succession on mount.
    React.useEffect(() => {
        update();
    }, []);

    // Mirrors componentDidUpdate, gated by shouldComponentUpdate's boolean
    // guard - see file header.
    React.useEffect(() => {
        update();
    }, [
        currentAccount,
        JSON.stringify(state.htlc_list),
        state.isModalVisible,
        state.tableIsLoading,
        state.filterString
    ]);

    const showModal = (operation: any) => async () => {
        if (operation.payload) {
            // cache for modal
            await (FetchChainObjects as any)(
                ChainStore.getAccount,
                [operation.payload.transfer.to],
                undefined,
                {}
            );
            await (FetchChainObjects as any)(
                ChainStore.getAccount,
                [operation.payload.transfer.from],
                undefined,
                {}
            );
            await (FetchChainObjects as any)(ChainStore.getAsset, [
                operation.payload.transfer.asset_id
            ]);
        }
        mergeState({
            isModalVisible: true,
            operationData: operation
        });
    };

    const hideModal = () => {
        // `operation` (not `operationData`) below is a pre-existing typo
        // in the original - preserved verbatim, see file header.
        mergeState({
            isModalVisible: false,
            operation: null
        } as any);
    };

    const onFilter = (e: any) => {
        e.preventDefault();
        mergeState({filterString: e.target.value.toLowerCase()});
    };

    const {isModalVisible, htlc_list, operationData, filterString} = state;

    let dataSource: any = null;

    if (htlc_list.length) {
        dataSource = htlc_list.map((item: any) => {
            const to = item.transfer.to;
            const from = item.transfer.from;
            const amount = {
                amount: item.transfer.amount,
                asset_id: item.transfer.asset_id
            };
            const expiration = item.conditions.time_lock.expiration;
            const asset = (ChainStore as any).getAsset(amount.asset_id, false);
            const toAccountName =
                (ChainStore as any).getAccountName(to) || to;
            const fromAccountName =
                (ChainStore as any).getAccountName(from) || from;
            return {
                key: item.id,
                id: item.id,
                type: to == currentAccount.get("id") ? "payee" : "payer",
                from: fromAccountName,
                to: toAccountName,
                amount: (
                    <span>
                        {asset
                            ? (utils as any).get_asset_amount(
                                  amount.amount,
                                  asset
                              ) + " "
                            : null}
                        <LinkToAssetById asset={amount.asset_id} />
                    </span>
                ),
                hash: (
                    <Tooltip
                        title={counterpart.translate(
                            "htlc.preimage_hash_explanation"
                        )}
                    >
                        <span>
                            {"(" +
                                item.conditions.hash_lock.preimage_size +
                                "," +
                                item.conditions.hash_lock.preimage_hash[0] +
                                "): " +
                                item.conditions.hash_lock.preimage_hash[1]}
                        </span>
                    </Tooltip>
                ),
                expires: expiration,
                rawData: {
                    ...item
                }
            };
        });
        // If `filter` is chained to `map`, possible bugs with initial
        // render of table - this call's return value is discarded, so it
        // is (and always was) a no-op; preserved verbatim.
        dataSource.length &&
            dataSource.filter((item: any) => {
                return item.to && item.to.indexOf(filterString) !== -1;
            });
    }

    const columns = [
        {
            title: "#",
            dataIndex: "id",
            key: "id",
            sorter: (a: any, b: any) => {
                return a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
            }
        },
        {
            title: counterpart.translate("showcases.htlc.from"),
            dataIndex: "from",
            key: "from",
            sorter: (a: any, b: any) => {
                return a.from > b.from ? 1 : a.from < b.from ? -1 : 0;
            }
        },
        {
            title: counterpart.translate("showcases.htlc.to"),
            dataIndex: "to",
            key: "to",
            sorter: (a: any, b: any) => {
                return a.to > b.to ? 1 : a.to < b.to ? -1 : 0;
            }
        },
        {
            title: counterpart.translate("showcases.htlc.amount"),
            dataIndex: "amount",
            key: "amount",
            sorter: (a: any, b: any) => {
                const limit1 = a.rawData.op[1].amount.amount;
                const limit2 = b.rawData.op[1].amount.amount;

                return limit1 - limit2;
            }
        },
        {
            title: counterpart.translate("showcases.htlc.hash"),
            dataIndex: "hash",
            key: "hash"
        },
        {
            title: counterpart.translate("showcases.htlc.expires"),
            dataIndex: "expires",
            key: "expires",
            sorter: (a: any, b: any) => {
                return a.expires > b.expires
                    ? 1
                    : a.expires < b.expires
                    ? -1
                    : 0;
            },
            render: (text: any) => {
                return counterpart.localize(
                    new Date((utils as any).makeISODateString(text)),
                    {
                        type: "date",
                        format: "full"
                    }
                );
            }
        },
        {
            title: counterpart.translate("showcases.htlc.actions"),
            dataIndex: "action",
            key: "action",
            render: (text: any, record: any) => {
                if (record.type) {
                    return record.type === "payer" ? (
                        <span>
                            <Button
                                style={{marginRight: "10px"}}
                                onClick={showModal({
                                    type: "extend",
                                    payload: record.rawData
                                })}
                            >
                                {counterpart.translate(
                                    "showcases.htlc.extend"
                                )}
                            </Button>
                        </span>
                    ) : (
                        <span
                            onClick={showModal({
                                type: "redeem",
                                payload: record.rawData
                            })}
                        >
                            <Button>
                                {counterpart.translate(
                                    "showcases.htlc.redeem"
                                )}
                            </Button>
                        </span>
                    );
                } else {
                    return null;
                }
            }
        }
    ];

    return (
        <div className="direct-debit-view">
            <Card className="direct-debit-table-card">
                <Row>
                    <Col span={24} style={{padding: "10px"}}>
                        {/* TABLE HEADER */}
                        <div
                            style={{
                                marginBottom: "30px"
                            }}
                        >
                            <Input
                                className="direct-debit-table__filter-input"
                                placeholder={counterpart.translate(
                                    "explorer.witnesses.filter_by_name"
                                )}
                                onChange={onFilter}
                                style={{
                                    width: "200px",
                                    marginRight: "30px"
                                }}
                                addonAfter={<Icon type="search" />}
                            />
                            <Button
                                onClick={showModal({
                                    type: "create",
                                    payload: null
                                })}
                                style={{
                                    marginRight: "30px"
                                }}
                            >
                                {counterpart.translate(
                                    "showcases.htlc.create_htlc"
                                )}
                            </Button>
                            {!!(state as any).errorMessage && (
                                <span className="red">
                                    {(state as any).errorMessage}
                                </span>
                            )}
                        </div>

                        <Table
                            columns={columns}
                            dataSource={dataSource}
                            pagination={false}
                            className="direct-debit-table"
                            loading={state.tableIsLoading}
                        />
                    </Col>
                </Row>

                {isModalVisible ? (
                    <HtlcModal
                        isModalVisible={isModalVisible}
                        hideModal={hideModal}
                        operation={operationData}
                        fromAccount={currentAccount}
                    />
                ) : null}
            </Card>
        </div>
    );
}

export default bindToCurrentAccount(Htlc);
