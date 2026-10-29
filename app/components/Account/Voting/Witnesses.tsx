// One of the Account Voting screen's tab panes - the witness voting list. The
// vote-adding/removing logic lives in the caller-supplied handler props.
// Joining as a witness and updating the witness are tabs of their own (see
// RoleTabs.tsx), no longer popups opened from here.
import * as React from "react";
import counterpart from "counterpart";
import VotingAccountsList from "../VotingAccountsList";
import cnames from "classnames";
import SearchInput from "../../Utility/SearchInput";
import {Toolbar} from "../../../design-system/Toolbar";
import {Button} from "../../../design-system/Button";
import {JoinWitnessTab, UpdateWitnessTab} from "./RoleTabs";

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
    account?: any;
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
    const [view, setView] = React.useState<"vote" | "join" | "update">("vote");
    const back = () => setView("vote");

    return (
        <div>
            {view === "join" ? (
                <JoinWitnessTab account={account} onDone={back} />
            ) : view === "update" ? (
                <UpdateWitnessTab account={account} onDone={back} />
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
                        <Button onClick={() => setView("join")}>
                            {counterpart.translate(
                                "account.votes.join_witnesses"
                            )}
                        </Button>
                        <Button onClick={() => setView("update")}>
                            {counterpart.translate(
                                "account.votes.update_witness"
                            )}
                        </Button>
                    </Toolbar>
                    <div className={cnames("content-block")}>
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
                </>
            )}
        </div>
    );
}
