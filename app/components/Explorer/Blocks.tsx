// TypeScript/functional-component port of the legacy Blocks.jsx (Phase 2,
// docs/UI_MIGRATION_PLAN.md). Renders the "/explorer/blocks" tab's stats
// row, block-time/tx charts, and the recent blocks/transactions tables.
//
// Read-only public chain-explorer data (no account balances, no signing),
// so this doesn't carry the same balance-math risk Dashboard's rewrite
// did - it's ported faithfully but without a separate pure-function module
// or live-data fixture test the way app/next/dashboard/balanceCalculations.ts
// got. TransactionChart, BlocktimeChart, Operation, LinkToWitnessById,
// TimeAgo, FormattedAsset and TransitionWrapper are reused exactly as
// before, not touched.
//
// Like the Dashboard rewrite, this replaces BindToChainState/AssetWrapper
// with useChainStoreTick + direct ChainStore reads, and doesn't replicate
// the legacy shouldComponentUpdate's re-render gating (perf tradeoff, not
// a correctness one - see TotalBalanceValue.tsx's header comment for the
// same reasoning). One behavioral simplification: the legacy
// UNSAFE_componentWillReceiveProps re-fetched blocks by reading `this.props`
// (the *old*, pre-update props) from inside a props-change handler, a
// subtle quirk of the class lifecycle. The effect below reads the current
// props consistently instead, which converges to fetching the same blocks
// in practice (both compute the initial 20 blocks off essentially the same
// head block number) and is more correct if anything, not less.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import Immutable from "immutable";
import BlockchainActions from "actions/BlockchainActions";
import Translate from "react-translate-component";
import {FormattedDate} from "react-intl";
import {ChainStore} from "bitsharesjs";
import Ps from "perfect-scrollbar";
import classNames from "classnames";
import utils from "common/utils";
import Operation from "../Blockchain/Operation";
import LinkToWitnessById from "../Utility/LinkToWitnessById";
import TransactionChart from "./TransactionChart";
import BlocktimeChart from "./BlocktimeChart";
import TimeAgo from "../Utility/TimeAgo";
import FormattedAsset from "../Utility/FormattedAsset";
import TransitionWrapper from "../Utility/TransitionWrapper";
import LoadingIndicator from "../LoadingIndicator";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

import "../Blockchain/json-inspector.scss";

// Same @types/react-router-dom v5 + modern TS workaround as Rail.tsx's
// TypedNavLink - see that file's comment for why this cast is needed.
const TypedLink = Link as React.ComponentType<LinkProps>;

function BlockTimeAgo({blockTime}: {blockTime: number | null}) {
    if (!blockTime) return null;

    const timePassed = new Date().getTime() - new Date(blockTime).getTime();
    const textClass = classNames(
        "txtlabel",
        {success: timePassed <= 6000},
        {info: timePassed > 6000 && timePassed <= 15000},
        {warning: timePassed > 15000 && timePassed <= 25000},
        {error: timePassed > 25000}
    );

    return (
        <h3 className={textClass}>
            <TimeAgo time={blockTime} />
        </h3>
    );
}

export interface BlocksProps {
    latestBlocks: Immutable.List<any>;
    latestTransactions: Immutable.List<any>;
    globalObjectId?: string;
    dynGlobalObjectId?: string;
}

