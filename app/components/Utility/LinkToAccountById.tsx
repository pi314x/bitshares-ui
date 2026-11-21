// TypeScript/functional-component port of the legacy LinkToAccountById.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes, with
// one exception documented below.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(LinkToAccountById, {autosubscribe: false})` HOC
// (resolving the required `account` prop - an account id or name - to its
// canonical account name via `ChainStore.getAccountName`) is replaced by a
// small container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established `BindToChainState`
// replacement pattern.
//
// Dropped as confirmed dead: the original's
// `if (!account_name) { return <span>{this.props.account.get("id")}</span>; }`
// fallback branch. `account` was `ChainTypes.ChainAccountName.isRequired`,
// and BindToChainState's own render() gates required chain-type props on
// `this.state[prop] !== undefined` before ever rendering the wrapped
// component (see BindToChainState.jsx render(), ~line 652) - and its account
// -name resolution loop only ever writes a state value for a required prop
// when `ChainStore.getAccountName()` returns a truthy string (BindToChainState
// .jsx ~lines 353-373). So by the time this component rendered, `account_name`
// was always a truthy string; the fallback (which called `.get("id")` on
// what is actually a plain string, not an object) was unreachable. Verified
// by reading BindToChainState.jsx's resolution/render logic directly, not
// assumed.
//
// `shouldComponentUpdate` (`nextProps.account !== this.props.account`) is a
// pure shallow-equality performance guard - not replicated, per this
// migration's established treatment of pure perf guards.
//
// Preserved verbatim as a real bug (not "fixed"): `maxDisplayAccountNameLength`
// is only ever used as a *gate* (`> 0 ? 20 : Infinity`) - the literal `20` is
// used as the truncation length regardless of the actual prop value passed
// in (e.g. passing `maxDisplayAccountNameLength={5}` still truncates at 20).
import * as React from "react";
import {Link} from "react-router-dom";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

// `@types/react-router-dom`'s `Link` return type isn't assignable to
// `JSX.Element` under this repo's `@types/react` version (key type
// mismatch) - cast to a generic component type, as done elsewhere in this
// migration for similar third-party typing friction.
const LinkComponent = Link as React.ComponentType<any>;

interface LinkToAccountByIdContainerProps {
    account: string;
    subpage?: string;
    maxDisplayAccountNameLength?: number;
    noLink?: boolean;
    onClick?: (event: any) => void;
}

interface LinkToAccountByIdProps {
    accountName: string;
    subpage: string;
    maxDisplayAccountNameLength: number;
    noLink?: boolean;
    onClick?: (event: any) => void;
}

function LinkToAccountById({
    accountName,
    subpage,
    maxDisplayAccountNameLength,
    noLink,
    onClick
}: LinkToAccountByIdProps) {
    const maxLength = maxDisplayAccountNameLength > 0 ? 20 : Infinity;
    const displayName = accountName.substr(0, maxLength);
    const ellipsis = accountName.length > maxLength ? "..." : null;

    return noLink ? (
        <span>
            {displayName}
            {ellipsis}
        </span>
    ) : (
        <LinkComponent
            onClick={onClick ? onClick : () => {}}
            to={`/account/${accountName}/${subpage}/`}
        >
            {displayName}
            {ellipsis}
        </LinkComponent>
    );
}

function LinkToAccountByIdContainer({
    account,
    subpage = "overview",
    maxDisplayAccountNameLength = 20,
    noLink,
    onClick
}: LinkToAccountByIdContainerProps) {
    useChainStoreTick();
    const accountName = account ? ChainStore.getAccountName(account) : account;

    if (!accountName) {
        return <span />;
    }

    return (
        <LinkToAccountById
            accountName={accountName}
            subpage={subpage}
            maxDisplayAccountNameLength={maxDisplayAccountNameLength}
            noLink={noLink}
            onClick={onClick}
        />
    );
}

export default LinkToAccountByIdContainer;
