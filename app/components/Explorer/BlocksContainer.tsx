// TypeScript port of the legacy BlocksContainer.jsx - was just an
// AltContainer wired to BlockchainStore, replaced with useAltStore.
import * as React from "react";
import BlockchainStore from "stores/BlockchainStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import Blocks from "./Blocks";

export default function BlocksContainer() {
    const blockchainState = useAltStore<any>(BlockchainStore);

    return (
        <Blocks
            latestBlocks={blockchainState.latestBlocks}
            latestTransactions={blockchainState.latestTransactions}
        />
    );
}
