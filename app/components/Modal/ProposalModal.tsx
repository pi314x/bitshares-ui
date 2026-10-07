// TypeScript/functional-component port of the legacy ProposalModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onProposalAction` submits an
// on-chain `proposal_delete`/`proposal_update` transaction via
// `WalletApi.new_transaction()`/`WalletDb.process_transaction()` -
// transcribed verbatim.
//
// Three original classes, three matching Container+Core pairs (plus the
// outer guard), `ChainTypes`/`BindToChainState` replaced throughout by
// manual `ChainStore` resolution + `useChainStoreTick()`, the same
// approach already used for `NestedApprovalState.tsx`'s `ProposalWrapper`/
// `AccountPermissionTree` (earlier Account/ batch) - `resolveAccountsList`
// below is a local re-implementation of that same file's helper (kept
// per-file rather than shared, matching this migration's convention of
// not introducing new cross-file abstractions beyond what a single port
// needs):
// - `ProposalModal = BindToChainState(ProposalModal)` (optional
//   `accounts: ChainTypes.ChainAccountsList`, not `.isRequired`) becomes
//   `ProposalModalContainer`, resolving `accounts` via
//   `resolveAccountsList` and its own `useChainStoreTick()` - since
//   `accounts` isn't a required prop, there's no "still loading" gate to
//   replicate, matching the original (which would render through with a
//   partially-resolved list rather than blocking).
// - `FirstLevel = BindToChainState(FirstLevel)` (required `account:
//   ChainAccount`, `proposal: ChainObject`) becomes `FirstLevelContainer`,
//   gating on `resolvedAccount === undefined || resolvedProposal ===
//   undefined` (matching `BindToChainState.jsx`'s exact "only `undefined`
//   - genuinely still-loading - blocks; a resolved `null` renders
//   through" semantics) with a blank `<span/>` fallback, since neither
//   wrapped class here declares `defaultProps.tempComponent` or passes
//   `{show_loader: true}` (the "no option" case established throughout
//   this migration). `FirstLevel`'s own `UNSAFE_componentWillMount`
//   (calls `_updateState` once, then `ChainStore.subscribe`) +
//   `componentWillUnmount` unsubscribe is replaced by computing
//   `type`/`requiredPermissions`/`available`/`availableKeys` directly in
//   `FirstLevelCore`'s render body on every render, combined with
//   `useChainStoreTick()` to force a re-render on every chain-store tick
//   - at least as fresh as the original's subscribe-then-setState round
//   trip, same reasoning as `NestedApprovalState.tsx`'s `FirstLevel`.
// - Both `BindToChainState` wraps subscribe to `ChainStore`
//   independently in the original (one on `ProposalModal` itself, one on
//   the outer `FirstLevel`) - replicated with `useChainStoreTick()` in
//   *both* `ProposalModalContainer` and `FirstLevelContainer`, matching
//   the already-established double-subscription treatment from
//   `Proposals.tsx` (Account/ batch 9).
// - `ModalWrapper`'s prop guard (`!account || !proposal || !action` →
//   `null`) is unchanged, just as a function instead of a class.
// - `BindToChainState`'s own `componentDidCatch`/`hasErrored` fallback
//   has no hooks equivalent (error boundaries still require a class
//   component) and isn't replicated here, consistent with every other
//   `BindToChainState` removal in this migration.
//
// `showModal` flows through both Containers via `...rest` but is never
// read anywhere in this file, matching the original (the real caller,
// `Account/Proposals.tsx`, passes it, but no class here ever destructures
// it) - accepted-but-unused, same treatment as other Modal ports.
//
// Lint-forced trim: the original's `_onProposalAction` destructured
// `{active, key, owner, payee}` from state, but only ever read `active`/
// `payee` there (`key`/`owner` are genuinely used elsewhere, in the
// `["active", "owner", "key"].forEach` loop below, just via a fresh
// `stateRef.current[auth_type]` lookup, not that destructure) - dropped
// the two unused names from this one destructure to satisfy
// `no-unused-vars`, which this file is now newly subject to.
import * as React from "react";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import AccountSelect from "components/Forms/AccountSelect";
import AccountStore from "stores/AccountStore";
import WalletDb from "stores/WalletDb";
import WalletApi from "api/WalletApi";
import NestedApprovalState from "../Account/NestedApprovalState";
import pu from "common/permission_utils";
import {ChainStore} from "bitsharesjs";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

export const finalRequiredPerms = (
    requiredPermissions: any,
    available: any,
    availableKeys: any
) => {
    let finalRequired: any[] = [];

    requiredPermissions.forEach((account: any) => {
        finalRequired = finalRequired.concat(account.getMissingSigs(available));
    });

    let finalRequiredKeys: any[] = [];

    requiredPermissions.forEach((account: any) => {
        finalRequiredKeys = finalRequiredKeys.concat(
            account.getMissingKeys(availableKeys)
        );
    });

    return [finalRequired, finalRequiredKeys];
};

