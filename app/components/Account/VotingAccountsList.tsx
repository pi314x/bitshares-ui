// TypeScript/functional-component port of the legacy
// VotingAccountsList.jsx (Phase 3, docs/UI_MIGRATION_PLAN.md). The
// witness/committee-member table used inside the Account Voting screen's
// tab panes (`Committee.tsx`, `Witnesses.tsx`, ported in this phase's
// first slice). Purely display/local-vote-toggle orchestration - clicking
// a row calls the caller-supplied `onAddItem`/`onRemoveItem` props
// (which build and submit the actual vote-change transaction elsewhere),
// this file only decides which handler to call per row and renders the
// table.
//
// Confirmed dead, dropped (verified by reading the whole file - no
// `AccountSelector` or any add-item form is rendered anywhere in
// `render()`): the `selected_item`/`item_name_input`/`error` state, and
// the class's own `onItemChange`/`onItemAccountChange`/`onAddItem`
// methods - all bound in the constructor but never wired to any JSX
// element's event handler. The `error` value computed from this dead
// state in the original `render()` was itself never used in the
// returned JSX either. (Not to be confused with the `onAddItem` *prop*,
// `this.props.onAddItem`, which the file's own per-row vote toggle does
// use - only the internal same-named method was dead.) Also dropped the
// `action` prop (declared with `defaultProps: {action: "remove"}`) -
// never read anywhere; every actual use of the identifier `action` in
// this file is a *local* variable computed per-row inside the
// items-to-rows `.map()`, unrelated to the prop of the same name.
//
// `label` and `tabIndex` are also confirmed dead internally (only ever
// read inside the now-removed `onItemAccountChange`, or not read at all)
// but are kept as accepted-but-unused props: both current callers
// (`Committee.tsx`/`Witnesses.tsx`) still actively supply real values for
// them.
//
// Revisited now that `AccountVoting.jsx` (the ultimate source of these
// props, via `Committee.tsx`/`Witnesses.tsx`) has itself been ported:
// `validateAccount` and `placeholder` are now confirmed dead end to end,
// not just internally - `AccountVoting.tsx` never computes/passes a
// `validateAccount`-equivalent value at all (the closure it used to
// build, `validateAccountHandler`, was itself provably dead - see
// `AccountVoting.tsx`'s header comment), and no caller ever supplied
// `placeholder`. Removed from the props interface entirely rather than
// kept as accepted-but-unused, since nothing supplies them anymore.

import * as React from "react";
import Translate from "react-translate-component";
import Icon from "../Icon/Icon";
import {ChainStore} from "bitsharesjs";
import FormattedAsset from "../Utility/FormattedAsset";
import LinkToAccountById from "../Utility/LinkToAccountById";
import PaginatedList from "components/Utility/PaginatedList";
import utils from "common/utils";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

function getWitnessOrCommittee(type: string, acct: any) {
    let url = "",
        votes: any = 0,
        account;
    if (type === "witness") {
        account = (ChainStore as any).getWitnessById(acct.get("id"));
    } else if (type === "committee") {
        account = (ChainStore as any).getCommitteeMemberById(acct.get("id"));
    }

    url = account ? account.get("url") : url;
    url = (utils as any).sanitize(url);
    votes = account ? account.get("total_votes") : votes;
    return {
        url,
        votes,
        id: account.get("id")
    };
}

function accountItemRow(props: any) {
    const {account, type, action, isActive, idx, proxy, onAction, key} = props;
    const item_id = account.get("id");

    const {url, votes} = getWitnessOrCommittee(type, account);

    const link =
        url && url.length > 0 && url.indexOf("http") === -1
            ? "http://" + url
            : url;
    const isSupported = action === "remove";

    return {
        key,
        num: idx + 1,
        name: account.get("id"),
        about: link && link.indexOf(".") !== -1 ? link : null,
        votes,
        title: `account.votes.${isActive ? "active_short" : "inactive"}`,
        supported: {
            translate: `settings.${isSupported ? "yes" : "no"}`,
            proxy,
            item_id,
            onAction
        },
        toggle: {proxy, isSupported, item_id, onAction}
    };
}

