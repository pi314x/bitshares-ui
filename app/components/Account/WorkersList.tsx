// TypeScript/functional-component port of the legacy WorkersList.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `BindToChainState(WorkerList)` is called with no `propTypes` declared
// on the class at all, so it resolves zero chain-type props and has no
// required props (it still unconditionally subscribes to `ChainStore`
// in `componentWillMount`/unsubscribes on unmount, per
// `BindToChainState.jsx`'s own logic, regardless of whether there's
// anything for it to resolve) - replaced by `useChainStoreTick()` in a
// thin Container that otherwise just passes all props through unchanged.
//
// The original class has no `this.state` at all (its constructor is a
// bare `super(props)`), so there is no state to port - every method here
// becomes a plain function reading `props` directly. The dynamic method
// dispatch `this[item.approvalState ? "onReject" : "onApprove"].bind(
// this, item)` becomes a direct ternary call.
//
// Preserved verbatim, not "fixed": the `// fixme: don't call setState in
// render` comment and the `setTimeout(() => setWorkersLength(...), 250)`
// call it documents - a known, pre-existing anti-pattern (calling a
// prop callback that itself likely updates parent state, deferred via
// `setTimeout` from inside `render()`) that this port carries over
// exactly as-is, not something to fix as a side effect of migrating.
//
// One dedup, not a logic change: `getData`'s `budget` object literal had
// `rest: item.rest` listed twice (an identical duplicate key - the
// original's later occurrence silently wins at runtime either way, so
// keeping one copy is behaviorally identical and avoids an
// `no-dupe-keys` lint error in this file).
//
// One TS-forced adjustment: `LinkToAccountById`'s (already-ported)
// `maxDisplayAccountNameLength` prop type is `number | undefined`, not
// `| null`; `null` is passed `undefined` instead here - behaviorally
// identical, since that component's own `maxDisplayAccountNameLength >
// 0 ? 20 : Infinity` gate treats both the same way (neither is `> 0`).
import * as React from "react";
import counterpart from "counterpart";
import utils from "common/utils";
import FormattedAsset from "../Utility/FormattedAsset";
import LinkToAccountById from "../Utility/LinkToAccountById";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {EquivalentValueComponent} from "../Utility/EquivalentValueComponent";
import Icon from "components/Icon/Icon";
import PaginatedList from "components/Utility/PaginatedList";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import stringSimilarity from "string-similarity";
import {hiddenProposals} from "../../lib/common/hideProposals";

interface WorkerListCoreProps {
    workerTableIndex: any;
    preferredUnit: any;
    setWorkersLength: (...args: any[]) => void;
    workerBudget: any;
    hideLegacyProposals: any;
    getWorkerArray: () => any;
    filterSearch: any;
    hasProxy: any;
    proxy_vote_ids: any;
    vote_ids: any;
    onChangeVotes: (addVotes: any[], removeVotes: any[]) => void;
}

