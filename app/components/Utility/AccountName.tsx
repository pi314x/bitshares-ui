// TypeScript/functional-component port of the legacy AccountName.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AccountName)` HOC (resolving the required `account`
// prop via `ChainStore.getObject`) is replaced by a small container
// component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern.
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface AccountNameProps {
    account: string;
}

function AccountName({account}: {account: any}) {
    if (!account) return null;
    return <span>{account.get("name")}</span>;
}

function AccountNameContainer({account}: AccountNameProps) {
    useChainStoreTick();
    const accountObject = account ? ChainStore.getObject(account) : account;

    if (!accountObject) {
        return <span />;
    }

    return <AccountName account={accountObject} />;
}

export default AccountNameContainer;
