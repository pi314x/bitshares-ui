// TypeScript/functional-component port of the legacy CommitteeMembers.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Renders the
// "/explorer/committee-members" tab's ranked table. Read-only public
// chain-explorer data, same lower-risk category as Blocks.tsx - no
// separate pure-function module or fixture test.
//
// The legacy file split this into two BindToChainState-wrapped classes
// (CommitteeMemberList, CommitteeMembers) purely to apply two different
// loading-gate behaviors (`show_loader: true` vs. the default). Since
// this port replaces BindToChainState with direct ChainStore reads, both
// gates are just two early returns in one component now - no need to
// keep the split, which existed for HOC convenience, not application
// logic.
//
// One BindToChainState artifact intentionally NOT replicated: its
// chain_objects_list resolution has an off-by-one bug where the first
// resolved item lands at array index 1, not 0 (`++index` runs before the
// assignment). The legacy code's `committee_members[1]` loading-gate
// check was written to compensate for that bug, not because index 1 is
// meaningful - the actual table rows (built with .filter()/.map(), which
// skip the resulting sparse index-0 hole) are unaffected either way. This
// port resolves members into a normal 0-indexed array, so the equivalent
// gate checks index 0.
//
// Two more things dropped, confirmed dead by reading the whole render
// method: `cardView`/`cardViewCommittee` (fetched from SettingsStore but
// never read in render or state), and a local `activeCommitteeMembers`
// array that was built from `globalObject.active_committee_members` via
// a redundant for-in copy and then never used - the render already reads
// `globalObject.active_committee_members` directly.
//
// Not changed: the search placeholder's translation key is
// "explorer.witnesses.filter_by_name" (Witnesses', not this screen's own)
// in the legacy source - looks like a copy-paste content bug, but fixing
// displayed text isn't part of a structural port, so it's left as-is.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {Table} from "bitshares-ui-style-guide";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import FormattedAsset from "../Utility/FormattedAsset";
import SearchInput from "../Utility/SearchInput";
import LoadingIndicator from "../LoadingIndicator";
import utils from "common/utils";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

// SearchInput is an untyped legacy JS component whose defaultProps aren't
// picked up by TypeScript's structural inference over its destructured
// props, so every prop looks required. Same treatment as Blocks.tsx's
// TypedLink: widen to `any` for this known-untyped component rather than
// passing props it doesn't need.
const TypedSearchInput = SearchInput as React.ComponentType<any>;

interface CommitteeMemberRow {
    key: string;
    rank: number;
    name: string;
    votes: any;
    url: string;
}

export default function CommitteeMembers() {
    useChainStoreTick();
    const settingsState = useAltStore<any>(SettingsStore);
    const viewSettings = settingsState.viewSettings;

    const [filterCommitteeMember, setFilterCommitteeMember] = React.useState<
        string
    >(() => viewSettings.get("filterCommitteeMember") || "");

    function onFilter(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toLowerCase();
        setFilterCommitteeMember(value);
        SettingsActions.changeViewSetting({filterCommitteeMember: value});
    }

    const globalObject = ChainStore.getObject("2.0.0");
    if (!globalObject) {
        return <span />;
    }

    const memberIds: string[] = globalObject.get("active_committee_members").toJS();
    const resolvedMembers = memberIds.map(id => ChainStore.getObject(id));

    if (!(resolvedMembers.length > 0 && resolvedMembers[0])) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    const ranks: {[id: string]: number} = {};
    resolvedMembers
        .filter(a => !!a && memberIds.indexOf(a.get("id")) !== -1)
        .forEach((c, index) => {
            if (c) ranks[c.get("id")] = index + 1;
        });

    const dataSource: CommitteeMemberRow[] = resolvedMembers
        .filter(a => {
            if (!a) return false;
            const account = ChainStore.getObject(
                a.get("committee_member_account")
            );
            if (!account) return false;
            const accountData = ChainStore.getCommitteeMemberById(
                account.get("id")
            );
            if (!accountData) return false;
            return account.get("name").indexOf(filterCommitteeMember || "") !== -1;
        })
        .map(a => {
            const account = ChainStore.getObject(
                a.get("committee_member_account")
            );
            const accountData = ChainStore.getCommitteeMemberById(
                account.get("id")
            );
            return {
                key: a.get("id"),
                rank: ranks[a.get("id")],
                name: account.get("name"),
                votes: accountData.get("total_votes"),
                url: utils.sanitize(accountData.get("url"))
            };
        });

    const columns = [
        {
            key: "#",
            title: "#",
            dataIndex: "rank",
            sorter: (a: CommitteeMemberRow, b: CommitteeMemberRow) => {
                return a.rank > b.rank ? 1 : a.rank < b.rank ? -1 : 0;
            }
        },
        {
            key: "name",
            title: "NAME",
            dataIndex: "name",
            sorter: (a: CommitteeMemberRow, b: CommitteeMemberRow) => {
                return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
            }
        },
        {
            key: "votes",
            title: "VOTES",
            dataIndex: "votes",
            render: (item: any) => (
                <FormattedAsset amount={item} asset="1.3.0" decimalOffset={5} />
            ),
            sorter: (a: CommitteeMemberRow, b: CommitteeMemberRow) => {
                return a.votes > b.votes ? 1 : a.votes < b.votes ? -1 : 0;
            }
        },
        {
            key: "url",
            title: "WEBPAGE",
            dataIndex: "url",
            render: (item: string) => (
                <a href={item} target="_blank" rel="noopener noreferrer">
                    {item}
                </a>
            )
        }
    ];

    return (
        <div className="grid-block">
            <div className="grid-block vertical medium-horizontal">
                <div className="grid-block vertical">
                    <div className="grid-content">
                        <TypedSearchInput
                            placeholder={counterpart.translate(
                                "explorer.witnesses.filter_by_name"
                            )}
                            value={filterCommitteeMember}
                            onChange={onFilter}
                            style={{
                                width: "200px",
                                marginBottom: "12px",
                                marginTop: "4px"
                            }}
                        />
                        <Table
                            columns={columns}
                            dataSource={dataSource}
                            pagination={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
