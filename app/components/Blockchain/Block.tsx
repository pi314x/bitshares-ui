// TypeScript/functional-component port of the legacy Block.jsx
// (Blockchain/ batch 1, docs/UI_MIGRATION_PLAN.md). Two original classes:
//
// - `TransactionList` (pure render, no lifecycle) becomes a plain
//   function component. Its `shouldComponentUpdate` (`nextProps.block.id
//   !== this.props.block.id`) is a pure performance guard with no side
//   effect - dropped entirely per this migration's convention: a fixed
//   block's contents never change once fetched, so it never actually
//   blocked a re-render that would have shown different output.
// - `Block = BindToChainState(Block)` (required
//   `dynGlobalObject: ChainTypes.ChainObject.isRequired`; plain,
//   non-chain-type `blocks: PropTypes.object.isRequired` and
//   `height: PropTypes.number.isRequired`, both left untouched by
//   `BindToChainState` since `PropTypes.object`/`PropTypes.number` are
//   not any `ChainTypes.*`, so they were never part of its required-prop
//   gate) becomes a `Block` (container, replacing the `BindToChainState`
//   wrap - kept as the file's default export name, matching every real
//   caller's `import Block from "./Block"`) + `BlockCore` split, same
//   pattern as `Modal/ProposalModal.tsx`/`Account/NestedApprovalState.tsx`:
//   `Block` resolves `dynGlobalObject` via `ChainStore.getObject` +
//   `useChainStoreTick()` and gates on `resolvedDynGlobalObject ===
//   undefined` (matching `BindToChainState.jsx`'s exact "only `undefined`
//   blocks; a resolved `null` renders through" semantics) with a blank
//   `<span/>` fallback, since the wrap site passes no options object (no
//   `tempComponent`/`show_loader`). `blocks`/`height` pass straight
//   through unresolved, exactly as before.
// - `Block`'s own `shouldComponentUpdate` (compares `blocks`
//   Immutable-equality, `height`, `dynGlobalObject` reference and
//   `showInput` state - the only four inputs `render()` actually reads,
//   directly or via `_nextBlock`/`_previousBlock`/`componentDidUpdate`)
//   is a pure performance guard with no side effect - dropped entirely,
//   consistent with every other legacy SCU removal in this migration.
//
// Lifecycle -> hooks:
// - `componentDidMount` (fetch the initial block; register the two
//   global `react-scroll` `Events.scrollEvent` listeners) -> a mount-only
//   `useEffect(() => {...}, [])`. The "begin" listener's original body was
//   already an empty, commented-out no-op (`//console.log("begin", ...)`
//   ) - transcribed as a genuine empty callback rather than dropping the
//   `register` call itself, since `Events.scrollEvent` is a shared,
//   app-wide event emitter and removing the registration is an
//   observable (if inert) behavior change the original didn't make. The
//   original never calls the matching `.deregister()` on unmount either -
//   preserved verbatim (same "registrations accumulate across remounts"
//   quirk as before).
// - `UNSAFE_componentWillReceiveProps` (re-fetch the block when `height`
//   changes) -> a `useEffect` on `[height]` using the mount-skip-ref
//   pattern. Hooks-forced judgment call: the original's `_getBlock`
//   reads `this.props.blocks` from *before* the incoming prop update is
//   applied (component-will-receive-props runs pre-commit), whereas the
//   hook version necessarily reads the *current* (already-updated, same
//   render pass as the new `height`) `blocks` - there is no equivalent of
//   "the previous commit's props" without extra ref plumbing this file
//   has no other use for. Inconsequential in practice: `blocks` only ever
//   grows (`BlockchainStore` never evicts a previously-fetched height), so
//   both readings agree on whether a given height is already cached.
// - `componentDidUpdate` (scroll to the requested transaction once its
//   block has arrived and no scroll has finished yet) -> a `useEffect`
//   with no dependency array (so, like the original, it re-runs after
//   every render) using the same mount-skip-ref pattern, since
//   `componentDidUpdate` never fires for the initial mount either.
//
// Legacy string ref (`ref="blockInput"`, read once via
// `this.refs.blockInput.value` in `_onSubmit`) -> a typed
// `React.useRef<HTMLInputElement>(null)`.
//
// Method names had their `_` prefix dropped (`_getBlock` -> `getBlock`,
// `_nextBlock` -> `nextBlock`, `_previousBlock` -> `previousBlock`,
// `_onKeyDown` -> `onKeyDown`, `_onSubmit` -> `onSubmit`), matching this
// migration's established naming convention for what were "private"
// class methods (e.g. `Modal/ProposalModal.tsx`'s `onProposalAction`).
// `.bind(this)` call sites are dropped, since plain closures need no
// rebinding.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear; this file only fetches and displays already-broadcast
// block/transaction data (`BlockchainActions.getBlock`, a read-only RPC
// call).
import * as React from "react";
import {FormattedDate} from "react-intl";
import BlockchainActions from "actions/BlockchainActions";
import Transaction from "./Transaction";
import Translate from "react-translate-component";
import LinkToWitnessById from "../Utility/LinkToWitnessById";
import {
    Element,
    Events,
    animateScroll as scroll,
    scroller
} from "react-scroll";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface TransactionListProps {
    block: any;
}

