// TypeScript port of the legacy BlocksContainer.jsx - was just an
// AltContainer wired to BlockchainStore, replaced with useReduxState.
import * as React from "react";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectBlockchain} from "../../store/slices/blockchainSlice";
import Blocks from "./Blocks";

export default function BlocksContainer() {
    const blockchainState = useReduxState<any>(selectBlockchain);

    return (
        <Blocks
            latestBlocks={blockchainState.latestBlocks}
            latestTransactions={blockchainState.latestTransactions}
        />
    );
}
