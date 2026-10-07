// TypeScript/functional-component port of the legacy BlockContainer.jsx
// (Blockchain/ batch 1, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic
// changes intended.
//
// The original existed only to inject `blocks` from `BlockchainStore`
// into `Block` via `AltContainer`'s `inject` prop (as a *function*,
// `() => BlockchainStore.getState().blocks`, so it re-computed on every
// `BlockchainStore` change and stayed live - unlike `FeesContainer.jsx`'s
// static `inject` value) and to re-render on `BlockchainStore` changes
// (`stores={[BlockchainStore]}`). Both are covered by this migration's
// standard `useAltStore` adapter hook (`app/next/hooks/useAltStore.ts`),
// which subscribes to the store and always returns its current state -
// the same, always-fresh behavior the original's function-form `inject`
// already had.
//
// `height`/`txIndex` parsing from `this.props.match.params` is
// transcribed verbatim, including the original's missing radix argument
// on the `txIndex` parse (`parseInt(this.props.match.params.txIndex)`,
// vs. `height`'s explicit `parseInt(..., 10)`) - harmless in practice
// (route params here are always plain decimal digit strings, never
// `0x`-prefixed), but kept as-is rather than "fixed" per this
// migration's preserve-bugs-verbatim convention.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear; this file and `Block.jsx` only read and display
// already-broadcast block/transaction data.
import * as React from "react";
import BlockchainStore from "stores/BlockchainStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import Block from "./Block";

interface BlockContainerProps {
    match: {params: {height: string; txIndex?: string}};
    [key: string]: any;
}

export default function BlockContainer(props: BlockContainerProps) {
    const blockchainState = useAltStore<any>(BlockchainStore);
    const height = parseInt(props.match.params.height, 10);
    const txIndex = props.match.params.txIndex
        ? parseInt(props.match.params.txIndex)
        : 0;

    return (
        <Block
            {...props}
            height={height}
            scrollToIndex={txIndex}
            blocks={blockchainState.blocks}
        />
    );
}
