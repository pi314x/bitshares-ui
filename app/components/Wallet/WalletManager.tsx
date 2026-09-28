// TypeScript/functional-component port of the legacy WalletManager.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): `ChangeActiveWallet`'s
// `UNSAFE_componentWillReceiveProps` compares the *incoming* prop against
// the *current local state* (`np.current_wallet !== this.state.current_wallet`),
// not against the previous prop. That means any re-render this component
// receives from its WalletManagerStore subscription - not just one where
// `current_wallet` itself changed - resets the user's pending, unconfirmed
// wallet-switch dropdown selection back to the real current wallet if it
// doesn't happen to match. Replicated with the same comparison, executed
// synchronously in the render body: since local state starts out already
// equal to the store's `current_wallet` (a `useState` lazy initializer,
// mirroring `UNSAFE_componentWillMount`'s pre-paint timing), the
// comparison is naturally false on the first render, matching the
// original not firing this on mount either.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import WalletActions from "actions/WalletActions";
import BackupActions from "actions/BackupActions";
import WalletManagerStore from "stores/WalletManagerStore";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {Switch, Route} from "react-router-dom";
import {ExistingAccountOptions} from "./ExistingAccount";
import ImportKeys from "./ImportKeys";
import BalanceClaimActive from "./BalanceClaimActive";
import WalletChangePassword from "./WalletChangePassword";
import {WalletCreate} from "./WalletCreate";
import {BackupCreate, BackupRestore} from "./Backup";
import BackupBrainkey from "./BackupBrainkey";
import {Form, Select, Input, Button, Card} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

const FormItem = Form.Item;
const Option = Select.Option;

// See Explorer/Blocks.tsx's comment on `TypedLink` for why this cast is
// needed - `Link`'s inferred return type isn't a valid JSX element type
// under this project's React/TS version combination.
const TypedLink = Link as React.ComponentType<LinkProps>;

function getTitle(pathname: string) {
    switch (pathname) {
        case "/wallet/create":
            return "wallet.create_wallet";

        case "/wallet/backup/create":
            return "wallet.create_backup";

        case "/wallet/backup/restore":
            return "wallet.restore_backup";

        case "/wallet/backup/brainkey":
            return "wallet.backup_brainkey";

        case "/wallet/delete":
            return "wallet.delete_wallet";

        case "/wallet/change-password":
            return "wallet.change_password";

        case "/wallet/import-keys":
            return "wallet.import_keys";

        default:
            return "wallet.console";
    }
}