function resolveAccountsList(prop: any, autosubscribe?: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        if (obj_id) {
            result[index] = (ChainStore as any).getAccount(
                obj_id,
                autosubscribe
            );
        }
        ++index;
    });
    return result;
}

interface ProposalModalState {
    active: any;
    key: any;
    owner: any;
    payee: any;
}

interface ProposalModalCoreProps {
    accounts: any[];
    keys: any[];
    proposal: any;
    type: any;
    action: any;
    account: any;
    visible: any;
    hideModal: () => void;
    showModal?: () => void;
}

function ProposalModalCore({
    accounts,
    keys,
    proposal,
    type,
    action,
    account,
    visible,
    hideModal
}: ProposalModalCoreProps) {
    const [state, setState] = React.useState<ProposalModalState>({
        active: null,
        key: null,
        owner: null,
        payee: null
    });

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const onActiveAccount = (
        accountMap: any,
        keyMap: any,
        authType: any,
        selectedAccount: any
    ) => {
        const newState: any = {};

        if (keyMap[selectedAccount]) {
            newState["key"] = selectedAccount;
            newState[authType] = null;
        } else if (selectedAccount) {
            newState[authType] = accountMap[selectedAccount];
            newState["key"] = null;
        } else {
            newState[authType] = null;
            newState["key"] = null;
        }
        setState(prev => ({...prev, ...newState}));
    };

    const onProposalAction = (oldProposal: any) => {
        const proposalObject = oldProposal.toJS();
        const {active, payee} = stateRef.current;
        const fee_paying_account = payee || active;

        if (action === "delete") {
            const transaction = (WalletApi as any).new_transaction();
            transaction.add_type_operation("proposal_delete", {
                fee_paying_account: fee_paying_account || account.get("id"),
                proposal: proposalObject.id,
                using_owner_authority: false
            });
            (WalletDb as any).process_transaction(transaction, null, true);
        } else {
            const proposalUpdate: any = {
                fee_paying_account,
                proposal: proposalObject.id,
                active_approvals_to_add: [],
                active_approvals_to_remove: [],
                owner_approvals_to_add: [],
                owner_approvals_to_remove: [],
                key_approvals_to_add: [],
                key_approvals_to_remove: []
            };

            const isAdd = action === "approve";
            const neededKeys: any[] = [];

            ["active", "owner", "key"].forEach(auth_type => {
                const value = (stateRef.current as any)[auth_type];
                if (value) {
                    const hasValue =
                        proposalObject[
                            `available_${auth_type}_approvals`
                        ].indexOf(value) !== -1;
                    if ((isAdd && !hasValue) || (!isAdd && hasValue)) {
                        if (action === "approve") {
                            proposalUpdate[`${auth_type}_approvals_to_add`] = [
                                value
                            ];
                            if (auth_type === "key") neededKeys.push(value);
                        } else if (action === "reject") {
                            proposalUpdate[
                                `${auth_type}_approvals_to_remove`
                            ] = [value];
                            if (auth_type === "key") neededKeys.push(value);
                        }
                    }
                }
            });

            const tr = (WalletApi as any).new_transaction();
            tr.add_type_operation("proposal_update", proposalUpdate);
            (WalletDb as any).process_transaction(
                tr,
                null,
                true,
                neededKeys
            );
        }

        hideModal();
    };

    const onChangePayee = (accountName: any) => {
        const fullAccount = (ChainStore as any).getAccount(accountName);

        if (fullAccount) {
            setState(prev => ({...prev, payee: fullAccount.get("id")}));
        }
    };

    const onCancel = () => {
        hideModal();
    };

    const accountNames: any[] = [];
    const accountMap: any = {};
    const isAdd = action === "approve";

    if (accounts.length) {
        accounts.forEach((acc: any) => {
            const accountCheck = isAdd
                ? acc &&
                  !proposal
                      .get(`available_${type}_approvals`)
                      .includes(acc.get("id"))
                : acc &&
                  proposal
                      .get(`available_${type}_approvals`)
                      .includes(acc.get("id"));
            if (accountCheck) {
                accountMap[acc.get("name")] = acc.get("id");
                accountNames.push(acc.get("name"));
            }
        });
    }

    const keyNames: any[] = [];
    const keyMap: any = {};
    if (keys.length) {
        keys.forEach((key: any) => {
            const isMine = (AccountStore as any).isMyKey(key);
            const hasValue = proposal
                .get("available_key_approvals")
                .includes(key);
            if (
                (isMine && isAdd && !hasValue) ||
                (isMine && !isAdd && hasValue)
            ) {
                keyMap[key] = true;
                keyNames.push(key);
            }
        });
    }

    const myAccounts = (AccountStore as any).getMyAccounts();

    const footer = [
        <Button
            key="submit"
            variant="accent"
            onClick={() => onProposalAction(proposal)}
        >
            {counterpart.translate(`proposal.${action}`)}
        </Button>,
        <Button key="cancel" onClick={onCancel}>
            {counterpart.translate("account.perm.cancel")}
        </Button>
    ];

    return (
        <Modal
            visible={visible}
            title={counterpart.translate(
                `modal.proposals.actions.${action}`
            )}
            footer={footer}
            onCancel={hideModal}
        >
            <div className="grid-block vertical">
                <form
                    className="grid-block vertical full-width-content"
                    style={{paddingTop: 0}}
                >
                    <div className="grid-container">
                        <div
                            className="content-block"
                            style={{paddingRight: "20%"}}
                        >
                            <NestedApprovalState
                                expanded
                                proposal={proposal.get("id")}
                                type={type}
                                added={
                                    isAdd
                                        ? state.key
                                            ? state.key
                                            : (state as any)[type] || null
                                        : null
                                }
                                removed={
                                    !isAdd
                                        ? state.key
                                            ? state.key
                                            : (state as any)[type] || null
                                        : null
                                }
                                noFail
                            />
                        </div>

                        <div className="content-block full-width-content">
                            <div className="full-width-content form-group">
                                <Translate
                                    content="modal.proposals.pay_with"
                                    component="label"
                                />
                                <AccountSelect
                                    account_names={myAccounts}
                                    onChange={onChangePayee}
                                    selected={
                                        myAccounts.length === 1
                                            ? myAccounts
                                            : null
                                    }
                                />
                            </div>

                            {action !== "delete" &&
                            (accountNames.length || keyNames.length) ? (
                                <div className="full-width-content form-group">
                                    <Translate
                                        content={`modal.proposals.approval_${
                                            isAdd ? "add" : "remove"
                                        }`}
                                        component="label"
                                    />
                                    <AccountSelect
                                        account_names={accountNames.concat(
                                            keyNames
                                        )}
                                        onChange={(selected: any) =>
                                            onActiveAccount(
                                                accountMap,
                                                keyMap,
                                                type,
                                                selected
                                            )
                                        }
                                    />
                                </div>
                            ) : null}

                            {false && keyNames.length ? (
                                <div className="full-width-content form-group">
                                    <Translate
                                        content={`modal.proposals.key_approval_${
                                            isAdd ? "add" : "remove"
                                        }`}
                                        component="label"
                                    />
                                    <AccountSelect
                                        account_names={keyNames}
                                        onChange={(selected: any) =>
                                            onActiveAccount(
                                                keyMap,
                                                "key",
                                                selected,
                                                undefined
                                            )
                                        }
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

interface ProposalModalContainerProps {
    accounts?: any;
    [key: string]: any;
}

function ProposalModalContainer({
    accounts,
    ...rest
}: ProposalModalContainerProps) {
    useChainStoreTick();
    const resolvedAccounts = resolveAccountsList(accounts, undefined);

    return (
        <ProposalModalCore {...(rest as any)} accounts={resolvedAccounts} />
    );
}

interface FirstLevelCoreProps {
    account: any;
    proposal: any;
    action: any;
    [key: string]: any;
}

function FirstLevelCore({
    account,
    proposal,
    action,
    ...rest
}: FirstLevelCoreProps) {
    useChainStoreTick();

    const type = proposal.get("required_active_approvals").size
        ? "active"
        : "owner";
    const required = (pu as any).listToIDs(
        proposal.get(`required_${type}_approvals`)
    );
    const available = (pu as any).listToIDs(
        proposal.get(`available_${type}_approvals`)
    );
    const availableKeys = (pu as any).listToIDs(
        proposal.get("available_key_approvals")
    );
    const requiredPermissions = (pu as any).unnest(required, type);

    const [finalRequired, finalRequiredKeys] = finalRequiredPerms(
        requiredPermissions,
        available,
        availableKeys
    );

    return (
        <ProposalModalContainer
            {...rest}
            account={account}
            proposal={proposal}
            action={action}
            type={type}
            accounts={action === "approve" ? finalRequired : available}
            keys={action === "approve" ? finalRequiredKeys : availableKeys}
        />
    );
}

interface FirstLevelContainerProps {
    account: string;
    proposal: string;
    action: any;
    [key: string]: any;
}

function FirstLevelContainer({
    account,
    proposal,
    ...rest
}: FirstLevelContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account);
    const resolvedProposal = (ChainStore as any).getObject(proposal);

    if (resolvedAccount === undefined || resolvedProposal === undefined) {
        return <span />;
    }

    return (
        <FirstLevelCore
            {...rest}
            account={resolvedAccount}
            proposal={resolvedProposal}
        />
    );
}

interface ModalWrapperProps {
    account?: any;
    proposal?: any;
    action?: any;
    [key: string]: any;
}

function ModalWrapper(props: ModalWrapperProps) {
    if (!props.account || !props.proposal || !props.action) return null;

    return <FirstLevelContainer {...(props as any)} />;
}

export default ModalWrapper;
