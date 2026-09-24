// TypeScript/functional-component port of the legacy Brainkey.jsx (Phase
// 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. Security-
// sensitive per AGENTS.md: the raw brainkey phrase passes through
// `BrainkeyInputAccept`'s local state into
// `BrainkeyActions.setBrainkey(...)`, matching the original exactly -
// never logged, never persisted beyond the existing in-memory
// `BrainkeyStoreFactory` instance's own state (unchanged here).
//
// Structural changes:
// - `connect(Brainkey, connectObject)`/`connect(ViewBrainkey,
//   connectObject)` (both listening to the same
//   `BrainkeyStoreFactory.getInstance("wmc")` instance) become
//   `useAltStore(store)` calls. `getInstance("wmc")` is idempotent (the
//   factory caches by name) and safe to call on every render - it always
//   returns the same instance for the lifetime of the mounted tree,
//   matching the original's own `connectObject.listenTo()` doing the
//   same thing.
// - `Brainkey`'s `componentWillUnmount` (`BrainkeyStoreFactory
//   .closeInstance("wmc")`, which also clears the derived private keys
//   from memory via the store's own `clearCache()`) becomes a mount-only
//   cleanup effect.
// - `BrainkeyAccounts` was `BindToChainState`-wrapped for a
//   `ChainTypes.ChainAccountsList.isRequired` prop. Read
//   `BindToChainState.jsx`'s own list-resolution code (the
//   `chain_accounts_list` branch of `update()`): it maps each ID in the
//   Immutable list to `ChainStore.getAccount(id)`, producing a plain
//   array - resolved synchronously on mount before any paint, so the
//   loading-gate placeholder was never actually observable in practice.
//   `BrainkeyAccounts` has exactly one call site (right below, in this
//   same file) so its resolution is inlined directly rather than built
//   as a separate reusable Container, under `useChainStoreTick()`.
import * as React from "react";
import Immutable from "immutable";
import cname from "classnames";
import BrainkeyActions from "actions/BrainkeyActions";
import BrainkeyStoreFactory from "stores/BrainkeyStore";
import {ChainStore} from "bitsharesjs";
import {toPairs} from "lodash-es";
import Translate from "react-translate-component";
import AccountCard from "components/Dashboard/AccountCard";
import BrainkeyInput from "./BrainkeyInput";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

export default function Brainkey() {
    const store = (BrainkeyStoreFactory as any).getInstance("wmc");
    useAltStore<any>(store);

    React.useEffect(() => {
        return () => {
            (BrainkeyStoreFactory as any).closeInstance("wmc");
        };
    }, []);

    return (
        <span>
            <h3>
                <Translate content="wallet.brainkey" />
            </h3>
            <BrainkeyInputAccept>
                <ViewBrainkey />
            </BrainkeyInputAccept>
        </span>
    );
}

function ViewBrainkey() {
    const store = (BrainkeyStoreFactory as any).getInstance("wmc");
    const state = useAltStore<any>(store);

    const short_brnkey = state.brnkey.substring(0, 10);
    return (
        <span>
            <div>
                <span className="">{short_brnkey}</span>&hellip;
            </div>
            <p />
            {state.account_ids.size ? (
                <BrainkeyAccounts
                    accounts={Immutable.List(state.account_ids.toArray())}
                />
            ) : (
                <h5>
                    <Translate content="wallet.no_accounts" />
                </h5>
            )}
        </span>
    );
}

function BrainkeyAccounts({accounts}: {accounts: any}) {
    useChainStoreTick();

    const resolved: any[] = [];
    accounts.forEach((obj_id: any) => {
        if (obj_id) {
            resolved.push((ChainStore as any).getAccount(obj_id));
        }
    });

    const rows = toPairs(resolved)
        .filter((account: any) => !!account[1])
        .map((account: any) => account[1].get("name"))
        .sort()
        .map((name: any) => <AccountCard key={name} account={name} />);
    return <span>{rows}</span>;
}

export function BrainkeyInputAccept({children}: {children?: any}) {
    const [brnkey, setBrnkey] = React.useState<string | null>("");
    const [accept, setAccept] = React.useState(false);

    if (accept) return <span>{children}</span>;

    const ready = brnkey && brnkey !== "";
    return (
        <span className="grid-container">
            <div>
                <BrainkeyInput onChange={setBrnkey} />
            </div>
            <div
                className={cname("button success", {disabled: !ready})}
                onClick={() => {
                    setAccept(true);
                    (BrainkeyActions as any).setBrainkey(brnkey);
                }}
            >
                <Translate content="wallet.accept" />
            </div>
        </span>
    );
}
