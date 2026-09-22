// TypeScript/functional-component port of the legacy Witnesses.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Renders the "/explorer/witnesses"
// tab. Same lower-risk category as Blocks.tsx/CommitteeMembers.tsx
// (read-only public chain data) - no separate pure-function module or
// fixture test, and the same off-by-one BindToChainState loading-gate
// artifact intentionally not replicated (see CommitteeMembers.tsx's
// header comment for the full explanation).
//
// The legacy file split this into three pieces (WitnessRow, WitnessList,
// Witnesses) for HOC convenience, same as CommitteeMembers.jsx -
// collapsed into one component here. But this file also had more
// substantial dead code than CommitteeMembers.jsx, all confirmed by
// reading every render method fully (not just grepping the declaring
// site):
// - `WitnessRow`, a whole class (~70 lines) building a `<tr>` per
//   witness, was never rendered anywhere - the actual table uses antd's
//   `<Table>` with a `dataSource` array and `columns` config instead,
//   evidently from a later refactor that left WitnessRow orphaned.
// - `_toggleView()` and the `cardView` state/prop it threaded through
//   (`Witnesses` -> `WitnessList`) were never read by anything.
// - `_setSort()` and the `sortBy`/`inverseSort` state it drove were
//   likewise dead - the antd `Table`'s own per-column `sorter` functions
//   handle sorting interactively; nothing in the render path consults
//   this component's own sort state.
import * as React from "react";
import counterpart from "counterpart";
import classNames from "classnames";
import {useHistory} from "react-router-dom";
import {ChainStore} from "bitsharesjs";
import {Table, Icon, Popover} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import FormattedAsset from "../Utility/FormattedAsset";
import TimeAgo from "../Utility/TimeAgo";
import SearchInput from "../Utility/SearchInput";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import utils from "common/utils";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import "./witnesses.scss";

// Same untyped-legacy-component treatment as CommitteeMembers.tsx's
// TypedSearchInput.
const TypedSearchInput = SearchInput as React.ComponentType<any>;

interface WitnessRow {
    id: string;
    key: string;
    rank: number;
    name: string;
    signing_key: any;
    url: string;
    lastConfirmedBlock: {id: any; timestamp: number};
    blocksMissed: any;
    votes: any;
}

function urlValid(item: string): boolean {
    const regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
    return regex.test(item);
}

function urlRender(item: string) {
    return (
        <Popover
            content={
                <a href={item} target="_blank" rel="noopener noreferrer">
                    {item}
                </a>
            }
            trigger={"hover"}
        >
            <Icon type="link" />
        </Popover>
    );
}

function keyRender(item: any) {
    return (
        <Popover content={<span>{item}</span>} trigger={"hover"}>
            <Icon type="key" />
        </Popover>
    );
}

