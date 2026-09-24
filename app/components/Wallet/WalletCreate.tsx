// TypeScript/functional-component port of the legacy WalletCreate.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// Security-sensitive per AGENTS.md: calls the real
// `WalletActions.setWallet(wallet_public_name, valid_password, brnkey)`
// exactly as before - passwords/brainkeys live only in local state, never
// logged.
//
// `CreateNewWallet`'s original `formChange` deliberately mutates
// `this.state` directly (its own comment: "Set state is updated directly
// because validate is going to require a merge of new and old state")
// rather than going through `setState`'s async queue - this matters
// because `<Form onChange={formChange}>` wrapping the whole form means
// React's synthetic `onChange` bubbles up from *any* nested input's
// change event (including `PasswordConfirmStyleGuide`'s and
// `BrainkeyInputStyleGuide`'s own inputs, deep inside `Form.Item`s), so
// `formChange`/`validate` can run more than once per keystroke, reading
// whatever the live `this.state` holds *at that instant* - a live mutable
// object, not a per-render snapshot. A plain per-field `useState` would
// only see the *previous render's* snapshot inside such same-tick calls,
// changing real behavior. Replicated with a `useRef`-held mutable state
// object (mirroring `this.state`) plus a render-triggering counter,
// exactly matching the original's live-mutation-then-notify semantics.
//
// Dropped as confirmed dead, not ported: the `hideTitle` prop (declared
// in the original's `propTypes`, never read anywhere in its `render()`).
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import Translate from "react-translate-component";
import BrainkeyInput from "components/Wallet/BrainkeyInputStyleGuide";
import PasswordConfirm from "components/Wallet/PasswordConfirmStyleGuide";
import WalletDb from "stores/WalletDb";
import WalletManagerStore from "stores/WalletManagerStore";
import WalletActions from "actions/WalletActions";
import SettingsActions from "actions/SettingsActions";
import {getWalletName} from "branding";
import {Button, Form, Input} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

// See Explorer/Blocks.tsx's comment on `TypedLink` for why this cast is
// needed - `Link`'s inferred return type isn't a valid JSX element type
// under this project's React/TS version combination.
const TypedLink = Link as React.ComponentType<LinkProps>;

interface CreateNewWalletState {
    wallet_public_name: string;
    valid_password: string | null;
    errors: {validBrainkey: boolean; wallet_public_name?: string | null};
    isValid: boolean;
    create_submitted: boolean;
    custom_brainkey: boolean;
    brnkey: string | null;
}

