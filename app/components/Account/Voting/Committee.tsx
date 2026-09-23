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
import Translate from "react-translate-component";
import JoinCommitteeModal from "../../Modal/JoinCommitteeModal";
import VotingAccountsList from "../VotingAccountsList";
import cnames from "classnames";
import {Button} from "bitshares-ui-style-guide";
import SearchInput from "../../Utility/SearchInput";

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
    account: any;
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
    const [showCreateCommitteeModal, setShowCreateCommitteeModal] = React.useState(
        false
    );

    function showCommitteeModal() {
        console.log("show committee modal");
        setShowCreateCommitteeModal(!showCreateCommitteeModal);
    }

    return (
        <div>
            <div className="header-selector">
                <div style={{float: "right"}}>
                    <Button onClick={showCommitteeModal}>
                        <Translate content="account.votes.join_committee" />
                    </Button>
                </div>

                <div className="selector inline-block">
                    <TypedSearchInput
                        placeholder={counterpart.translate(
                            "explorer.witnesses.filter_by_name"
                        )}
                        value={filterSearch}
                        onChange={onFilterChange}
                    />
                </div>
            </div>
            <div className={cnames("content-block")}>
                <VotingAccountsList
                    type="committee"
                    label="account.votes.add_committee_label"
                    items={all_committee}
                    onAddItem={addCommitteeHandler}
                    onRemoveItem={removeCommitteeHandler}
                    tabIndex={hasProxy ? -1 : 3}
                    supported={hasProxy ? proxy_committee : committee}
                    active={globalObject.get("active_committee_members")}
                    proxy={proxy_account_id}
                    filterSearch={filterSearch}
                />
            </div>
            <JoinCommitteeModal
                visible={showCreateCommitteeModal}
                account={account}
                hideModal={showCommitteeModal}
            />
        </div>
    );
}
