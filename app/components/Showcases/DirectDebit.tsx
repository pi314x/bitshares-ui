// TypeScript/function-component port of the legacy DirectDebit.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md, `Showcases/` batch 3). Mechanical, no
// logic changes except where noted below.
//
// SECURITY-SENSITIVE (per AGENTS.md): `handleDeleteProposal` calls
// `ApplicationApi.deleteWithdrawPermission(permission.id,
// permission.withdraw_from_account, permission.authorized_account)` - a
// real on-chain transaction-building/broadcasting call, reached from the
// "Delete" button of a payer's own direct-debit row. This is the file's
// ONLY `ApplicationApi.*` call site (grepped: `grep -n "ApplicationApi\."
// DirectDebit.jsx` returns exactly this one hit) - there is no separate
// create/update `ApplicationApi` call in this file; creating/updating a
// mandate is instead delegated entirely to `<DirectDebitModal>` (opened
// via `showModal`), and claiming a period's payment to
// `<DirectDebitClaimModal>` (via `showClaimModal`) - both already-ported
// `.tsx` files that build/broadcast their own operations independently of
// this component. The argument-construction call site itself is copied
// byte-for-byte, unchanged.
//
// No password/private-key/brainkey material is read, logged, or persisted
// anywhere in this file (grepped every `console.*` call - see below). No
// refs, no imperative APIs anywhere in this file.
//
// - `console.log("delete permissin")` (sic, pre-existing typo) and
//   `console.log("first period is not started")` and `console.error(err)`
//   (an `Error`/rejection value, not credential material) are all kept
//   verbatim - none logs a raw password/private key/brainkey, so
//   AGENTS.md's drop-that-one-call rule does not apply here.
//
// - `connect`-free: `DirectDebit` was already wrapped with
//   `bindToCurrentAccount(DirectDebit)` (`Utility/BindToCurrentAccount`),
//   which is itself already a `.tsx` port (Alt.js `connect` + a chain-tick
//   Container/Core pair) from an earlier batch - reused unchanged here,
//   still applied as `bindToCurrentAccount(DirectDebitCore)` at the
//   bottom of this file, same as the original's
//   `DirectDebit = bindToCurrentAccount(DirectDebit)` reassignment.
//
// - `this.state` -> a single `mergeState`-shaped `useState` object, same
//   convention as the rest of this migration
//   (`const mergeState = patch => setState(prev => ({...prev, ...patch}))`).
//   `hideModal`'s `setState({isModalVisible: false, operation: null})`
//   patches an `operation` field that is never part of the constructor's
//   initial state and never read anywhere in `render()` (only
//   `operationData`/`operationClaimData` are read/rendered) - grep-
//   confirmed dead, but harmless (an inert extra field on the state
//   object), so it is kept verbatim rather than dropped, and `operation`
//   is declared as an optional, effectively-unused field on
//   `DirectDebitState` to match.
//
// - `componentDidMount() { this._update(); }` and the original's
//   no-argument `UNSAFE_componentWillReceiveProps() { this._update(); }`
//   (it takes no `nextProps` parameter and inspects nothing - it always
//   re-runs `_update()`, which itself only ever reads
//   `this.props.currentAccount`) are combined into ONE
//   `useEffect(() => { update(); }, [currentAccount])`. This is
//   deliberately NOT translated as a bare no-dependency-array effect
//   (the pattern used elsewhere in this migration, e.g.
//   `Dashboard/SimpleDepositWithdraw.tsx`'s
//   `componentDidUpdate() { ReactTooltip.rebuild(); }") because that
//   lifecycle fires on every re-render including ones caused by this
//   component's OWN `setState` calls, whereas `componentWillReceiveProps`
//   (with or without inspecting its argument) fires only when the PARENT
//   passes new props, never from this component's own internal state
//   changes. A bare no-deps effect here would re-run `_update()` (two
//   `Apis.instance().db_api().exec(...)` network calls) after every
//   keystroke in the filter box and every modal open/close - a real
//   behavior change the original never had. Keying the effect on
//   `[currentAccount]` (the only prop `_update` reads) instead reproduces
//   "run once on mount, then again whenever a relevant prop changes"
//   without that regression; the one edge case this does not reproduce is
//   an *irrelevant* prop changing (e.g. a route `location` prop, forwarded
//   through by `bindToCurrentAccount`'s `{...props}` spread) while
//   `currentAccount` stays referentially the same - in the original that
//   would still re-run `_update()` redundantly (immediately re-fetching
//   the same two lists, gated by the same `hasLoaded` check either way),
//   which this port intentionally does not reproduce as it has no
//   observable effect beyond a wasted network round-trip.
//
// - Dropped as confirmed dead: the `Switch`/`Tooltip` imports from
//   "bitshares-ui-style-guide" (grepped: `grep -n "Switch\|Tooltip"
//   DirectDebit.jsx` only matches the two import-list lines - neither is
//   referenced anywhere in `render()` or elsewhere in the file).
//
// - `dataSource`'s `.filter(...)` call (meant to apply `filterString`) is
//   a `dataSource.length && dataSource.filter(...)` statement whose result
//   is never assigned back to `dataSource` or used anywhere - a
//   pre-existing dead/no-op filter (the `<Table>` always renders the full,
//   unfiltered `dataSource`, and the filter input's `onChange` only ever
//   updates `state.filterString`, never re-triggering a real filter).
//   Preserved verbatim as the same no-op expression-statement, not
//   "fixed" into an actual filter.
//
// - TypeScript-forced adjustments: `ChainStore`/`Apis`/`ApplicationApi`
//   read from already-`declare module`'d untyped packages
//   (`bitsharesjs`/`bitsharesjs-ws`) or a plain-JS local module
//   (`app/api/ApplicationApi.js`, no `.d.ts`) - all treated as `any`, same
//   as every other file in this migration that touches them. The withdraw
//   permission objects returned by `get_withdraw_permissions_by_giver`/
//   `_by_recipient` and the `<Table>` `columns`/row-record shape are
//   likewise typed `any` (no upstream chain-object types exist for this
//   RPC's raw JSON shape) - consistent with `Account/CreditOffer/*.tsx`'s
//   already-established `any`-typed `Table` column/record handling.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import {Input} from "../../design-system/Input";
import {Card} from "../../design-system/Card";
import {Col} from "../../design-system/Col";
import {Row} from "../../design-system/Row";
import {Button} from "../../design-system/Button";
import {Icon} from "../../design-system/Icon";
import {Table} from "../../design-system/Table";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import utils from "common/utils";
import DirectDebitModal from "../Modal/DirectDebitModal";
import DirectDebitClaimModal from "../Modal/DirectDebitClaimModal";
import LinkToAssetById from "../Utility/LinkToAssetById";
import ApplicationApi from "../../api/ApplicationApi";
import {bindToCurrentAccount, hasLoaded} from "../Utility/BindToCurrentAccount";