function CreateNewWallet({restoreBrainkey}: {restoreBrainkey?: boolean}) {
    const {wallet_names, current_wallet} = useAltStore<any>(
        WalletManagerStore as any
    );

    const stateRef = React.useRef<CreateNewWalletState>({
        wallet_public_name: "default",
        valid_password: null,
        errors: {
            validBrainkey: false
        },
        isValid: false,
        create_submitted: false,
        custom_brainkey: restoreBrainkey || false,
        brnkey: null
    });
    const [, setRenderTick] = React.useState(0);
    const rerender = () => setRenderTick(n => n + 1);

    const setState = (
        patch: Partial<CreateNewWalletState>,
        callback?: () => void
    ) => {
        Object.assign(stateRef.current, patch);
        rerender();
        if (callback) callback();
    };

    const validate = (state: CreateNewWalletState = stateRef.current) => {
        const errors = state.errors;
        errors.wallet_public_name = !wallet_names.has(state.wallet_public_name)
            ? null
            : `Wallet ${state.wallet_public_name.toUpperCase()} exists, please change the name`;

        let isValid =
            errors.wallet_public_name === null && state.valid_password !== null;
        if (state.custom_brainkey && isValid) isValid = state.brnkey !== null;
        setState({isValid, errors});
    };

    const onBack = (e: any) => {
        e.preventDefault();
        window.history.back();
    };

    const onPassword = (valid_password: string | null) => {
        if (valid_password !== stateRef.current.valid_password)
            setState({valid_password}, validate);
    };

    const onCustomBrainkey = () => {
        setState({custom_brainkey: true});
    };

    const onBrainkey = (brnkey: string | null) => {
        setState({brnkey}, validate);
    };

    const onSubmit = (e: any) => {
        e.preventDefault();

        const {
            wallet_public_name,
            valid_password,
            custom_brainkey,
            errors
        } = stateRef.current;
        if (
            !valid_password ||
            errors.wallet_public_name ||
            (custom_brainkey && !errors.validBrainkey)
        ) {
            return;
        }

        (WalletActions as any).setWallet(
            wallet_public_name,
            valid_password,
            stateRef.current.brnkey
        );
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: false
        });
        setState({create_submitted: true});
    };

    const formChange = (event: any) => {
        const key_id = event.target.id;
        let value = event.target.value;
        if (key_id === "wallet_public_name") {
            //case in-sensitive
            value = value.toLowerCase();
            // Allow only valid file name characters
            if (/[^a-z0-9_-]/.test(value)) return;
        }

        // Set state is updated directly because validate is going to
        // require a merge of new and old state
        (stateRef.current as any)[key_id] = value;
        setState(stateRef.current);
        validate();
    };

    const state = stateRef.current;
    const errors = state.errors;
    const has_wallet = !!current_wallet;

    if (state.create_submitted && state.wallet_public_name === current_wallet) {
        return (
            <div>
                <h4>
                    <Translate content="wallet.wallet_created" />
                </h4>
                <TypedLink to="/">
                    <div className="button success">
                        <Translate content="wallet.done" />
                    </div>
                </TypedLink>
            </div>
        );
    }

    return (
        <div className="wallet-create">
            <Form
                style={{maxWidth: "40rem"}}
                onSubmit={onSubmit}
                onChange={formChange}
                noValidate
            >
                <div
                    className="grid-content"
                    style={{
                        textAlign: "left"
                    }}
                >
                    {!restoreBrainkey ? (
                        <React.Fragment>
                            <Translate
                                component="p"
                                content="wallet.create_importkeys_text"
                            />
                            <Translate
                                component="p"
                                content="wallet.create_text"
                                wallet_name={getWalletName()}
                            />
                        </React.Fragment>
                    ) : null}
                </div>
                <PasswordConfirm onValid={onPassword} />
                {has_wallet ? (
                    <Form.Item label={counterpart.translate("wallet.name")}>
                        <div className="no-overflow">
                            <section>
                                <Input
                                    tabIndex={3}
                                    type="text"
                                    id="wallet_public_name"
                                    defaultValue={state.wallet_public_name}
                                />
                                <div className="has-error">
                                    {errors.wallet_public_name}
                                </div>
                            </section>
                        </div>
                    </Form.Item>
                ) : null}

                <div className="no-overflow">
                    {state.custom_brainkey ? (
                        <div>
                            <Form.Item
                                label={counterpart.translate("wallet.brainkey")}
                            >
                                <BrainkeyInput
                                    tabIndex={4}
                                    onChange={onBrainkey}
                                    errorCallback={(warn: boolean) => {
                                        const {errors} = stateRef.current;
                                        errors.validBrainkey = warn;
                                        setState({errors});
                                    }}
                                />
                            </Form.Item>
                        </div>
                    ) : null}

                    <Button
                        type="primary"
                        htmlType="submit"
                        disabled={!state.isValid}
                    >
                        <Translate content="wallet.create_wallet" />
                    </Button>

                    <Button onClick={onBack}>
                        <Translate content="wallet.cancel" />
                    </Button>
                </div>

                {!state.custom_brainkey ? (
                    <div style={{paddingTop: 20}}>
                        <label>
                            <a onClick={onCustomBrainkey}>
                                <Translate content="wallet.custom_brainkey" />
                            </a>
                        </label>
                    </div>
                ) : null}
            </Form>
        </div>
    );
}

export function WalletCreate(props: {
    children?: any;
    restoreBrainkey?: boolean;
}) {
    if ((WalletDb as any).getWallet() && props.children)
        return <div>{props.children}</div>;

    return <CreateNewWallet restoreBrainkey={props.restoreBrainkey} />;
}

export const CreateWalletFromBrainkey = (props: {
    nested?: boolean;
    [key: string]: any;
}) => {
    const wallet_types = (
        <TypedLink to="/help/introduction/wallets">
            {counterpart.translate("wallet.wallet_types")}
        </TypedLink>
    );
    const backup_types = (
        <TypedLink to="/help/introduction/backups">
            {counterpart.translate("wallet.backup_types")}
        </TypedLink>
    );

    if (!props.nested) {
        return (
            <div className="grid-container" style={{paddingTop: 30}}>
                <Translate content="settings.backup_brainkey" component="h3" />
                <Translate
                    content="settings.restore_brainkey_text"
                    component="p"
                    style={{maxWidth: "40rem"}}
                />
                <Translate
                    component="p"
                    style={{paddingBottom: 10}}
                    wallet={wallet_types}
                    backup={backup_types}
                    content="wallet.read_more"
                />
                <WalletCreate restoreBrainkey {...props} />
            </div>
        );
    }
    return <WalletCreate restoreBrainkey {...props} />;
};
