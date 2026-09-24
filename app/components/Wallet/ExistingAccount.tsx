// TypeScript/functional-component port of the legacy ExistingAccount.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// `connect()`'s `getProps()` (a bare `WalletManagerStore.getState()`
// passthrough) is replaced by `useAltStore(WalletManagerStore)` in both
// exported components, matching the original's two independently
// `connect()`-wrapped components in this same file.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import WalletManagerStore from "stores/WalletManagerStore";
import BalanceClaimActive from "./BalanceClaimActive";
import Translate from "react-translate-component";
import {Switch, Route} from "react-router-dom";
import Brainkey from "./Brainkey";
import ImportKeys from "./ImportKeys";
import {BackupRestore} from "./Backup";
import {getWalletName} from "branding";
import {useAltStore} from "../../next/hooks/useAltStore";

// See Explorer/Blocks.tsx's comment on `TypedLink` for why this cast is
// needed - `Link`'s inferred return type isn't a valid JSX element type
// under this project's React/TS version combination.
const TypedLink = Link as React.ComponentType<LinkProps>;

export default function ExistingAccount({children}: {children?: any}) {
    const wallet = useAltStore<any>(WalletManagerStore as any);
    const has_wallet = wallet.wallet_names.count() != 0;
    return (
        <div className="grid-container">
            <div className="grid-content">
                <div className="content-block center-content">
                    <div className="page-header">
                        <h1>
                            <Translate
                                content="account.welcome"
                                wallet_name={getWalletName()}
                            />
                        </h1>
                        {!has_wallet ? (
                            <h3>
                                <Translate content="wallet.create_wallet_backup" />
                            </h3>
                        ) : (
                            <h3>
                                <Translate content="wallet.setup_wallet" />
                            </h3>
                        )}
                    </div>
                    <div className="content-block">
                        <Switch>
                            <Route
                                exact
                                path="/existing-account"
                                component={BackupRestore}
                            />
                            <Route
                                exact
                                path="/existing-account/import-backup"
                                component={ExistingAccountOptions}
                            />
                            <Route
                                exact
                                path="/existing-account/import-keys"
                                component={ImportKeys}
                            />
                            <Route
                                exact
                                path="/existing-account/brainkey"
                                component={Brainkey}
                            />
                            <Route
                                exact
                                path="/existing-account/balance-claim"
                                component={BalanceClaimActive}
                            />
                        </Switch>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ExistingAccountOptions() {
    const wallet = useAltStore<any>(WalletManagerStore as any);
    const has_wallet = wallet.wallet_names.count() != 0;
    return (
        <span>
            {!has_wallet ? (
                <div>
                    <TypedLink to="existing-account/import-backup">
                        <Translate
                            content="wallet.import_backup"
                            wallet_name={getWalletName()}
                        />
                    </TypedLink>
                    <br />
                    <br />
                    <TypedLink to="existing-account/import-keys">
                        <Translate content="wallet.import_bts1" />
                    </TypedLink>
                    <br />
                    <br />
                    <TypedLink to="existing-account/import-keys">
                        <Translate content="wallet.create_wallet" />
                    </TypedLink>
                    <br />
                    <hr />
                </div>
            ) : null}

            {!has_wallet ? null : <BalanceClaimActive />}

            {has_wallet ? (
                <span>
                    <TypedLink to="dashboard">
                        <div className="button outline">
                            <Translate
                                component="span"
                                content="header.dashboard"
                            />
                        </div>
                    </TypedLink>
                    <TypedLink to="wallet">
                        <div className="button outline">
                            <Translate content="settings.wallets" />
                        </div>
                    </TypedLink>
                </span>
            ) : null}
        </span>
    );
}