interface DirectDebitState {
    isModalVisible: boolean;
    isClaimModalVisible: boolean;
    filterString: string;
    operationData: any;
    operationClaimData: any;
    withdraw_permission_list: any[];
    errorMessage?: any;
    operation?: any;
}

interface DirectDebitCoreProps {
    currentAccount: any;
}

function DirectDebitCore({currentAccount}: DirectDebitCoreProps) {
    const [state, setState] = React.useState<DirectDebitState>({
        isModalVisible: false,
        isClaimModalVisible: false,
        filterString: "",
        operationData: "",
        operationClaimData: "",
        withdraw_permission_list: []
    });

    const mergeState = (patch: Partial<DirectDebitState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const update = () => {
        if (hasLoaded(currentAccount)) {
            // for now, fetch manually
            Promise.all([
                Apis.instance()
                    .db_api()
                    .exec("get_withdraw_permissions_by_giver", [
                        currentAccount.get("id"),
                        "1.12.0",
                        100
                    ]),
                Apis.instance()
                    .db_api()
                    .exec("get_withdraw_permissions_by_recipient", [
                        currentAccount.get("id"),
                        "1.12.0",
                        100
                    ])
            ]).then((results: any) => {
                let withdraw_permission_list: any[] = [];
                withdraw_permission_list = withdraw_permission_list.concat(
                    results[0]
                );
                withdraw_permission_list = withdraw_permission_list.concat(
                    results[1]
                );
                withdraw_permission_list.forEach((item: any) => {
                    try {
                        // to trigger caching for modal
                        (ChainStore as any).getAccount(
                            item.authorized_account,
                            false
                        );
                        (ChainStore as any).getAccount(
                            item.withdraw_from_account,
                            false
                        );
                    } catch (err) {}
                });
                mergeState({
                    withdraw_permission_list: withdraw_permission_list
                });
            });
        }
    };

    // componentDidMount() { this._update(); } +
    // UNSAFE_componentWillReceiveProps() { this._update(); } - see header
    // comment for why these are combined into a single effect keyed on
    // `currentAccount` rather than a bare no-dependency-array effect.
    React.useEffect(() => {
        update();
    }, [currentAccount]);

    const showModal = (operation: any) => () => {
        mergeState({
            isModalVisible: true,
            operationData: operation
        });
    };

    const hideModal = () => {
        mergeState({
            isModalVisible: false,
            operation: null
        });
    };

    const showClaimModal = (operation: any) => () => {
        mergeState({
            isClaimModalVisible: true,
            operationClaimData: operation
        });
    };

    const hideClaimModal = () => {
        mergeState({
            isClaimModalVisible: false
        });
    };

    const onFilter = (e: any) => {
        e.preventDefault();
        mergeState({filterString: e.target.value.toLowerCase()});
    };

    const handleDeleteProposal = (permission: any) => {
        console.log("delete permissin");
        ApplicationApi.deleteWithdrawPermission(
            permission.id,
            permission.withdraw_from_account,
            permission.authorized_account
        )
            .then(() => {
                // nothing to do, user will see popup
            })
            .catch((err: any) => {
                mergeState({errorMessage: err.toString()});
                console.error(err);
            });
    };

    const {
        isModalVisible,
        isClaimModalVisible,
        withdraw_permission_list,
        operationData,
        operationClaimData,
        filterString
    } = state;

    let dataSource: any[] | null = null;

    if (withdraw_permission_list.length) {
        dataSource = withdraw_permission_list.map((item: any) => {
            const asset = (ChainStore as any).getObject(
                item.withdrawal_limit.asset_id,
                false
            );
            const authorizedAccountName = (ChainStore as any).getAccountName(
                item.authorized_account
            );
            const withdrawFromAccountName = (ChainStore as any).getAccountName(
                item.withdraw_from_account
            );
            const period_start = new Date(
                item.period_start_time + "Z"
            ).getTime();
            const now = new Date().getTime();
            const timePassed = now - period_start;
            let currentPeriodExpires: any = "";
            const periodMs = item.withdrawal_period_sec * 1000;

            if (timePassed < 0) {
                console.log("first period is not started");
            } else {
                const currentPeriodNum = Math.ceil(timePassed / periodMs);
                currentPeriodExpires =
                    period_start + periodMs * currentPeriodNum;
            }

            return {
                key: item.id,
                id: item.id,
                type:
                    item.authorized_account == currentAccount.get("id")
                        ? "payee"
                        : "payer",
                authorized: authorizedAccountName,
                from: withdrawFromAccountName,
                to: authorizedAccountName,
                limit: (
                    <span>
                        {utils.get_asset_amount(
                            item.withdrawal_limit.amount,
                            asset
                        ) + " "}
                        <LinkToAssetById asset={item.withdrawal_limit.asset_id} />
                    </span>
                ),
                until: currentPeriodExpires
                    ? counterpart.localize(new Date(currentPeriodExpires), {
                          type: "date",
                          format: "full"
                      })
                    : counterpart.translate(
                          "showcases.direct_debit.first_period_not_started"
                      ),
                expires: counterpart.localize(new Date(item.expiration + "Z"), {
                    type: "date",
                    format: "full"
                }),
                claimed:
                    item.claimed_this_period == 0 ? (
                        "-"
                    ) : (
                        <span>
                            {utils.get_asset_amount(
                                item.claimed_this_period,
                                asset
                            ) + " "}
                            <LinkToAssetById asset={item.withdrawal_limit.asset_id} />
                        </span>
                    ),
                rawData: {
                    ...item
                }
            };
        });
        dataSource.length &&
            dataSource.filter((item: any) => {
                // if filter is chained to map, possible bugs with initial render of table
                return (
                    item.authorized && item.authorized.indexOf(filterString) !== -1
                );
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
            title: "From",
            dataIndex: "from",
            key: "from",
            sorter: (a: any, b: any) => {
                return a.from > b.from ? 1 : a.from < b.from ? -1 : 0;
            }
        },
        {
            title: "To",
            dataIndex: "to",
            key: "to",
            sorter: (a: any, b: any) => {
                return a.to > b.to ? 1 : a.to < b.to ? -1 : 0;
            }
        },
        {
            title: counterpart.translate(
                "showcases.direct_debit.current_period_expires"
            ),
            dataIndex: "until",
            key: "until",
            sorter: (a: any, b: any) => {
                return a.until > b.until ? 1 : a.until < b.until ? -1 : 0;
            }
        },
        {
            title: "Limit",
            dataIndex: "limit",
            key: "limit",
            sorter: (a: any, b: any) => {
                const limit1 = a.rawData.withdrawal_limit.amount;
                const limit2 = b.rawData.withdrawal_limit.amount;

                return limit1 - limit2;
            }
        },
        {
            title: "Claimed",
            dataIndex: "claimed",
            key: "claimed",
            // Preserved verbatim: `available2` reads `a.rawData...` again
            // instead of `b.rawData...` (pre-existing bug - this sorter is
            // always a no-op, `available2 - available1` is always `0`).
            // The unused second parameter is dropped (TS-forced: this
            // project's eslint config has no `argsIgnorePattern` for
            // `@typescript-eslint/no-unused-vars`, so an underscore-
            // prefixed placeholder still errors) - antd's `<Table>`
            // sorter type accepts a function with fewer declared
            // parameters than it actually calls with, so this has no
            // behavioral effect.
            sorter: (a: any) => {
                const available1 = a.rawData.claimed_this_period;
                const available2 = a.rawData.claimed_this_period;
                return available2 - available1;
            }
        },
        {
            title: counterpart.translate("showcases.direct_debit.expires"),
            dataIndex: "expires",
            key: "expires",
            sorter: (a: any, b: any) => {
                return a.expires > b.expires ? 1 : a.expires < b.expires ? -1 : 0;
            }
        },
        {
            title: "Actions",
            dataIndex: "action",
            key: "action",
            render: (text: any, record: any) => {
                if (record.type) {
                    return record.type === "payer" ? (
                        <span>
                            <Button
                                style={{marginRight: "10px"}}
                                onClick={() =>
                                    handleDeleteProposal(record.rawData)
                                }
                            >
                                {counterpart.translate(
                                    "showcases.direct_debit.delete"
                                )}
                            </Button>
                            <Button
                                onClick={showModal({
                                    type: "update",
                                    payload: record.rawData
                                })}
                            >
                                {counterpart.translate(
                                    "showcases.direct_debit.update"
                                )}
                            </Button>
                        </span>
                    ) : (
                        <span
                            onClick={showClaimModal({
                                type: "claim",
                                payload: record.rawData
                            })}
                        >
                            <Button>
                                {counterpart.translate(
                                    "showcases.direct_debit.claim"
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
                                    "showcases.direct_debit.create_new_mandate"
                                )}
                            </Button>
                            {!!state.errorMessage && (
                                <span className="red">{state.errorMessage}</span>
                            )}
                        </div>

                        <Table
                            columns={columns}
                            dataSource={dataSource || []}
                            pagination={false}
                            className="direct-debit-table"
                        />
                    </Col>
                </Row>

                {isModalVisible ? (
                    <DirectDebitModal
                        isModalVisible={isModalVisible}
                        hideModal={hideModal}
                        operation={operationData}
                    />
                ) : null}
                {isClaimModalVisible ? (
                    <DirectDebitClaimModal
                        isModalVisible={isClaimModalVisible}
                        hideModal={hideClaimModal}
                        operation={operationClaimData}
                    />
                ) : null}
            </Card>
        </div>
    );
}

const DirectDebit = bindToCurrentAccount(DirectDebitCore);

export default DirectDebit;