function WorkerList(props: WorkerListCoreProps) {
    const {
        workerTableIndex,
        preferredUnit,
        setWorkersLength,
        workerBudget,
        hideLegacyProposals,
        getWorkerArray,
        filterSearch
    } = props;

    const onApprove = (item: any) => {
        const addVotes: any[] = [],
            removeVotes: any[] = [];

        if (item.vote_ids.has(item.worker.get("vote_against"))) {
            removeVotes.push(item.worker.get("vote_against"));
        }

        if (!item.vote_ids.has(item.worker.get("vote_for"))) {
            addVotes.push(item.worker.get("vote_for"));
        }

        props.onChangeVotes(addVotes, removeVotes);
    };

    const onReject = (item: any) => {
        const addVotes: any[] = [],
            removeVotes: any[] = [];

        if (item.vote_ids.has(item.worker.get("vote_against"))) {
            removeVotes.push(item.worker.get("vote_against"));
        }

        if (item.vote_ids.has(item.worker.get("vote_for"))) {
            removeVotes.push(item.worker.get("vote_for"));
        }

        props.onChangeVotes(addVotes, removeVotes);
    };

    const getHeader = (workerTableIndexArg: any, preferredUnitArg: any) => {
        return [
            workerTableIndexArg === 2
                ? null
                : {
                      title: (
                          <Translate
                              component="span"
                              content="account.votes.line"
                              style={{whiteSpace: "nowrap"} as any}
                          />
                      ),
                      dataIndex: "line",
                      align: "right",
                      render: (item: any) => {
                          return (
                              <span
                                  style={{
                                      textAlign: "right",
                                      paddingRight: 10,
                                      paddingLeft: 0,
                                      whiteSpace: "nowrap"
                                  }}
                              >
                                  {item
                                      ? item
                                      : counterpart.translate(
                                            "account.votes.expired"
                                        )}
                              </span>
                          );
                      }
                  },
            {
                title: (
                    <Translate
                        content="account.user_issued_assets.id"
                        style={{whiteSpace: "nowrap"} as any}
                    />
                ),
                dataIndex: "assets_id",
                align: "center",
                sorter: (a: any, b: any) => {
                    return a.assets_id > b.assets_id
                        ? 1
                        : a.assets_id < b.assets_id
                        ? -1
                        : 0;
                },
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                title: (
                    <Translate
                        content="account.user_issued_assets.description"
                        style={{whiteSpace: "nowrap"} as any}
                    />
                ),
                dataIndex: "description",
                align: "left",
                sorter: (a: any, b: any) => {
                    if (a.description.name > b.description.name) {
                        return 1;
                    }
                    if (a.description.name < b.description.name) {
                        return -1;
                    }
                    return 0;
                },
                render: (item: any) => {
                    return (
                        <span>
                            <div
                                className="inline-block"
                                style={{
                                    paddingRight: 5,
                                    position: "relative",
                                    top: -1,
                                    whiteSpace: "nowrap"
                                }}
                            >
                                <a
                                    style={{
                                        visibility:
                                            item.url &&
                                            item.url.indexOf(".") !== -1
                                                ? "visible"
                                                : "hidden"
                                    }}
                                    href={(utils as any).sanitize(item.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Icon
                                        name="share"
                                        size="2x"
                                        title="icons.share"
                                    />
                                </a>
                            </div>
                            <div className="inline-block">
                                {item.name}
                                <br />
                                <LinkToAccountById
                                    account={item.worker_account}
                                    maxDisplayAccountNameLength={undefined}
                                />
                            </div>
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: (
                    <Translate
                        content="account.votes.total_votes"
                        style={{whiteSpace: "nowrap"} as any}
                    />
                ),
                dataIndex: "total_votes",
                align: "right",
                sorter: (a: any, b: any) => {
                    return a.total_votes - b.total_votes;
                },
                render: (item: any) => {
                    return (
                        <FormattedAsset
                            amount={item}
                            asset="1.3.0"
                            decimalOffset={5}
                            hide_asset
                            style={{whiteSpace: "nowrap"} as any}
                        />
                    );
                }
            },
            workerTableIndexArg === 0
                ? {
                      title: (
                          <Translate
                              content="account.votes.missing"
                              style={{whiteSpace: "nowrap"} as any}
                          />
                      ),
                      dataIndex: "missing",
                      align: "right",
                      sorter: (a: any, b: any) => {
                          return a.missing - b.missing;
                      },
                      render: (item: any) => {
                          return (
                              <span
                                  style={{
                                      textAlign: "right",
                                      whiteSpace: "nowrap"
                                  }}
                              >
                                  <FormattedAsset
                                      amount={Math.max(0, item)}
                                      asset="1.3.0"
                                      hide_asset
                                      decimalOffset={5}
                                  />
                              </span>
                          );
                      }
                  }
                : null,
            {
                title: (
                    <Translate
                        content="explorer.workers.period"
                        style={{whiteSpace: "nowrap"} as any}
                    />
                ),
                dataIndex: "period",
                align: "right",
                sorter: (a: any, b: any) => {
                    return (
                        (new Date(a.period.startDate) as any) -
                        (new Date(b.period.startDate) as any)
                    );
                },
                render: (item: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            {item.startDate} - {item.endDate}
                        </span>
                    );
                }
            },
            workerTableIndexArg === 2 || workerTableIndexArg === 0
                ? null
                : {
                      title: (
                          <Translate
                              content="account.votes.funding"
                              style={{whiteSpace: "nowrap"} as any}
                          />
                      ),
                      dataIndex: "funding",
                      align: "right",
                      render: (item: any) => {
                          return (
                              <span
                                  style={{
                                      textAlign: "right",
                                      whiteSpace: "nowrap"
                                  }}
                                  className="hide-column-small"
                              >
                                  {item.isExpired
                                      ? "-"
                                      : (utils as any).format_number(
                                            item.fundedPercent,
                                            2
                                        ) + "%"}
                              </span>
                          );
                      }
                  },
            workerTableIndexArg === 2 || workerTableIndexArg === 0
                ? null
                : {
                      title: (
                          <span>
                              <Translate
                                  content="explorer.witnesses.budget"
                                  style={{whiteSpace: "nowrap"} as any}
                              />
                              <div
                                  style={{
                                      paddingTop: 5,
                                      fontSize: "0.8rem"
                                  }}
                              >
                                  (<AssetName name={preferredUnitArg} />)
                              </div>
                          </span>
                      ),
                      dataIndex: "budget",
                      align: "right",
                      render: (item: any) => {
                          return (
                              <span
                                  style={{
                                      textAlign: "right",
                                      whiteSpace: "nowrap"
                                  }}
                              >
                                  {item.rest <= 0 ? (
                                      item.isExpired ? (
                                          "-"
                                      ) : (
                                          "0.00"
                                      )
                                  ) : (
                                      <EquivalentValueComponent
                                          hide_asset
                                          fromAsset="1.3.0"
                                          toAsset={item.preferredUnit}
                                          amount={item.rest}
                                      />
                                  )}
                              </span>
                          );
                      }
                  },
            {
                className: "column-hide-small",
                title: (
                    <span>
                        <Translate
                            content="account.votes.daily_pay"
                            style={{whiteSpace: "nowrap"} as any}
                        />
                        <div
                            style={{
                                paddingTop: 5,
                                fontSize: "0.8rem"
                            }}
                        >
                            (<AssetName name={preferredUnitArg} />)
                        </div>
                    </span>
                ),
                dataIndex: "daily_pay",
                align: "right",
                sorter: (a: any, b: any) => {
                    return a.daily_pay.daily_pay - b.daily_pay.daily_pay;
                },
                render: (item: any) => {
                    return (
                        <span
                            className={!item.proxy ? "clickable" : ""}
                            style={{whiteSpace: "nowrap"}}
                            onClick={
                                item.proxy
                                    ? () => {}
                                    : () =>
                                          item.approvalState
                                              ? onReject(item)
                                              : onApprove(item)
                            }
                        >
                            <EquivalentValueComponent
                                hide_asset
                                fromAsset="1.3.0"
                                toAsset={item.preferredUnit}
                                amount={item.daily_pay}
                                style={{whiteSpace: "nowrap"} as any}
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: (
                    <Translate
                        content="account.votes.toggle"
                        style={{whiteSpace: "nowrap"} as any}
                    />
                ),
                dataIndex: "toggle",
                align: "right",
                render: (item: any) => {
                    return (
                        <span
                            className={!item.proxy ? "clickable" : ""}
                            style={{whiteSpace: "nowrap"}}
                            onClick={
                                item.proxy
                                    ? () => {}
                                    : () =>
                                          item.approvalState
                                              ? onReject(item)
                                              : onApprove(item)
                            }
                        >
                            {!item.proxy ? (
                                <Icon
                                    name={
                                        item.approvalState
                                            ? "checkmark-circle"
                                            : "minus-circle"
                                    }
                                    title={
                                        item.approvalState
                                            ? "icons.checkmark_circle.approved"
                                            : "icons.minus_circle.disapproved"
                                    }
                                />
                            ) : (
                                <Icon
                                    name="locked"
                                    title="icons.locked.action"
                                />
                            )}
                        </span>
                    );
                }
            }
        ].filter(n => n);
    };

    const getData = (workers: any, voteThresholdArg: any = 0) => {
        const {hasProxy, proxy_vote_ids} = props;
        const vote_ids = hasProxy ? proxy_vote_ids : props.vote_ids;
        voteThresholdArg = voteThresholdArg || 0;
        return workers.map((item: any, index: any) => {
            const worker = item.worker.toJS();
            const rank = index + 1;
            const total_votes =
                worker.total_votes_for - worker.total_votes_against;
            const approvalState = vote_ids.has(worker.vote_for)
                ? true
                : vote_ids.has(worker.vote_against)
                ? false
                : null;

            let fundedPercent = 0;

            if (worker.daily_pay < item.rest) {
                fundedPercent = 100;
            } else if (item.rest > 0) {
                fundedPercent = (item.rest / worker.daily_pay) * 100;
            }

            const startDate = counterpart.localize(
                new Date(worker.work_begin_date + "Z"),
                {type: "date", format: "short_custom"}
            );
            const endDate = counterpart.localize(
                new Date(worker.work_end_date + "Z"),
                {type: "date", format: "short_custom"}
            );

            const now = new Date();
            const isExpired = new Date(worker.work_end_date + "Z") <= now;
            const hasStarted =
                new Date(worker.work_begin_date + "Z") <= now;
            const isProposed =
                (!isExpired && total_votes < voteThresholdArg) ||
                !hasStarted;
            const isPoll = !!item.poll;
            return {
                key: worker.id,
                line: !isPoll && isExpired ? null : !isExpired ? rank : null,
                assets_id: worker.id,
                description: worker,
                total_votes: total_votes,
                missing: voteThresholdArg - total_votes,
                period: {startDate, endDate},
                funding:
                    !isPoll && (isExpired || isProposed)
                        ? null
                        : {isExpired, fundedPercent},
                daily_pay: {
                    preferredUnit: item.preferredUnit,
                    daily_pay: worker.daily_pay,
                    proxy: hasProxy,
                    approvalState,
                    worker: item.worker,
                    vote_ids
                },
                budget:
                    !isPoll && (isExpired || isProposed)
                        ? null
                        : {
                              rest: item.rest,
                              isExpired,
                              preferredUnit: item.preferredUnit
                          },
                toggle: {
                    proxy: hasProxy,
                    approvalState,
                    worker: item.worker,
                    vote_ids
                }
            };
        });
    };

    const getTotalVotes = (worker: any) => {
        return (
            parseInt(worker.get("total_votes_for"), 10) -
            parseInt(worker.get("total_votes_against"), 10)
        );
    };

    const getMappedWorkers = (
        workers: any,
        maxDailyPayout: any,
        filterSearchArg: any
    ) => {
        const now = new Date();
        let remainingDailyPayout = maxDailyPayout;
        let voteThresholdArg: any = undefined;
        const mapped = workers
            .sort((a: any, b: any) => {
                // first sort by votes so payout order is correct
                return getTotalVotes(b) - getTotalVotes(a);
            })
            .map((worker: any) => {
                worker.isOngoing =
                    new Date(worker.get("work_end_date") + "Z") > now &&
                    new Date(worker.get("work_begin_date") + "Z") <= now;
                worker.isUpcoming =
                    new Date(worker.get("work_begin_date") + "Z") > now;
                worker.isExpired =
                    new Date(worker.get("work_end_date") + "Z") <= now;
                const dailyPay = parseInt(worker.get("daily_pay"), 10);
                worker.votes =
                    worker.get("total_votes_for") -
                    worker.get("total_votes_against");
                if (remainingDailyPayout > 0 && worker.isOngoing) {
                    worker.active = true;
                    remainingDailyPayout = remainingDailyPayout - dailyPay;
                    if (remainingDailyPayout <= 0 && !voteThresholdArg) {
                        // remember when workers become inactive
                        voteThresholdArg = worker.votes;
                    }
                    worker.remainingPayout = remainingDailyPayout + dailyPay;
                } else {
                    worker.active = false;
                    worker.remainingPayout = 0;
                }
                return worker;
            })
            .filter((a: any) => {
                const name = a.get("name").toLowerCase();
                return a && name.indexOf(filterSearchArg) !== -1;
            })
            .sort((a: any, b: any) => {
                // sort out expired
                if (a.isExpired !== b.isExpired) {
                    return a.isExpired ? 1 : -1;
                } else {
                    return getTotalVotes(b) - getTotalVotes(a);
                }
            });
        return {
            mappedWorkers: mapped,
            voteThreshold: voteThresholdArg
        };
    };

    const decideRowClassName = (row: any) => {
        return row.toggle.approvalState ? "" : "unsupported";
    };

    const workersHeader = getHeader(workerTableIndex, preferredUnit);

    const workerArray = getWorkerArray();
    const mappedWorkersResult = getMappedWorkers(
        workerArray,
        workerBudget,
        filterSearch
    );
    let mappedWorkers = mappedWorkersResult.mappedWorkers;
    const voteThreshold = mappedWorkersResult.voteThreshold;

    const hideProposals = (filteredWorker: any, compareWith: any) => {
        if (!hideLegacyProposals) {
            return true;
        }

        const duplicated = compareWith.some((worker: any) => {
            const isSimilarName =
                (stringSimilarity as any).compareTwoStrings(
                    filteredWorker.get("name"),
                    worker.get("name")
                ) > 0.8;
            const sameId = worker.get("id") === filteredWorker.get("id");
            const isNewer =
                worker.get("id").substr(5, worker.get("id").length) >
                filteredWorker.get("id").substr(5, worker.get("id").length);
            return isSimilarName && !sameId && isNewer;
        });
        const newDate = new Date();
        const totalVotes =
            filteredWorker.get("total_votes_for") -
            filteredWorker.get("total_votes_against");
        const hasLittleVotes = totalVotes < 2000000000000;
        const hasStartedOverAMonthAgo =
            new Date(filteredWorker.get("work_begin_date") + "Z") <=
            new Date(newDate.setMonth(newDate.getMonth() - 2));

        const manualHidden = hiddenProposals.includes(
            filteredWorker.get("id")
        );

        const hidden =
            ((!!duplicated || hasStartedOverAMonthAgo) && hasLittleVotes) ||
            manualHidden;

        return !hidden;
    };

    const polls = mappedWorkers
        .filter((a: any) => {
            const lowercase = a.get("name").toLowerCase();
            return lowercase.includes("bsip") || lowercase.includes("poll");
        })
        .map((worker: any) => {
            return {
                preferredUnit,
                rest: worker.remainingPayout,
                poll: true,
                worker: worker
            };
        })
        .filter((a: any) => !!a);

    // remove polls
    mappedWorkers = mappedWorkers.filter((a: any) => {
        const lowercase = a.get("name").toLowerCase();
        return !lowercase.includes("bsip") && !lowercase.includes("poll");
    });

    const onGoingWorkers = mappedWorkers.filter((a: any) => {
        return a.isOngoing;
    });
    const activeWorkers = mappedWorkers
        .filter((a: any) => {
            return a.active && a.isOngoing;
        })
        .map((worker: any) => {
            return {
                preferredUnit,
                rest: worker.remainingPayout,
                worker: worker
            };
        })
        .filter((a: any) => !!a);

    const newWorkers = mappedWorkers
        .filter((a: any) => {
            return (
                !a.active && !a.isExpired && hideProposals(a, onGoingWorkers)
            );
        })
        .map((worker: any) => {
            return {
                preferredUnit,
                rest: 0,
                worker: worker
            };
        });

    const expiredWorkers = workerArray
        .filter((a: any) => {
            return a.isExpired;
        })
        .map((worker: any) => {
            return {
                preferredUnit,
                rest: 0,
                worker: worker
            };
        });
    // fixme: don't call setState in render
    setTimeout(() => {
        setWorkersLength(
            newWorkers.length,
            activeWorkers.length,
            polls.length,
            expiredWorkers.length,
            voteThreshold
        );
    }, 250);
    const workers =
        workerTableIndex === 0
            ? newWorkers
            : workerTableIndex === 1
            ? activeWorkers
            : workerTableIndex === 2
            ? expiredWorkers
            : polls;
    return (
        <PaginatedList
            className="table dashboard-table table-hover"
            rowClassName={decideRowClassName}
            rows={getData(workers, voteThreshold)}
            header={workersHeader}
            pageSize={50}
            label="utility.total_x_assets"
            leftPadding="1.5rem"
        />
    );
}

function WorkerListContainer(props: WorkerListCoreProps) {
    useChainStoreTick();
    return <WorkerList {...props} />;
}

export default WorkerListContainer;
