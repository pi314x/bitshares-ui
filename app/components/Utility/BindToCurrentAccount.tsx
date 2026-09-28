// TypeScript/functional-component port of the legacy
// BindToCurrentAccount.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// This is a HOC *factory* (`bindToCurrentAccount(WrappedComponent)`), not
// a leaf component. Its inner class was wrapped with
// `BindToChainState(Component, {})`, relying on a static `propTypes =
// {currentAccount: ChainTypes.ChainAccount}` for BindToChainState's own
// introspection - a fragile thing to preserve on a converted function
// component (static `propTypes`/`defaultProps` values are load-bearing
// for `BindToChainState`'s resolution logic, not just documentation/dev
// validation). Replaced instead with the same Container+
// `useChainStoreTick()` pattern used everywhere else in this migration,
// replicating `BindToChainState`'s *specific* `ChainAccount`-type
// resolution verbatim (not the plain `ChainObject` one): unwrap a
// single-entry `{name: ...}` Map (which is exactly what this file's own
// `getProps()` constructs below) before calling `ChainStore.getAccount()`,
// with `autosubscribe` fixed to `true` (the original's `static
// defaultProps = {autosubscribe: true}`).
import * as React from "react";
import debounceRender from "react-debounce-render";
import {connect} from "alt-react";
import {ChainStore} from "bitsharesjs";
import AccountStore from "../../stores/AccountStore";
import LoadingIndicator from "../LoadingIndicator";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

export const hasLoaded = function hasLoaded(currentAccount: any) {
    return !!currentAccount && !!currentAccount.get("id");
};

function resolveCurrentAccount(prop: any, autosubscribe: boolean) {
    if (!prop) return prop;
    if (prop[0] === "#" && Number.parseInt(prop.substring(1))) {
        prop = "1.2." + prop.substring(1);
    }
    if (prop instanceof Map && !!prop.get("name") && prop.size == 1) {
        prop = prop.get("name");
    }
    return (ChainStore as any).getAccount(prop, autosubscribe);
}

export const bindToCurrentAccount = function bindToCurrentAccount(
    WrappedComponent: React.ComponentType<any>
) {
    function BindToCurrentAccountCore(props: any) {
        if (hasLoaded(props.currentAccount)) {
            return <WrappedComponent {...props} />;
        } else {
            return <LoadingIndicator />;
        }
    }

    function BindToCurrentAccountChainContainer(props: any) {
        useChainStoreTick();
        const currentAccount = resolveCurrentAccount(props.currentAccount, true);

        return (
            <BindToCurrentAccountCore
                {...props}
                currentAccount={currentAccount}
            />
        );
    }

    const Debounced = debounceRender(BindToCurrentAccountChainContainer, 100, {
        leading: false
    });

    return connect(Debounced, {
        listenTo() {
            return [AccountStore];
        },
        getProps() {
            const currentAccount =
                (AccountStore.getState() as any).currentAccount ||
                (AccountStore.getState() as any).passwordAccount ||
                "please-login";
            return {
                currentAccount: new Map([["name", currentAccount]])
            };
        }
    });
};
