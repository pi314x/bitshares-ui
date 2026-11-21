// TypeScript/functional-component port of the legacy MyAccounts.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: purely resolves an Immutable
// List of account ids into a filtered/sorted account-name dropdown.
//
// `BindToChainState(MyAccounts)` (required `accounts:
// ChainTypes.ChainAccountsList`) replaced by a Container+Core split
// using `ChainStore` resolution + `useChainStoreTick()`, the same
// approach already established for `Account/NestedApprovalState.tsx`/
// `Modal/ProposalModal.tsx` (including a local, per-file copy of the
// `chain_accounts_list` resolution loop, matching this migration's
// established per-file self-containment convention). `accounts` is
// declared `.isRequired`, but `BindToChainState.jsx`'s own list
// resolution never leaves `state[key]` at `undefined` once resolved -
// it always assigns a (possibly sparse) array - so there is no "still
// loading" gate to replicate for the list-typed case, unlike a single
// `ChainAccount`/`ChainObject` prop; `resolveAccountsList` below always
// returns a real array too, matching that.
import * as React from "react";
import AccountStore from "stores/AccountStore";
import AccountSelect from "components/Forms/AccountSelect";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

function resolveAccountsList(prop: any, autosubscribe?: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        if (obj_id) {
            result[index] = (ChainStore as any).getAccount(
                obj_id,
                autosubscribe
            );
        }
        ++index;
    });
    return result;
}

interface MyAccountsCoreProps {
    accounts: any[];
    onChange: (accountName: string) => void;
}

function MyAccountsCore({accounts, onChange}: MyAccountsCoreProps) {
    const account_names = accounts
        .filter(account => !!account)
        .filter(account => (AccountStore as any).isMyAccount(account))
        .map(account => account.get("name"))
        .sort();

    const onAccountSelect = (account_name: string) => {
        onChange(account_name);
    };

    return (
        <span>
            <AccountSelect
                onChange={onAccountSelect}
                account_names={account_names}
                center={true}
            />
        </span>
    );
}

interface MyAccountsProps {
    accounts: any;
    onChange: (accountName: string) => void;
}

export default function MyAccounts({accounts, onChange}: MyAccountsProps) {
    useChainStoreTick();
    const resolvedAccounts = resolveAccountsList(accounts, undefined);

    return <MyAccountsCore accounts={resolvedAccounts} onChange={onChange} />;
}
