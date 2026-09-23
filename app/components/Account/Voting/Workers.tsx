// TypeScript/functional-component port of the legacy Workers.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md). One of the Account Voting
// screen's tab panes - the worker-proposal voting list. Pure display/
// local-state orchestration; the actual vote-adding/removing logic and
// the worker table's own data live in caller-supplied props and the
// unchanged `WorkersList` child.
//
// Confirmed dead, dropped: the legacy `shouldComponentUpdate` compared
// `nextProps.workerTableIndex` against `this.state.workerTableIndex` as
// its final OR-condition - but `workerTableIndex` was never actually
// destructured from props anywhere in this file (only ever set via
// local state, from `setWorkerTableIndex`), and grepping this
// component's only caller (`AccountVoting.jsx`) confirms it never passes
// a `workerTableIndex` prop either. That means `nextProps.workerTableIndex`
// was always `undefined`, while `this.state.workerTableIndex` was always
// a real number (seeded from `props.viewSettings.get("workerTableIndex",
// 1)`), so that condition - and therefore the whole SCU, since it's
// OR'd with four other conditions - always evaluated `true`. The gate
// was already a complete no-op (equivalent to not having
// `shouldComponentUpdate` at all), not a working optimization this port
// needs to replicate.
import * as React from "react";
import Translate from "react-translate-component";
import WorkersList from "../WorkersList";
import {Link, LinkProps} from "react-router-dom";
import AssetName from "../../Utility/AssetName";
import counterpart from "counterpart";
import {EquivalentValueComponent} from "../../Utility/EquivalentValueComponent";
import FormattedAsset from "../../Utility/FormattedAsset";
import {Row, Col, Radio, Button} from "bitshares-ui-style-guide";
import SearchInput from "../../Utility/SearchInput";

const TypedSearchInput = SearchInput as React.ComponentType<any>;
const TypedLink = Link as React.ComponentType<LinkProps>;

interface WorkersProps {
    vote_ids: any;
    proxy_vote_ids: any;
    hideLegacy: React.ReactNode;
    preferredUnit: string;
    globalObject: any;
    totalBudget: any;
    workerBudget: any;
    hideLegacyProposals: boolean;
    hasProxy: boolean;
    filterSearch: string;
    onFilterChange: (e: any) => void;
    onChangeVotes: (...args: any[]) => any;
    getWorkerArray: (...args: any[]) => any;
    viewSettings: any;
}

export default function Workers({
    vote_ids,
    proxy_vote_ids,
    hideLegacy,
    preferredUnit,
    globalObject,
    totalBudget,
    workerBudget,
    hideLegacyProposals,
    hasProxy,
    filterSearch,
    onFilterChange,
    onChangeVotes,
    getWorkerArray,
    viewSettings
}: WorkersProps) {
    const [workerTableIndex, setWorkerTableIndex] = React.useState(
        viewSettings.get("workerTableIndex", 1)
    );
    const [newWorkersLength, setNewWorkersLength] = React.useState<any>(null);
    const [activeWorkersLength, setActiveWorkersLength] = React.useState<any>(
        null
    );
    const [pollsLength, setPollsLength] = React.useState<any>(null);
    const [expiredWorkersLength, setExpiredWorkersLength] = React.useState<any>(
        null
    );
    const [voteThreshold, setVoteThreshold] = React.useState<any>(null);

    function handleWorkerTableIndexChange(e: any) {
        setWorkerTableIndex(e.target.value);
    }

    // fixme the way WorkersList is injected with workerslist is a complete design fail. use proper controlled component

    return (
        <div>
            <div className="header-selector">
                <div style={{float: "right"}}>
                    <Button>
                        <TypedLink to="/create-worker">
                            <Translate content="account.votes.create_worker" />
                        </TypedLink>
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
                    <Radio.Group
                        defaultValue={1}
                        onChange={handleWorkerTableIndexChange}
                    >
                        <Radio value={0}>
                            {counterpart.translate("account.votes.new", {
                                count: newWorkersLength
                            })}
                        </Radio>

                        <Radio value={1}>
                            {counterpart.translate("account.votes.active", {
                                count: activeWorkersLength
                            })}
                        </Radio>

                        {pollsLength ? (
                            <Radio value={3}>
                                {counterpart.translate("account.votes.polls", {
                                    count: pollsLength
                                })}
                            </Radio>
                        ) : null}

                        {expiredWorkersLength ? (
                            <Radio value={2}>
                                <Translate content="account.votes.expired" />
                            </Radio>
                        ) : null}
                    </Radio.Group>
                </div>

                {hideLegacy}
                <br />
                <br />
                <Row>
                    <Col span={3}>
                        <Translate content="account.votes.threshold" /> (
                        <AssetName name={preferredUnit} />)
                    </Col>
                    <Col
                        span={3}
                        style={{
                            marginLeft: "10px"
                        }}
                    >
                        <FormattedAsset
                            decimalOffset={4}
                            hide_asset
                            amount={voteThreshold}
                            asset="1.3.0"
                        />
                    </Col>
                </Row>
                <Row>
                    <Col span={3}>
                        <Translate content="account.votes.total_budget" /> (
                        <AssetName name={preferredUnit} />)
                    </Col>
                    <Col
                        span={3}
                        style={{
                            marginLeft: "10px"
                        }}
                    >
                        {globalObject ? (
                            <EquivalentValueComponent
                                hide_asset
                                fromAsset="1.3.0"
                                toAsset={preferredUnit}
                                amount={totalBudget}
                            />
                        ) : null}
                    </Col>
                </Row>
            </div>
            <WorkersList
                workerTableIndex={workerTableIndex}
                preferredUnit={preferredUnit}
                setWorkersLength={(
                    _newWorkersLength: any,
                    _activeWorkersLength: any,
                    _pollsLength: any,
                    _expiredWorkersLength: any,
                    _voteThreshold: any
                ) => {
                    if (
                        _newWorkersLength !== newWorkersLength ||
                        _activeWorkersLength !== activeWorkersLength ||
                        _pollsLength !== pollsLength ||
                        _expiredWorkersLength !== expiredWorkersLength ||
                        _voteThreshold !== voteThreshold
                    ) {
                        setNewWorkersLength(_newWorkersLength);
                        setActiveWorkersLength(_activeWorkersLength);
                        setPollsLength(_pollsLength);
                        setExpiredWorkersLength(_expiredWorkersLength);
                        setVoteThreshold(_voteThreshold);
                    }
                }}
                workerBudget={workerBudget}
                hideLegacyProposals={hideLegacyProposals}
                hasProxy={hasProxy}
                proxy_vote_ids={proxy_vote_ids}
                vote_ids={vote_ids}
                onChangeVotes={onChangeVotes}
                getWorkerArray={getWorkerArray}
                filterSearch={filterSearch}
            />
        </div>
    );
}
