// TypeScript/functional-component port of the legacy AccountsSettings.jsx
// (the Settings screen's "My accounts" tab - list, hide/unhide, and link
// to permissions for each account the wallet controls keys for). Phase 2,
// docs/UI_MIGRATION_PLAN.md. Read-only listing plus a hide/unhide toggle
// that only writes local UI state (AccountStore's myHiddenAccounts) - no
// signing, so this stays out of the wallet-security-sensitive tier.
//
// Replaces the legacy `alt-react` `connect(AccountsSettings, {listenTo,
// getProps})` wrapper with `useAltStore(AccountStore)` for re-render
// triggering (same adapter pattern as every other ported component this
// phase), then reads `AccountStore.getMyAccounts()` fresh in the render
// body - it's a plain method, not part of `getState()`, same as
// `ChainStore.getAccount()` calls elsewhere in this phase's ports.
//
// The legacy `shouldComponentUpdate` shallow-compared `myAccounts` (via
// `utils.are_equal_shallow`, since `getMyAccounts()` returns a brand-new
// array every call even when unchanged) and `hiddenAccounts` to skip
// re-renders. Not replicated here, same tradeoff as elsewhere in this
// phase: it's a perf guard only, and this component's render body (sort +
// map over a short account list) is cheap enough that the extra
// re-renders it would otherwise skip aren't worth the added code.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import AccountStore from "stores/AccountStore";
import AccountActions from "actions/AccountActions";
import Translate from "react-translate-component";
import {useAltStore} from "../../next/hooks/useAltStore";

const TypedLink = Link as React.ComponentType<LinkProps>;

export default function AccountsSettings() {
    const accountState = useAltStore<any>(AccountStore);
    const hiddenAccounts = accountState.myHiddenAccounts;
    const myAccounts = AccountStore.getMyAccounts();

    function onToggleHide(
        account: string,
        hide: boolean,
        e: React.MouseEvent
    ) {
        e.preventDefault();
        AccountActions.toggleHideAccount(account, hide);
    }

    const accounts = hiddenAccounts
        .toArray()
        .concat(myAccounts)
        .sort();

    if (!accounts.length) {
        return (
            <div>
                <Translate content="settings.no_accounts" />
            </div>
        );
    }

    return (
        <table className="table">
            <tbody>
                {accounts.map((account: string) => {
                    const isIgnored = hiddenAccounts.has(account);
                    const hideLink = (
                        <a
                            onClick={(e: React.MouseEvent) =>
                                onToggleHide(account, !isIgnored, e)
                            }
                        >
                            <Translate
                                content={
                                    "account." +
                                    (isIgnored ? "unignore" : "ignore")
                                }
                            />
                        </a>
                    );

                    return (
                        <tr key={account}>
                            <td>{account}</td>
                            <td>
                                <TypedLink
                                    to={`/account/${account}/permissions`}
                                >
                                    <Translate content="settings.view_keys" />
                                </TypedLink>
                            </td>
                            <td>{hideLink}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