export default function Blocks(props: BlocksProps) {
    const {
        latestBlocks,
        latestTransactions,
        globalObjectId = "2.0.0",
        dynGlobalObjectId = "2.1.0"
    } = props;

    useChainStoreTick();

    const outerWrapperRef = React.useRef<HTMLDivElement>(null);
    const operationsTextRef = React.useRef<HTMLDivElement>(null);
    const blocksTextRef = React.useRef<HTMLDivElement>(null);
    const operationsRef = React.useRef<HTMLDivElement>(null);
    const blocksRef = React.useRef<HTMLDivElement>(null);

    const [operationsHeight, setOperationsHeight] = React.useState<
        number | null
    >(null);
    const [blocksHeight, setBlocksHeight] = React.useState<number | null>(
        null
    );

    const globalObject = ChainStore.getObject(globalObjectId);
    const dynGlobalObject = ChainStore.getObject(dynGlobalObjectId);
    const coreAsset = ChainStore.getAsset("1.3.0");
    const dynamicObject = coreAsset
        ? ChainStore.getObject(coreAsset.get("dynamic_asset_data_id"))
        : undefined;

    function getBlock(height: number, maxBlock: number) {
        if (height) {
            BlockchainActions.getLatest(parseInt(String(height), 10), maxBlock);
        }
    }

    function getInitialBlocks() {
        if (!dynGlobalObject) return;
        const maxBlock = parseInt(
            dynGlobalObject.get("head_block_number"),
            10
        );
        if (maxBlock) {
            for (let i = 19; i >= 0; i--) {
                let exists = false;
                if (latestBlocks.size > 0) {
                    for (let j = 0; j < latestBlocks.size; j++) {
                        if (latestBlocks.get(j).id === maxBlock - i) {
                            exists = true;
                            break;
                        }
                    }
                }
                if (!exists) {
                    getBlock(maxBlock - i, maxBlock);
                }
            }
        }
    }

    function updateHeight() {
        const containerHeight = outerWrapperRef.current?.offsetHeight;
        const operationsTextHeight = operationsTextRef.current?.offsetHeight;
        const blocksTextHeight = blocksTextRef.current?.offsetHeight;
        if (
            containerHeight === undefined ||
            operationsTextHeight === undefined ||
            blocksTextHeight === undefined
        )
            return;
        setOperationsHeight(containerHeight - operationsTextHeight);
        setBlocksHeight(containerHeight - blocksTextHeight);
    }

    React.useEffect(() => {
        function onResize() {
            updateHeight();
        }
        window.addEventListener("resize", onResize, {
            capture: false,
            passive: true
        });
        return () => window.removeEventListener("resize", onResize);
    }, []);

    React.useEffect(() => {
        if (operationsRef.current) Ps.initialize(operationsRef.current);
        if (blocksRef.current) Ps.initialize(blocksRef.current);
        updateHeight();
    }, []);

    React.useEffect(() => {
        if (!dynGlobalObject) return;
        if (latestBlocks.size === 0) {
            getInitialBlocks();
        } else {
            const maxBlock = dynGlobalObject.get("head_block_number");
            if (
                latestBlocks.size >= 20 &&
                maxBlock !== latestBlocks.get(0).id
            ) {
                getBlock(maxBlock, maxBlock);
            }
        }
    }, [latestBlocks, dynGlobalObject]);

    React.useEffect(() => {
        if (operationsRef.current) Ps.update(operationsRef.current);
        if (blocksRef.current) Ps.update(blocksRef.current);
    });

    if (!globalObject || !dynGlobalObject) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    let blocksRows: React.ReactNode[] | null = null;
    let transactions: React.ReactNode[] | null = null;
    let headBlock: number | null = null;
    let trxCount = 0;
    const blockCount = latestBlocks.size;
    let trxPerSec = 0;
    const blockTimes: [number, number][] = [];
    let avgTime = 0;

    if (latestBlocks && latestBlocks.size >= 20) {
        let previousTime: number | undefined;
        let lastBlock: number | undefined, firstBlock: number | undefined;

        latestBlocks
            .filter((a: any, index: number) => {
                return (
                    a.id === dynGlobalObject.get("head_block_number") - index
                );
            })
            .sort((a: any, b: any) => a.id - b.id)
            .forEach((block: any, index: number) => {
                trxCount += block.transactions.length;
                if (index > 0) {
                    blockTimes.push([
                        block.id,
                        (block.timestamp - (previousTime as number)) / 1000
                    ]);
                    lastBlock = block.timestamp;
                } else {
                    firstBlock = block.timestamp;
                }
                previousTime = block.timestamp;
            });

        blocksRows = latestBlocks
            .sort((a: any, b: any) => b.id - a.id)
            .take(20)
            .map((block: any) => {
                return (
                    <tr key={block.id}>
                        <td>
                            <TypedLink to={`/block/${block.id}`}>
                                #{utils.format_number(block.id, 0)}
                            </TypedLink>
                        </td>
                        <td>
                            <FormattedDate value={block.timestamp} format="time" />
                        </td>
                        <td>
                            <LinkToWitnessById witness={block.witness} />
                        </td>
                        <td>
                            {utils.format_number(block.transactions.length, 0)}
                        </td>
                    </tr>
                );
            })
            .toArray();

        let trxIndex = 0;
        transactions = latestTransactions
            .sort((a: any, b: any) => b.block_num - a.block_num)
            .take(20)
            .map((trx: any) => {
                let opIndex = 0;
                return trx.operations
                    .map((op: any) => {
                        if (trxIndex > 15) return null;
                        return (
                            <Operation
                                key={trxIndex++}
                                op={op}
                                result={trx.operation_results[opIndex++]}
                                block={trx.block_num}
                                hideFee={true}
                                hideOpLabel={false}
                                current={"1.2.0"}
                                hideDate
                                hidePending
                            />
                        );
                    })
                    .filter((a: any) => !!a);
            })
            .toArray();

        headBlock = latestBlocks.first().timestamp;
        avgTime = blockTimes.reduce((previous, current) => {
            return previous + current[1] / blockTimes.length;
        }, 0);

        trxPerSec =
            trxCount / (((lastBlock as number) - (firstBlock as number)) / 1000);
    }

    return (
        <div ref={outerWrapperRef} className="grid-block vertical">
            {/* First row of stats */}
            <div className="align-center grid-block shrink small-horizontal blocks-row">
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.current_block"
                            />
                        </span>
                        <h2>
                            #
                            {utils.format_number(
                                dynGlobalObject.get("head_block_number"),
                                0
                            )}
                        </h2>
                    </div>
                </div>
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.last_block"
                            />
                        </span>
                        <BlockTimeAgo blockTime={headBlock} />
                    </div>
                </div>
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.trx_per_sec"
                            />
                        </span>
                        <h2>{utils.format_number(trxPerSec, 2)}</h2>
                    </div>
                </div>
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.avg_conf_time"
                            />
                        </span>
                        <h2>{utils.format_number(avgTime / 2, 2)}s</h2>
                    </div>
                </div>
            </div>

            {/* Second row of stats */}
            <div className="align-center grid-block shrink small-horizontal  blocks-row">
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.active_witnesses"
                            />
                        </span>
                        <h2 className="txtlabel success">
                            {globalObject.get("active_witnesses").size}
                        </h2>
                    </div>
                </div>

                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.active_committee_members"
                            />
                        </span>
                        <h2 className="txtlabel success">
                            {globalObject.get("active_committee_members").size}
                        </h2>
                    </div>
                </div>

                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.trx_per_block"
                            />
                        </span>
                        <h2>
                            {utils.format_number(trxCount / blockCount || 0, 2)}
                        </h2>
                    </div>
                </div>
                <div className="grid-block text-center small-6 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.recently_missed_blocks"
                            />
                        </span>
                        <h2
                            className="txtlabel warning"
                            style={{fontWeight: 100}}
                        >
                            {dynGlobalObject.get("recently_missed_count")}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Third row: graphs */}
            <div className="align-center grid-block shrink small-vertical medium-horizontal blocks-row">
                <div className="grid-block text-center small-12 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.asset.summary.current_supply"
                            />
                        </span>
                        <h3 className="txtlabel">
                            {dynamicObject ? (
                                <FormattedAsset
                                    amount={dynamicObject.get("current_supply")}
                                    asset={coreAsset.get("id")}
                                    decimalOffset={5}
                                />
                            ) : null}
                        </h3>
                    </div>
                </div>
                <div className="grid-block text-center small-12 medium-3">
                    <div className="grid-content no-overflow">
                        <div className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.block_times"
                            />
                        </div>
                        <BlocktimeChart
                            blockTimes={blockTimes}
                            head_block_number={dynGlobalObject.get(
                                "head_block_number"
                            )}
                        />
                    </div>
                </div>
                <div className="grid-block text-center small-12 medium-3">
                    <div className="grid-content no-overflow">
                        <div className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.blocks.trx_per_block"
                            />
                        </div>
                        <TransactionChart
                            blocks={latestBlocks}
                            head_block={dynGlobalObject.get(
                                "head_block_number"
                            )}
                        />
                    </div>
                </div>
                <div className="grid-block text-center small-12 medium-3">
                    <div className="grid-content no-overflow clear-fix">
                        <span className="txtlabel">
                            <Translate
                                component="span"
                                content="explorer.asset.summary.stealth_supply"
                            />
                        </span>
                        <h3 className="txtlabel">
                            {dynamicObject ? (
                                <FormattedAsset
                                    amount={dynamicObject.get(
                                        "confidential_supply"
                                    )}
                                    asset={coreAsset.get("id")}
                                    decimalOffset={5}
                                />
                            ) : null}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Fourth row: transactions and blocks */}
            <div className="grid-block no-overflow">
                <div
                    className="grid-block small-12 medium-6 vertical no-overflow"
                    style={{paddingBottom: 0}}
                >
                    <div className="grid-block vertical no-overflow generic-bordered-box">
                        <div ref={operationsTextRef}>
                            <div className="block-content-header">
                                <Translate content="account.recent" />
                            </div>
                            <table className="table fixed-height-2rem">
                                <thead>
                                    <tr>
                                        <th>
                                            <Translate content="account.votes.info" />
                                        </th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                        <div
                            className="grid-block"
                            style={{
                                maxHeight: operationsHeight || "400px",
                                overflow: "hidden"
                            }}
                            ref={operationsRef}
                        >
                            <table className="table fixed-height-2rem">
                                <tbody>{transactions}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div
                    className="grid-block medium-6 show-for-medium vertical no-overflow"
                    style={{paddingBottom: 0, paddingLeft: 5}}
                >
                    <div className="grid-block vertical no-overflow generic-bordered-box">
                        <div ref={blocksTextRef}>
                            <div className="block-content-header">
                                <Translate
                                    component="span"
                                    content="explorer.blocks.recent"
                                />
                            </div>
                        </div>
                        <div
                            className="grid-block vertical"
                            style={{
                                maxHeight: blocksHeight || "438px",
                                overflow: "hidden"
                            }}
                            ref={blocksRef}
                        >
                            <table className="table fixed-height-2rem">
                                <thead>
                                    <tr>
                                        <th>
                                            <Translate
                                                component="span"
                                                content="explorer.block.id"
                                            />
                                        </th>
                                        <th>
                                            <Translate
                                                component="span"
                                                content="explorer.block.date"
                                            />
                                        </th>
                                        <th>
                                            <Translate
                                                component="span"
                                                content="explorer.block.witness"
                                            />
                                        </th>
                                        <th>
                                            <Translate
                                                component="span"
                                                content="explorer.block.count"
                                            />
                                        </th>
                                    </tr>
                                </thead>

                                <TransitionWrapper
                                    component="tbody"
                                    transitionName="newrow"
                                >
                                    {blocksRows}
                                </TransitionWrapper>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
