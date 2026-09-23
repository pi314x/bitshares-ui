// TypeScript/functional-component port of the legacy Witnesses.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md). One of the Account Voting
// screen's tab panes - the witness voting list. Pure display/local-
// modal-toggle orchestration; the actual vote-adding/removing logic
// lives in the caller-supplied handler props, and the join/update-
// witness flow is delegated unchanged to `JoinWitnessesModal`.
//
// Updated when `AccountVoting.jsx` (this file's only caller) was itself
// ported: dropped the `validateAccountHandler` prop, confirmed fully dead
// end to end (computed in `AccountVoting`, forwarded here to
// `VotingAccountsList`'s `validateAccount` prop, which never reads it -
// see `AccountVoting.tsx`'s header comment for the full trace).
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import VotingAccountsList from "../VotingAccountsList";
import cnames from "classnames";
import {Button} from "bitshares-ui-style-guide";
import JoinWitnessesModal from "../../Modal/JoinWitnessesModal";
import SearchInput from "../../Utility/SearchInput";

const TypedSearchInput = SearchInput as React.ComponentType<any>;

interface WitnessesProps {
    onFilterChange: (e: any) => void;
    addWitnessHandler: (...args: any[]) => any;
    removeWitnessHandler: (...args: any[]) => any;
    all_witnesses: any;
    proxy_witnesses: any;
    witnesses: any;
    proxy_account_id: any;
    hasProxy: boolean;
    globalObject: any;
    filterSearch: string;
    account: any;
}

export default function Witnesses({
    onFilterChange,
    addWitnessHandler,
    removeWitnessHandler,
    all_witnesses,
    proxy_witnesses,
    witnesses,
    proxy_account_id,
    hasProxy,
    globalObject,
    filterSearch,
    account
}: WitnessesProps) {
    const [showCreateWitnessModal, setShowCreateWitnessModal] = React.useState(
        false
    );
    const [
        showCreateWitnessModalUpdate,
        setShowCreateWitnessModalUpdate
    ] = React.useState(false);

    function showWitnessModal() {
        setShowCreateWitnessModalUpdate(false);
        setShowCreateWitnessModal(!showCreateWitnessModal);
    }
    function showUpdateWitnessModal() {
        setShowCreateWitnessModalUpdate(true);
        setShowCreateWitnessModal(!showCreateWitnessModal);
    }

    return (
        <div>
            <div className={cnames("content-block")}>
                <div className="header-selector">
                    <div style={{float: "right"}}>
                        <Button onClick={showWitnessModal}>
                            <Translate content="account.votes.join_witnesses" />
                        </Button>
                        <Button
                            style={{marginLeft: "8px"}}
                            onClick={showUpdateWitnessModal}
                        >
                            <Translate content="account.votes.update_witness" />
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
                <VotingAccountsList
                    type="witness"
                    label="account.votes.add_witness_label"
                    items={all_witnesses}
                    onAddItem={addWitnessHandler}
                    onRemoveItem={removeWitnessHandler}
                    tabIndex={hasProxy ? -1 : 2}
                    supported={hasProxy ? proxy_witnesses : witnesses}
                    active={globalObject.get("active_witnesses")}
                    proxy={proxy_account_id}
                    filterSearch={filterSearch}
                />
            </div>
            <JoinWitnessesModal
                visible={showCreateWitnessModal}
                account={account}
                updateOrCreate={showCreateWitnessModalUpdate}
                hideModal={showWitnessModal}
            />
        </div>
    );
}