export default function Witnesses() {
    useChainStoreTick();
    const history = useHistory();
    const settingsState = useAltStore<any>(SettingsStore);
    const viewSettings = settingsState.viewSettings;

    const [filterWitness, setFilterWitness] = React.useState<string>(
        () => viewSettings.get("filterWitness") || ""
    );

    function onFilter(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toLowerCase();
        setFilterWitness(value);
        SettingsActions.changeViewSetting({filterWitness: value});
    }

    function handleBlockIdClick(blockId: any) {
        return () => {
            history.push(`/block/${blockId}`);
        };
    }

    const globalObjectImm = ChainStore.getObject("2.0.0");
    const dynGlobalObjectImm = ChainStore.getObject("2.1.0");
    if (!globalObjectImm || !dynGlobalObjectImm) {
        return <span />;
    }
    const globalObject = globalObjectImm.toJS();
    const dynGlobalObject = dynGlobalObjectImm.toJS();

    const current = ChainStore.getObject(dynGlobalObject.current_witness);
    const currentAccount = current
        ? ChainStore.getObject(current.get("witness_account"))
        : null;
    const currentId = current ? current.get("id") : null;

    const witnessIds: string[] = globalObject.active_witnesses;
    const resolvedWitnesses = witnessIds.map(id => ChainStore.getObject(id));

    const ranks: {[id: string]: number} = {};
    resolvedWitnesses
        .filter((a: any) => a && witnessIds.indexOf(a.get("id")) !== -1)
        .sort((a: any, b: any) => {
            return (
                parseInt(b.get("total_votes"), 10) -
                parseInt(a.get("total_votes"), 10)
            );
        })
        .forEach((w: any, index: number) => {
            ranks[w.get("id")] = index + 1;
        });

    let dataSource: WitnessRow[] = [];
    if (resolvedWitnesses.length > 0 && resolvedWitnesses[0]) {
        dataSource = resolvedWitnesses
            .filter((a: any) => {
                if (!a) return false;
                const witness = ChainStore.getObject(a.get("witness_account"));
                if (!witness) return false;
                const witnessData = ChainStore.getWitnessById(witness.get("id"));
                if (!witnessData) return false;
                const name = witness.get("name");
                if (!name) return false;
                return name.indexOf(filterWitness) !== -1;
            })
            .map((a: any) => {
                const witness = ChainStore.getObject(a.get("witness_account"));
                const witnessData = ChainStore.getWitnessById(witness.get("id"));
                const witnessAslot = witnessData.get("last_aslot");
                const lastAslotTime = new Date(
                    Date.now() -
                        (dynGlobalObject.current_aslot - witnessAslot) *
                            globalObjectImm.getIn([
                                "parameters",
                                "block_interval"
                            ]) *
                            1000
                );

                return {
                    id: a.get("id"),
                    key: witness.get("name"),
                    rank: ranks[a.get("id")],
                    name: witness.get("name"),
                    signing_key: witnessData.get("signing_key"),
                    url: utils.sanitize(witnessData.get("url")),
                    lastConfirmedBlock: {
                        id: witnessData.get("last_confirmed_block_num"),
                        timestamp: lastAslotTime.getTime()
                    },
                    blocksMissed: witnessData.get("total_missed"),
                    votes: witnessData.get("total_votes")
                };
            });
    }

    const columns = [
        {
            key: "#",
            title: "#",
            dataIndex: "rank",
            sorter: (a: WitnessRow, b: WitnessRow) =>
                a.rank > b.rank ? 1 : a.rank < b.rank ? -1 : 0
        },
        {
            key: "name",
            title: "NAME",
            dataIndex: "name",
            sorter: (a: WitnessRow, b: WitnessRow) =>
                a.name > b.name ? 1 : a.name < b.name ? -1 : 0
        },
        {
            key: "url",
            title: "URL",
            dataIndex: "url",
            align: "center" as const,
            render: (item: string) => (
                <div style={{width: "100%", textAlign: "center"}}>
                    {(item && urlValid(item) && urlRender(item)) || null}
                </div>
            )
        },
        {
            key: "lastConfirmedBlock",
            title: "LAST CONFIRMED BLOCK",
            dataIndex: "lastConfirmedBlock",
            render: (item: WitnessRow["lastConfirmedBlock"]) => (
                <span>
                    <a
                        style={{display: "inline-block", minWidth: "100px"}}
                        href="javascript:void(0)"
                        onClick={handleBlockIdClick(item.id)}
                    >
                        #{Number(item.id).toLocaleString()}
                    </a>{" "}
                    <TimeAgo time={new Date(item.timestamp)} />
                </span>
            ),
            sorter: (a: WitnessRow, b: WitnessRow) =>
                a.lastConfirmedBlock.timestamp > b.lastConfirmedBlock.timestamp
                    ? -1
                    : a.lastConfirmedBlock.timestamp <
                      b.lastConfirmedBlock.timestamp
                    ? 1
                    : 0
        },
        {
            key: "blocksMissed",
            title: "BLOCKS MISSED",
            dataIndex: "blocksMissed",
            render: (item: any) => {
                const blocksMissedClassName = classNames(
                    "txtlabel",
                    {success: item <= 500},
                    {info: item > 500 && item <= 1250},
                    {warning: item > 1250 && item <= 2000},
                    {error: item >= 200}
                );
                return <span className={blocksMissedClassName}>{item}</span>;
            },
            sorter: (a: WitnessRow, b: WitnessRow) =>
                a.blocksMissed > b.blocksMissed
                    ? 1
                    : a.blocksMissed < b.blocksMissed
                    ? -1
                    : 0
        },
        {
            key: "votes",
            title: "VOTES",
            dataIndex: "votes",
            render: (item: any) => (
                <FormattedAsset amount={item} asset="1.3.0" decimalOffset={5} />
            ),
            sorter: (a: WitnessRow, b: WitnessRow) =>
                a.votes > b.votes ? 1 : a.votes < b.votes ? -1 : 0
        },
        {
            key: "key",
            title: "KEY",
            dataIndex: "signing_key",
            align: "center" as const,
            render: (item: any) => (
                <div style={{textAlign: "center", width: "100%"}}>
                    {keyRender(item)}
                </div>
            )
        }
    ];

    const getRowClassName = (record: WitnessRow) =>
        record.id === currentId ? "active-witness" : "";

    return (
        <div className="grid-block">
            <div className="grid-block">
                <div className="grid-block">
                    <div className="grid-content ">
                        <div className="explore-witness--info">
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <Translate content="explorer.witnesses.current" />
                                        </th>
                                        <th>
                                            <Translate content="explorer.blocks.active_witnesses" />
                                        </th>
                                        <th>
                                            <Translate content="explorer.witnesses.participation" />
                                        </th>
                                        <th>
                                            <Translate content="explorer.witnesses.pay" />
                                        </th>
                                        <th>
                                            <Translate content="explorer.witnesses.budget" />
                                        </th>
                                        <th>
                                            <Translate content="explorer.witnesses.next_vote" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            {currentAccount
                                                ? currentAccount.get("name")
                                                : null}
                                        </td>
                                        <td>{witnessIds.length}</td>
                                        <td>{dynGlobalObject.participation}%</td>
                                        <td>
                                            <FormattedAsset
                                                amount={
                                                    globalObject.parameters
                                                        .witness_pay_per_block
                                                }
                                                asset="1.3.0"
                                            />
                                        </td>
                                        <td>
                                            {" "}
                                            <FormattedAsset
                                                amount={
                                                    dynGlobalObject.witness_budget
                                                }
                                                asset="1.3.0"
                                            />
                                        </td>
                                        <td>
                                            {" "}
                                            <TimeAgo
                                                time={
                                                    new Date(
                                                        dynGlobalObject.next_maintenance_time +
                                                            "Z"
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <TypedSearchInput
                            placeholder={counterpart.translate(
                                "explorer.witnesses.filter_by_name"
                            )}
                            value={filterWitness}
                            onChange={onFilter}
                            style={{
                                width: "200px",
                                marginBottom: "12px",
                                marginTop: "4px"
                            }}
                        />

                        <Table
                            rowClassName={getRowClassName}
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
