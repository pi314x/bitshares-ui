// TypeScript/functional-component port of the legacy
// JoinWitnessesModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes, with one exception documented below.
//
// Security-sensitive per AGENTS.md: `onAddWitness` submits an on-chain
// witness create/update transaction via `AccountActions.createWitness`/
// `updateWitness` - transcribed verbatim.
//
// `shouldComponentUpdate` dropped, per this migration's firm precedent
// (also: it had its own bug, comparing `this.state.url` to
// `nextState.visible` - moot once the whole method is dropped, since
// there's no hooks equivalent to preserve it in either form).
//
// `componentDidUpdate` (fetches the witness object for the current
// `account` whenever its id changes, or on the first update if
// `witnessObject` is still `null` - note this means the fetch is *never*
// triggered by the initial mount itself, only by a subsequent prop
// update) runs after every update but *not* the initial mount -
// replicated with a `useEffect` (no dependency array) using its own
// mount-flag ref, the same "componentDidUpdate never fires on mount"
// translation established in `AccountSelector.tsx` (batch 12).
//
// Judgment call (same situation as `JoinCommitteeModal.tsx`, same
// batch): `render()` references a bare `account` identifier
// (`account.get("name")`) that is neither a prop, state, nor
// destructured anywhere in `render()` - a plain-JS-only `ReferenceError`
// waiting to happen (only when `witnessAccount` is falsy), almost
// certainly meant to be `this.props.account`. TypeScript won't compile
// a reference to an undeclared identifier, so - as in
// `JoinCommitteeModal.tsx` - this is read as the `account` prop, the
// only value that both type-checks and is the single plausible reading.
import * as React from "react";
import Translate from "react-translate-component";
import AccountSelector from "../Account/AccountSelector";
import AccountActions from "actions/AccountActions";
import counterpart from "counterpart";
import {Modal, Button, Input, Form} from "bitshares-ui-style-guide";
import Icon from "../Icon/Icon";
import {PublicKey} from "bitsharesjs";
import utils from "common/utils";
import {ChainStore} from "bitsharesjs";

interface JoinWitnessesModalState {
    witnessAccount: any;
    witnessObject: any;
    signingKey: string;
    url: string;
    witness_id?: any;
}

interface JoinWitnessesModalProps {
    visible: boolean;
    hideModal: () => void;
    account: any;
    updateOrCreate?: boolean;
}

export default function JoinWitnessesModal({
    visible,
    hideModal,
    account,
    updateOrCreate
}: JoinWitnessesModalProps) {
    const getInitialState = (): JoinWitnessesModalState => ({
        witnessAccount: account,
        witnessObject: null,
        signingKey: "",
        url: ""
    });

    const [state, setState] = React.useState<JoinWitnessesModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<JoinWitnessesModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const isMountRef = React.useRef(true);
    const prevAccountRef = React.useRef(account);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevAccountRef.current = account;
            return;
        }
        const oldId = prevAccountRef.current.get("id");
        const newId = account.get("id");
        if (newId !== oldId || stateRef.current.witnessObject == null) {
            (ChainStore as any)
                .fetchWitnessByAccount(account.get("id"))
                .then((response: any) => {
                    if (response == null) {
                        hideModal();
                        mergeState({witnessObject: {}});
                    } else {
                        mergeState({
                            witnessObject: response,
                            url: response.get("url"),
                            signingKey: response.get("signing_key"),
                            witness_id: response.get("id")
                        });
                    }
                });
        }
        prevAccountRef.current = account;
    });

    const onAddWitness = () => {
        const {witnessAccount, signingKey, url} = state;
        if (witnessAccount && signingKey) {
            if (updateOrCreate) {
                (AccountActions as any).updateWitness({
                    account: witnessAccount,
                    url: state.url,
                    signingKey: state.signingKey,
                    witness_id: state.witnessObject.get("id")
                });
            } else {
                (AccountActions as any).createWitness({
                    account: witnessAccount,
                    url,
                    signingKey
                });
            }
        }
        hideModal();
    };

    const onChangeCommittee = (changedAccount: any) => {
        mergeState({witnessAccount: changedAccount});
    };

    const onMemoKeyChanged = (e: any) => {
        mergeState({signingKey: e.target.value});
    };

    const onUrlChanged = (e: any) => {
        mergeState({url: (utils as any).sanitize(e.target.value.toLowerCase())});
    };

    const isValidPubKey = (value: any) => {
        return !(PublicKey as any).fromPublicKeyString(value);
    };

    const {witnessAccount, signingKey, url} = state;

    return (
        <Modal
            title={counterpart.translate("modal.witness.create_witness")}
            onCancel={hideModal}
            visible={visible}
            footer={[
                <Button key="submit" type="primary" onClick={onAddWitness}>
                    {counterpart.translate("modal.witness.confirm")}
                </Button>,
                <Button
                    key="cancel"
                    style={{marginLeft: "8px"}}
                    onClick={hideModal}
                >
                    {counterpart.translate("modal.cancel")}
                </Button>
            ]}
        >
            <Form className="full-width" layout="vertical">
                <AccountSelector
                    label="modal.witness.witness_account"
                    accountName={
                        (witnessAccount && witnessAccount.get("name")) ||
                        account.get("name")
                    }
                    account={witnessAccount}
                    onAccountChanged={onChangeCommittee}
                    size={35}
                    typeahead={true}
                />
                <Translate content="modal.witness.text" unsafe component="p" />
                <Form.Item label={counterpart.translate("modal.witness.url")}>
                    <Input
                        value={url}
                        onChange={onUrlChanged}
                        placeholder={counterpart.translate(
                            "modal.witness.web_example"
                        )}
                    />
                </Form.Item>
                <Form.Item
                    label={counterpart.translate(
                        "modal.witness.public_signing_key"
                    )}
                >
                    {isValidPubKey(signingKey) ? (
                        <label
                            className="right-label"
                            style={{
                                marginTop: "-30px",
                                position: "static"
                            }}
                        >
                            <Translate content="modal.witness.invalid_key" />
                        </label>
                    ) : null}

                    <Input
                        addonBefore={
                            <Icon name="key" title="icons.key" size="1x" />
                        }
                        value={signingKey}
                        onChange={onMemoKeyChanged}
                        placeholder={counterpart.translate(
                            "modal.witness.enter_public_signing_key"
                        )}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