function getHeader() {
    const cw = ["10%", "20%", "40%", "20%", "10%"];
    return [
        {
            title: "#",
            dataIndex: "num",
            align: "right",
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
        {
            title: <Translate content="account.votes.name" />,
            dataIndex: "name",
            align: "left",
            sorter: (a: any, b: any) => {
                return a.key > b.key ? 1 : a.key < b.key ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: cw[1],
                            whiteSpace: "nowrap"
                        }}
                    >
                        <LinkToAccountById account={item} />
                    </span>
                );
            }
        },
        {
            title: <Translate content="account.votes.about" />,
            dataIndex: "about",
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: cw[2],
                            whiteSpace: "nowrap"
                        }}
                    >
                        <a href={item} target="_blank" rel="noopener noreferrer">
                            <Icon name="share" title="icons.share" />
                        </a>
                    </span>
                );
            }
        },
        {
            title: <Translate content="account.votes.votes" />,
            dataIndex: "votes",
            sorter: (a: any, b: any) => a.votes - b.votes,
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: cw[3],
                            whiteSpace: "nowrap"
                        }}
                    >
                        <FormattedAsset
                            amount={item}
                            asset="1.3.0"
                            decimalOffset={5}
                            hide_asset
                        />
                    </span>
                );
            }
        },
        {
            title: <Translate content="account.votes.status.title" />,
            dataIndex: "title",
            sorter: (a: any, b: any) => {
                return a.title > b.title ? 1 : a.title < b.title ? -1 : 0;
            },
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: cw[4],
                            whiteSpace: "nowrap"
                        }}
                    >
                        <Translate content={item} />
                    </span>
                );
            }
        },
        {
            title: <Translate content="account.votes.supported" />,
            dataIndex: "supported",
            align: "center",
            sorter: (a: any, b: any) => {
                return a.supported.translate > b.supported.translate
                    ? 1
                    : a.supported.translate < b.supported.translate
                    ? -1
                    : 0;
            },
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: cw[0],
                            whiteSpace: "nowrap"
                        }}
                        className={item.proxy ? "" : "clickable"}
                        onClick={
                            item.proxy
                                ? () => {}
                                : () => item.onAction(item.item_id)
                        }
                    >
                        <Translate content={item.translate} />
                    </span>
                );
            }
        },
        {
            title: <Translate content="account.votes.toggle" />,
            dataIndex: "toggle",
            render: (item: any) => {
                return (
                    <span
                        style={{
                            maxWidth: (cw as any)[5],
                            whiteSpace: "nowrap"
                        }}
                        className={item.proxy ? "" : "clickable"}
                        onClick={
                            item.proxy
                                ? () => {}
                                : () => item.onAction(item.item_id)
                        }
                    >
                        {!item.proxy ? (
                            <Icon
                                name={
                                    item.isSupported
                                        ? "checkmark-circle"
                                        : "minus-circle"
                                }
                                title={
                                    item.isSupported
                                        ? "icons.checkmark_circle.yes"
                                        : "icons.minus_circle.no"
                                }
                            />
                        ) : (
                            <Icon name="locked" title="icons.locked.action" />
                        )}
                    </span>
                );
            }
        }
    ];
}

function decideRowClassName(row: any) {
    return row.toggle.isSupported ? "" : "unsupported";
}

interface VotingAccountsListProps {
    items: any;
    onAddItem: (...args: any[]) => any;
    onRemoveItem: (...args: any[]) => any;
    label: string;
    tabIndex?: number;
    filterSearch?: string | null;
    type: string;
    supported?: any;
    active: any;
    proxy?: any;
}

export default function VotingAccountsList({
    items,
    onAddItem,
    onRemoveItem,
    filterSearch = null,
    type,
    supported,
    active,
    proxy
}: VotingAccountsListProps) {
    useChainStoreTick();

    if (!items) return null;

    const header = getHeader();

    const resolvedItems = items.map((id: string) => ChainStore.getObject(id));

    const item_rows = resolvedItems
        .filter((i: any) => {
            if (!i) return false;
            if (filterSearch) {
                if (
                    i.get("name").indexOf(filterSearch) !== -1 ||
                    i.get("id").indexOf(filterSearch) !== -1
                ) {
                    return true;
                } else {
                    return false;
                }
            }
            return true;
        })
        .sort((a: any, b: any) => {
            const {votes: a_votes} = getWitnessOrCommittee(type, a);
            const {votes: b_votes} = getWitnessOrCommittee(type, b);
            if (a_votes !== b_votes) {
                return parseInt(b_votes, 10) - parseInt(a_votes, 10);
            } else if (a.get("name") > b.get("name")) {
                return 1;
            } else if (a.get("name") < b.get("name")) {
                return -1;
            } else {
                return 0;
            }
        })
        .map((i: any, idx: number) => {
            const action =
                supported && supported.includes(i.get("id"))
                    ? "remove"
                    : "add";
            const isActive = active.includes(
                getWitnessOrCommittee(type, i).id
            );
            return accountItemRow({
                idx,
                key: i.get("name"),
                account: i,
                type,
                onAction: action === "add" ? onAddItem : onRemoveItem,
                isSelected: resolvedItems.indexOf(i) !== -1,
                action,
                isActive,
                proxy
            });
        });

    return (
        <div>
            {item_rows.length ? (
                <PaginatedList
                    className="table dashboard-table table-hover"
                    rowClassName={decideRowClassName}
                    rows={item_rows}
                    header={header}
                    pageSize={20}
                    label="utility.total_x_assets"
                    leftPadding="1.5rem"
                />
            ) : null}
        </div>
    );
}
