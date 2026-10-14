// TypeScript/functional-component port of the legacy Committee.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md). One of the Account Voting
// screen's tab panes - the committee-member voting list. Pure display/
// local-modal-toggle orchestration; the actual vote-adding/removing
// logic lives in the caller-supplied handler props, and the
// join-committee flow is delegated unchanged to `JoinCommitteeModal`.
//
// Updated when `AccountVoting.jsx` (this file's only caller) was itself
// ported: dropped the `validateAccountHandler` prop, confirmed fully dead
// end to end (computed in `AccountVoting`, forwarded here to
// `VotingAccountsList`'s `validateAccount` prop, which never reads it -
// see `AccountVoting.tsx`'s header comment for the full trace).
import * as React from "react";
import counterpart from "counterpart";
import VotingAccountsList from "../VotingAccountsList";
import cnames from "classnames";
import SearchInput from "../../Utility/SearchInput";
import {Toolbar} from "../../../design-system/Toolbar";
import {SubMenu} from "../../../design-system/SubMenu";
import {JoinCommitteeTab} from "./RoleTabs";

const TypedSearchInput = SearchInput as React.ComponentType<any>;

interface CommitteeProps {
    onFilterChange: (e: any) => void;
    addCommitteeHandler: (...args: any[]) => any;
    removeCommitteeHandler: (...args: any[]) => any;
    all_committee: any;
    proxy_committee: any;
    committee: any;
    proxy_account_id: any;
    hasProxy: boolean;
    globalObject: any;
    filterSearch: string;
    account?: any;
}

export default function Committee({
    onFilterChange,
    addCommitteeHandler,
    removeCommitteeHandler,
    all_committee,
    proxy_committee,
    committee,
    proxy_account_id,
    hasProxy,
    globalObject,
    filterSearch,
    account
}: CommitteeProps) {
    const [view, setView] = React.useState<"vote" | "join">("vote");

    return (
        <div>
            <SubMenu
                aria-label={counterpart.translate(
                    "explorer.committee_members.title"
                )}
                value={view}
                onChange={key => setView(key as "vote" | "join")}
                items={[
                    {
                        key: "vote",
                        label: counterpart.translate("account.votes.votes")
                    },
                    {
                        key: "join",
                        label: counterpart.translate(
                            "account.votes.join_committee"
                        )
                    }
                ]}
            />
            {view === "join" ? (
                <JoinCommitteeTab
                    account={account}
                    onDone={() => setView("vote")}
                />
            ) : (
                <>
                    <Toolbar>
                        <Toolbar.Grow>
                            <TypedSearchInput
                                placeholder={counterpart.translate(
                                    "explorer.witnesses.filter_by_name"
                                )}
                                value={filterSearch}
                                onChange={onFilterChange}
                            />
                        </Toolbar.Grow>
                    </Toolbar>
                    <div className={cnames("content-block")}>
                        <VotingAccountsList
                            type="committee"
                            label="account.votes.add_committee_label"
                            items={all_committee}
                            onAddItem={addCommitteeHandler}
                            onRemoveItem={removeCommitteeHandler}
                            tabIndex={hasProxy ? -1 : 3}
                            supported={hasProxy ? proxy_committee : committee}
                            active={globalObject.get(
                                "active_committee_members"
                            )}
                            proxy={proxy_account_id}
                            filterSearch={filterSearch}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
