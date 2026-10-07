// TypeScript/functional-component port of the legacy AccountCard.jsx
// (Dashboard/ batch 1, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic
// changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AccountCard)` HOC wrapping (resolving the required
// `account` prop, typed `ChainTypes.ChainAccount.isRequired`) is replaced
// by a small container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern (see `Utility/AccountName.tsx`
// for the same shape applied to a `ChainObject`-typed required prop).
// Unlike `ChainObject` (resolved via plain `ChainStore.getObject`),
// `ChainAccount` resolution in the original `BindToChainState.jsx` has two
// extra steps before calling `ChainStore.getAccount`: rewriting a leading
// `#<digits>` id shorthand to `1.2.<digits>`, and unwrapping a
// single-entry `{name: ...}` Immutable Map (the shape `BindToCurrentAccount`
// passes) down to the plain name string - both are reproduced verbatim in
// `resolveAccountProp` below even though this file's only real caller
// (`Wallet/Brainkey.tsx`, grep-confirmed) always passes a plain account
// name string, never exercising either branch. `account` was `.isRequired`
// with no `defaultProps.autosubscribe` on the original class, so
// `BindToChainState` resolved it with `autosubscribe` always `undefined`
// (falsy) - preserved by passing `undefined` through explicitly here
// rather than defaulting it to `true` (which is what the unrelated
// `BindToCurrentAccount.tsx` conversion does, because *that* legacy HOC's
// own `static defaultProps = {autosubscribe: true}` made that specific
// substitution correct there - it would not be here).
// While `account` is unresolved (`undefined`, i.e. not yet fetched from
// chain), `BindToChainState`'s generic `Wrapper.render()` fell through to
// its "required prop missing, no `tempComponent`/`show_loader` option"
// branch and rendered a bare `<span />` (not `null`, not a loading
// indicator) - replicated verbatim, again matching `AccountName.tsx`'s
// precedent for the same fallback case. A *resolved-but-invalid* account
// (`ChainStore.getAccount` returning `null`) is passed straight through to
// the card body, same as the original: `AccountCard`'s own render already
// guards on `if (this.props.account)` and simply omits the name/balances.
//
// `withRouter` (only used for `history.push` in `onCardClick`) is dropped
// in favor of `useNavigate()` (Phase 9, react-router v6 migration -
// `withRouter`/`useHistory` no longer exist in v6; `useNavigate()` is
// this migration's replacement, same as `Dashboard/DashboardList.tsx`).
import * as React from "react";
import {useNavigate} from "react-router-dom";
import {ChainStore} from "bitsharesjs";
import BalanceComponent from "../Utility/BalanceComponent";
import AccountImage from "../Account/AccountImage";
import AccountStore from "stores/AccountStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface AccountCardProps {
    account: any;
}

function AccountCardCore({account}: AccountCardProps) {
    const navigate = useNavigate();
    let name: string | null = null;
    let balances: React.ReactNode = null;
    let isMyAccount = false;

    if (account) {
        name = account.get("name");
        const abal = account.get("balances");
        if (abal) {
            balances = abal
                .map((x: string) => {
                    const balanceAmount = ChainStore.getObject(x);
                    if (!balanceAmount.get("balance")) {
                        return null;
                    }
                    return (
                        <li key={x}>
                            <BalanceComponent balance={x} />
                        </li>
                    );
                })
                .toArray();
        }
        isMyAccount = AccountStore.isMyAccount(account);
    }

    function onCardClick(e: React.MouseEvent) {
        e.preventDefault();
        navigate(`/account/${name}`);
    }

    return (
        <div className="grid-content account-card" onClick={onCardClick}>
            <div className={"card" + (isMyAccount ? " my-account" : "")}>
                <h4 className="text-center">{name}</h4>
                <div className="card-content clearfix">
                    <div className="float-left">
                        <AccountImage
                            account={name || undefined}
                            size={{height: 64, width: 64}}
                        />
                    </div>
                    <ul className="balances">{balances}</ul>
                </div>
            </div>
        </div>
    );
}

function resolveAccountProp(prop: any, autosubscribe: boolean | undefined) {
    if (!prop) return prop;
    if (prop[0] === "#" && Number.parseInt(prop.substring(1))) {
        prop = "1.2." + prop.substring(1);
    }
    if (prop instanceof Map && !!prop.get("name") && prop.size === 1) {
        prop = prop.get("name");
    }
    return (ChainStore as any).getAccount(prop, autosubscribe);
}

interface AccountCardContainerProps {
    account: any;
}

function AccountCardChainContainer({account}: AccountCardContainerProps) {
    useChainStoreTick();
    const resolvedAccount = resolveAccountProp(account, undefined);

    if (resolvedAccount === undefined) {
        return <span />;
    }

    return <AccountCardCore account={resolvedAccount} />;
}

export default AccountCardChainContainer;
