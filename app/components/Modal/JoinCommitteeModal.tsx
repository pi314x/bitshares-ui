// TypeScript/functional-component port of the legacy
// JoinCommitteeModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes, with one exception documented below.
//
// `shouldComponentUpdate` dropped, per this migration's firm precedent
// (no hooks equivalent for a component gating its own re-renders this
// way; never changes rendered output, only how often it's recomputed).
//
// Judgment call (TS compile error, not just a "preserve the bug"
// choice): the original's `render()` references a bare `account`
// identifier twice (`account.get("name")` / `account={committeeAccount
// || account}`) that is neither a prop, a state field, nor destructured
// anywhere in `render()` - almost certainly meant to be `this.props
// .account` (the only `account`-named value anywhere in the class). In
// plain JS this only fails at *runtime* (`ReferenceError`), and only
// when `committeeAccount` is falsy - which happens whenever the
// `AccountSelector`'s `onAccountChanged` callback fires with `null`
// (e.g. the user clears the input), even though `committeeAccount`
// starts as `props.account` at mount. TypeScript, unlike plain JS,
// refuses to *compile* a reference to an identifier that was never
// declared - there is no way to leave this "as broken as the original"
// without breaking the build outright. Read as `account` (the prop)
// here, which is both the only value that makes the code type-check and
// the single plausible reading of what was intended - not a silent
// "improvement" to the component's logic. Fine to leave in the props
// interface, not just recovered from a leftover local.
import * as React from "react";
import Translate from "react-translate-component";
import AccountSelector from "../Account/AccountSelector";
import AccountActions from "actions/AccountActions";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Form} from "../../design-system/Form";
import utils from "common/utils";

interface JoinCommitteeModalState {
    committeeAccount: any;
    url: string;
}

interface JoinCommitteeModalProps {
    visible: boolean;
    hideModal: () => void;
    account: any;
}

export default function JoinCommitteeModal({
    visible,
    hideModal,
    account
}: JoinCommitteeModalProps) {
    const getInitialState = (): JoinCommitteeModalState => ({
        committeeAccount: account,
        url: ""
    });

    const [state, setState] = React.useState<JoinCommitteeModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<JoinCommitteeModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const {url, committeeAccount} = state;

    const onAddComittee = () => {
        if (committeeAccount && url) {
            (AccountActions as any).createCommittee({
                account: committeeAccount,
                url
            });
        }
        hideModal();
    };

    const onChangeCommittee = (changedAccount: any) => {
        mergeState({committeeAccount: changedAccount});
    };

    const onUrlChanged = (e: any) => {
        mergeState({url: (utils as any).sanitize(e.target.value.toLowerCase())});
    };

    const onClose = () => {
        hideModal();
        setState(getInitialState());
    };

    return (
        <Modal
            title={counterpart.translate("modal.committee.create_committee")}
            visible={visible}
            onCancel={hideModal}
            footer={[
                <Button key="submit" variant="accent" onClick={onAddComittee}>
                    {counterpart.translate("modal.committee.confirm")}
                </Button>,
                <Button
                    key="cancel"
                    style={{marginLeft: "8px"}}
                    onClick={onClose}
                >
                    {counterpart.translate("modal.cancel")}
                </Button>
            ]}
        >
            <Form className="full-width" layout="vertical">
                <AccountSelector
                    label="modal.committee.from"
                    accountName={
                        (committeeAccount && committeeAccount.get("name")) ||
                        account.get("name")
                    }
                    account={committeeAccount || account}
                    onAccountChanged={onChangeCommittee}
                    size={35}
                    typeahead={true}
                />
                <Translate content="modal.committee.text" unsafe component="p" />
                <Form.Item label={counterpart.translate("modal.committee.url")}>
                    <Input
                        value={url}
                        onChange={onUrlChanged}
                        placeholder={counterpart.translate(
                            "modal.committee.web_example"
                        )}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