export default function WalletManager({
    location
}: {
    location: {pathname: string};
}) {
    return (
        <div className="grid-block vertical">
            <div className="grid-container" style={{maxWidth: "40rem"}}>
                <div className="content-block">
                    <div className="page-header">
                        <Translate
                            component="h3"
                            content={getTitle(location.pathname)}
                        />
                    </div>
                    <div className="content-block">
                        <Switch>
                            <Route
                                exact
                                path="/wallet"
                                component={WalletOptions}
                            />
                            <Route
                                exact
                                path="/wallet/change"
                                component={ChangeActiveWallet}
                            />
                            <Route
                                exact
                                path="/wallet/change-password"
                                component={WalletChangePassword}
                            />
                            <Route
                                exact
                                path="/wallet/import-keys"
                                component={ImportKeys}
                            />
                            <Route
                                exact
                                path="/wallet/brainkey"
                                component={ExistingAccountOptions}
                            />
                            <Route
                                exact
                                path="/wallet/create"
                                component={WalletCreate}
                            />
                            <Route
                                exact
                                path="/wallet/delete"
                                component={WalletDelete}
                            />
                            <Route
                                exact
                                path="/wallet/backup/restore"
                                component={BackupRestore}
                            />
                            <Route
                                exact
                                path="/wallet/backup/create"
                                component={BackupCreate}
                            />
                            <Route
                                exact
                                path="/wallet/backup/brainkey"
                                component={BackupBrainkey}
                            />
                            <Route
                                exact
                                path="/wallet/balance-claims"
                                component={BalanceClaimActive}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function WalletOptions() {
    const {current_wallet, wallet_names} = useAltStore<any>(
        WalletManagerStore as any
    );
    const has_wallet = !!current_wallet;
    const has_wallets = wallet_names.size > 1;
    const currentWalletLabel = current_wallet
        ? current_wallet.toUpperCase()
        : "";
    return (
        <span>
            <div className="grid-block">
                <div className="grid-content">
                    <Card>
                        <label>
                            <Translate content="wallet.active_wallet" />:
                        </label>
                        <div>{currentWalletLabel}</div>
                        <br />
                        {has_wallets ? (
                            <TypedLink to="/wallet/change">
                                <div className="button outline success">
                                    <Translate content="wallet.change_wallet" />
                                </div>
                            </TypedLink>
                        ) : null}
                    </Card>
                </div>

                <div className="grid-content">
                    <Card>
                        <label>
                            <Translate content="wallet.import_keys_tool" />
                        </label>
                        <div style={{visibility: "hidden"}}>Dummy</div>
                        <br />
                        {has_wallet ? (
                            <TypedLink to="/wallet/import-keys">
                                <div className="button outline success">
                                    <Translate content="wallet.import_keys" />
                                </div>
                            </TypedLink>
                        ) : null}
                    </Card>
                </div>

                {has_wallet ? (
                    <div className="grid-content">
                        <Card>
                            <label>
                                <Translate content="wallet.balance_claims" />
                            </label>
                            <div style={{visibility: "hidden"}}>Dummy</div>
                            <br />
                            <TypedLink to="/wallet/balance-claims">
                                <div className="button outline success">
                                    <Translate content="wallet.balance_claim_lookup" />
                                </div>
                            </TypedLink>
                            {/*<BalanceClaimByAsset>
                            <br/>
                            <div className="button outline success">
                                <Translate content="wallet.balance_claims" /></div>
                        </BalanceClaimByAsset>
                        */}
                        </Card>
                    </div>
                ) : null}
            </div>

            {has_wallet ? (
                <TypedLink to="/wallet/backup/create">
                    <div className="button outline success">
                        <Translate content="wallet.create_backup" />
                    </div>
                </TypedLink>
            ) : null}

            {has_wallet ? (
                <TypedLink to="/wallet/backup/brainkey">
                    <div className="button outline success">
                        <Translate content="wallet.backup_brainkey" />
                    </div>
                </TypedLink>
            ) : null}

            <TypedLink to="/wallet/backup/restore">
                <div className="button outline success">
                    <Translate content="wallet.restore_backup" />
                </div>
            </TypedLink>

            <br />

            {has_wallet ? <br /> : null}

            <TypedLink to="/wallet/create">
                <div className="button outline success">
                    <Translate content="wallet.new_wallet" />
                </div>
            </TypedLink>

            {has_wallet ? (
                <TypedLink to="/wallet/delete">
                    <div className="button outline success">
                        <Translate content="wallet.delete_wallet" />
                    </div>
                </TypedLink>
            ) : null}

            {has_wallet ? (
                <TypedLink to="/wallet/change-password">
                    <div className="button outline success">
                        <Translate content="wallet.change_password" />
                    </div>
                </TypedLink>
            ) : null}
        </span>
    );
}

export function ChangeActiveWallet() {
    const walletManagerState = useAltStore<any>(WalletManagerStore as any);

    const [currentWallet, setCurrentWallet] = React.useState<string>(
        () => walletManagerState.current_wallet
    );
    if (walletManagerState.current_wallet !== currentWallet) {
        setCurrentWallet(walletManagerState.current_wallet);
    }

    const options: any[] = [];
    walletManagerState.wallet_names.forEach((wallet_name: string) => {
        options.push(
            <Option key={wallet_name} value={wallet_name}>
                {wallet_name.toLowerCase()}
            </Option>
        );
    });

    const is_dirty = currentWallet !== walletManagerState.current_wallet;

    const onChange = (value: string) => {
        setCurrentWallet(value);
    };

    const onConfirm = () => {
        (WalletActions as any).setWallet(currentWallet);
        (BackupActions as any).reset();
        // if (window.electron) {
        //     window.location.hash = "";
        //     window.remote.getCurrentWindow().reload();
        // }
        // else window.location.href = "/";
    };

    return (
        <div>
            <section>
                <FormItem
                    label={counterpart.translate("wallet.active_wallet")}
                    className="no-offset"
                >
                    <ul className={"unstyled-list"}>
                        <li className="with-dropdown" style={{borderBottom: 0}}>
                            {walletManagerState.wallet_names.count() <= 1 ? (
                                <Input
                                    className="settings--input"
                                    defaultValue={currentWallet}
                                    disabled
                                />
                            ) : (
                                <Select
                                    className="settings--select"
                                    value={currentWallet}
                                    onChange={onChange}
                                >
                                    {options}
                                </Select>
                            )}
                        </li>
                    </ul>
                </FormItem>
            </section>
            <TypedLink to="/wallet/create">
                <Button style={{marginRight: "16px"}}>
                    <Translate content="wallet.new_wallet" />
                </Button>
            </TypedLink>

            {is_dirty ? (
                <Button onClick={onConfirm}>
                    <Translate content="wallet.change" name={currentWallet} />
                </Button>
            ) : null}
        </div>
    );
}

export function WalletDelete() {
    const {wallet_names} = useAltStore<any>(WalletManagerStore as any);

    const [selectedWallet, setSelectedWallet] = React.useState<string | null>(
        null
    );
    const [confirm, setConfirm] = React.useState(0);

    const _onCancel = () => {
        setConfirm(0);
        setSelectedWallet(null);
    };

    const onConfirm = () => {
        setConfirm(1);
    };

    const onConfirm2 = () => {
        (WalletActions as any).deleteWallet(selectedWallet);
        _onCancel();
        // window.history.back()
    };

    const onChange = (value: string) => {
        setSelectedWallet(value);
    };

    if (confirm === 1) {
        return (
            <div style={{paddingTop: 20}}>
                <h4>
                    <Translate content="wallet.delete_confirm_line1" />
                </h4>
                <Translate
                    component="p"
                    content="wallet.delete_confirm_line3"
                />
                <br />
                <Button onClick={onConfirm2} style={{marginRight: "16px"}}>
                    <Translate
                        content="wallet.delete_confirm_line4"
                        name={selectedWallet}
                    />
                </Button>
                <Button onClick={_onCancel}>
                    <Translate content="wallet.cancel" />
                </Button>
            </div>
        );
    }

    // this.props.current_wallet
    const placeholder = (
        <Option key="placeholder" value=" " disabled={wallet_names.size > 1}>
            &nbsp;
        </Option>
    );
    // if (this.props.wallet_names.size > 1) {
    //     placeholder = <option value="" disabled>{placeholder}</option>;
    // }
    // else {
    //     //When disabled and list_size was 1, chrome was skipping the
    //     //placeholder and selecting the 1st item automatically (not shown)
    //     placeholder = <option value="">{placeholder}</option>;
    // }
    const options = [placeholder];
    options.push(
        <Option key="select_option" value="">
            {counterpart.translate("settings.delete_select")}
            &hellip;
        </Option>
    );
    wallet_names.forEach((wallet_name: string) => {
        options.push(
            <Option key={wallet_name} value={wallet_name}>
                {wallet_name.toLowerCase()}
            </Option>
        );
    });
    const is_dirty = !!selectedWallet;

    return (
        <div style={{paddingTop: 20}}>
            <section>
                <FormItem
                    label={counterpart.translate("wallet.delete_wallet")}
                    className="no-offset"
                >
                    <ul className={"unstyled-list"}>
                        <li className="with-dropdown" style={{borderBottom: 0}}>
                            <Select
                                className="settings--select"
                                value={selectedWallet || ""}
                                style={{margin: "0 auto"}}
                                onChange={onChange}
                            >
                                {options}
                            </Select>
                        </li>
                    </ul>
                </FormItem>
            </section>
            <Button disabled={!is_dirty} onClick={onConfirm}>
                <Translate
                    content={
                        selectedWallet
                            ? "wallet.delete_wallet_name"
                            : "wallet.delete_wallet"
                    }
                    name={selectedWallet}
                />
            </Button>
        </div>
    );
}