function TransactionList({block}: TransactionListProps) {
    let transactions: React.ReactNode[] = [];

    if (block.transactions.length > 0) {
        transactions = [];

        block.transactions.forEach((trx: any, index: number) => {
            transactions.push(
                <Element key={index} id={`tx_${index}`} name={`tx_${index}`}>
                    <Transaction block={block} key={index} trx={trx} index={index} />
                </Element>
            );
        });
    }

    return <div>{transactions}</div>;
}

interface BlockState {
    showInput: boolean;
    scrollEnded: boolean;
}

interface BlockCoreProps {
    dynGlobalObject: any;
    blocks: any;
    height: number;
    match: {params: {height: string}};
    history: any;
    scrollToIndex?: number;
    [key: string]: any;
}

function BlockCore({
    dynGlobalObject,
    blocks,
    height,
    match,
    history,
    scrollToIndex
}: BlockCoreProps) {
    const [state, setState] = React.useState<BlockState>({
        showInput: false,
        scrollEnded: false
    });

    const mergeState = (patch: Partial<BlockState>) =>
        setState(prev => ({...prev, ...patch}));

    const blockInputRef = React.useRef<HTMLInputElement>(null);

    function getBlock(h: any) {
        if (h) {
            const parsedHeight = parseInt(h, 10);
            if (!blocks.get(parsedHeight)) {
                BlockchainActions.getBlock(parsedHeight);
            }
        }
    }

    React.useEffect(() => {
        getBlock(height);

        Events.scrollEvent.register("begin", () => {});

        Events.scrollEvent.register("end", () => {
            mergeState({scrollEnded: true});
        });
    }, []);

    const isHeightMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isHeightMountRef.current) {
            isHeightMountRef.current = false;
            return;
        }
        getBlock(height);
    }, [height]);

    const isUpdateMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isUpdateMountRef.current) {
            isUpdateMountRef.current = false;
            return;
        }
        const parsedHeight = parseInt(height as any, 10);
        const currentBlock = blocks.get(parsedHeight);

        if (scrollToIndex && !state.scrollEnded && currentBlock) {
            scroller.scrollTo(`tx_${scrollToIndex}`, {
                duration: 1500,
                delay: 100,
                smooth: true,
                offset: -100,
                containerId: "blockContainer"
            });
        }
    });

    function scrollToTop() {
        scroll.scrollToTop({
            duration: 1500,
            delay: 100,
            smooth: true,
            containerId: "blockContainer"
        });
    }

    function nextBlock() {
        const paramHeight = match.params.height;
        const nextHeight = Math.min(
            dynGlobalObject.get("head_block_number"),
            parseInt(paramHeight, 10) + 1
        );
        history.push(`/block/${nextHeight}`);
    }

    function previousBlock() {
        const paramHeight = match.params.height;
        const prevHeight = Math.max(1, parseInt(paramHeight, 10) - 1);
        history.push(`/block/${prevHeight}`);
    }

    function toggleInput(e: React.MouseEvent) {
        e.preventDefault();
        mergeState({showInput: true});
    }

    function onKeyDown(e: {keyCode: number; target: {value: string}}) {
        if (e && e.keyCode === 13) {
            history.push(`/block/${e.target.value}`);
            mergeState({showInput: false});
        }
    }

    function onSubmit() {
        const value = blockInputRef.current ? blockInputRef.current.value : null;
        if (value) {
            onKeyDown({keyCode: 13, target: {value}});
        }
    }

    const {showInput} = state;
    const parsedHeight = parseInt(height as any, 10);
    const block = blocks.get(parsedHeight);

    const blockHeight = showInput ? (
        <span className="inline-label">
            <input
                ref={blockInputRef}
                type="number"
                onKeyDown={(e: any) => onKeyDown(e)}
            />
            <button onClick={onSubmit} className="button">
                <Translate content="explorer.block.go_to" />
            </button>
        </span>
    ) : (
        <span>
            <Translate
                style={{textTransform: "uppercase"}}
                component="span"
                content="explorer.block.title"
            />
            <a onClick={toggleInput}>
                &nbsp;#
                {parsedHeight}
            </a>
        </span>
    );

    return (
        <div className="grid-block page-layout">
            <div className="grid-block main-content">
                <div className="grid-content" id="blockContainer">
                    <div className="grid-content no-overflow medium-offset-2 medium-8 large-offset-3 large-6 small-12">
                        <h4 className="text-center">{blockHeight}</h4>
                        <ul>
                            <li>
                                <Translate
                                    component="span"
                                    content="explorer.block.date"
                                />
                                :{" "}
                                {block ? (
                                    <FormattedDate
                                        value={block.timestamp}
                                        format="full"
                                    />
                                ) : null}
                            </li>
                            <li>
                                <Translate
                                    component="span"
                                    content="explorer.block.witness"
                                />
                                :{" "}
                                {block ? (
                                    <LinkToWitnessById witness={block.witness} />
                                ) : null}
                            </li>
                            <li>
                                <Translate
                                    component="span"
                                    content="explorer.block.previous"
                                />
                                : {block ? block.previous : null}
                            </li>
                            <li>
                                <Translate
                                    component="span"
                                    content="explorer.block.transactions"
                                />
                                : {block ? block.transactions.length : null}
                            </li>
                        </ul>
                        <div className="clearfix" style={{marginBottom: "1rem"}}>
                            <div
                                className="button float-left outline"
                                onClick={previousBlock}
                            >
                                &#8592;
                            </div>
                            <div
                                className="button float-right outline"
                                onClick={nextBlock}
                            >
                                &#8594;
                            </div>
                        </div>
                        {block ? <TransactionList block={block} /> : null}
                        <div style={{textAlign: "center", marginBottom: 20}}>
                            <a onClick={scrollToTop}>
                                <Translate content="global.return_to_top" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface BlockProps {
    dynGlobalObject?: string;
    blocks?: any;
    height?: number;
    [key: string]: any;
}

export default function Block({
    dynGlobalObject = "2.1.0",
    blocks = {},
    height = 1,
    ...rest
}: BlockProps) {
    useChainStoreTick();
    const resolvedDynGlobalObject = (ChainStore as any).getObject(dynGlobalObject);

    if (resolvedDynGlobalObject === undefined) {
        return <span />;
    }

    return (
        <BlockCore
            {...(rest as any)}
            blocks={blocks}
            height={height}
            dynGlobalObject={resolvedDynGlobalObject}
        />
    );
}
