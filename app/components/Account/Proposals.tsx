// TypeScript/functional-component port of the legacy Proposals.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `BindToChainState(Component)` (required `account`) replaced by a
// Container gating on `account` under `useChainStoreTick()` - which is
// also a drop-in replacement for this class's own manual
// `ChainStore.subscribe(this.forceUpdate)`/`componentWillUnmount`
// unsubscribe pair (both do exactly "subscribe on mount, unsubscribe on
// unmount, re-render on every chain event").
//
// The class's `this._proposals`/`this._loading` instance fields (mutated
// directly during `render()`, memoizing the derived proposal list across
// renders without going through `setState`) are replicated with
// `useRef()`s, mutated the same way and read back within the same
// render pass - this is a direct translation, not the "render-phase
// setState" pattern used elsewhere in this migration, since the
// original itself never called `setState` for this and relied purely on
// the `ChainStore` subscription (now `useChainStoreTick()`) to trigger
// the next render.
//
// Dropped as confirmed dead: the `ref={"modal"}` legacy string ref on
// `ProposalModal` (never read via `this.refs.modal` anywhere), and the
// `this.state &&` guards before every `this.state.modal.*` access in the
// `ProposalModal` props (vestigial - `this.state` is unconditionally set
// in the constructor, so it was always truthy by the time `render()`
// runs; `useState`'s state is likewise never `undefined` after the
// first render, so the guard has no functional-component equivalent
// worth keeping).
import * as React from "react";
import Translate from "react-translate-component";
import ProposedOperation, {
    TransactionIDAndExpiry
} from "components/Blockchain/ProposedOperation";
import utils from "common/utils";
import ProposalModal, {finalRequiredPerms} from "../Modal/ProposalModal";
import NestedApprovalState from "../Account/NestedApprovalState";
import {ChainStore, ChainTypes as grapheneChainTypes} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import counterpart from "counterpart";
import permission_utils from "common/permission_utils";
import LinkToAccountById from "../Utility/LinkToAccountById";
import AccountStore from "stores/AccountStore";
import accountUtils from "common/account_utils";
import {Tooltip} from "../../design-system/Tooltip";
import JSONModal from "components/Modal/JSONModal";

const {operations} = (grapheneChainTypes as any);
const ops = Object.keys(operations);

interface ProposalsModalState {
    action: any;
    proposalId: any;
    accountId: any;
}

interface ProposalsCoreProps {
    account: any;
    className?: string;
    hideFishingProposals?: boolean;
}

function isScam(proposal: any, account: any) {
    let scam = false;

    const touchedAccounts: any[] = [];
    proposal.operations.forEach((o: any) => {
        if (o.get(0) == 6) {
            touchedAccounts.push(o.getIn([1, "active", "account_auths", 0, 0]));
            touchedAccounts.push(o.getIn([1, "owner", "account_auths", 0, 0]));
        } else {
            touchedAccounts.push(o.getIn([1, "to"]));
        }
    });

    const proposer = proposal.proposal.get("proposer");

    touchedAccounts.push(proposer);

    touchedAccounts.forEach((_account: any) => {
        if ((accountUtils as any).isKnownScammer(_account)) {
            scam = true;
        }
        if (
            account.get("blacklisted_accounts").some((item: any) => {
                return item === _account;
            })
        ) {
            scam = true;
        }
    });
    return scam;
}

function isUnknown(proposal: any, account: any) {
    let unknown = true;

    const touchedAccounts: any[] = [];
    proposal.operations.forEach((o: any) => {
        if (o.get(0) == 6) {
            touchedAccounts.push(o.getIn([1, "active", "account_auths", 0, 0]));
            touchedAccounts.push(o.getIn([1, "owner", "account_auths", 0, 0]));
        } else {
            touchedAccounts.push(o.getIn([1, "to"]));
        }
    });

    const proposer = proposal.proposal.get("proposer");

    touchedAccounts.push(proposer);
    touchedAccounts.forEach((_account: any) => {
        if (
            account.get("whitelisted_accounts").some((item: any) => {
                return item === _account;
            })
        ) {
            unknown = false;
        }
        const starred = (AccountStore as any).getState().starredAccounts;
        if (
            starred.some((item: any) => {
                const name = (ChainStore as any).getAccount(item, false);
                if (!!name) {
                    return name.get("id") == _account;
                } else {
                    return false;
                }
            })
        ) {
            unknown = false;
        }
        const contacts = (AccountStore as any).getState().accountContacts;
        if (
            contacts.some((item: any) => {
                const name = (ChainStore as any).getAccount(item, false);
                if (!!name) {
                    return name.get("id") == _account;
                }
                return false;
            })
        ) {
            unknown = false;
        }
    });
    return unknown;
}

function canReject(proposal: any) {
    return (
        proposal.available_active_approvals.length ||
        proposal.available_owner_approvals.length ||
        proposal.available_key_approvals.length
    );
}

function Proposals({account, className, hideFishingProposals}: ProposalsCoreProps) {
    useChainStoreTick();

    const [isModalVisible, setIsModalVisible] = React.useState(false);
    const [modal, setModal] = React.useState<ProposalsModalState>({
        action: null,
        proposalId: null,
        accountId: null
    });
    const [visibleId, setVisibleId] = React.useState("");

    const proposalsRef = React.useRef<any[]>([]);
    const loadingRef = React.useRef(false);

    const showModal = ({action, proposalId, accountId}: any) => {
        setIsModalVisible(true);
        setModal({action, proposalId, accountId});
    };

    const hideModal = () => {
        setIsModalVisible(false);
        setModal({action: null, proposalId: null, accountId: null});
    };

    const onApproveModal = (proposalId: any, accountId: any, action: any) => {
        showModal({action, proposalId, accountId});
    };

    const openJSONModal = (id: any) => {
        setVisibleId(id);
    };

    const closeJSONModal = () => {
        setVisibleId("");
    };

    const setProposals = () => {
        loadingRef.current = true;
        if (account.get("proposals").size) {
            let proposals: any[] = [];
            account.get("proposals").forEach((proposal_id: any) => {
                const proposal = ChainStore.getObject(proposal_id);
                if (proposal) {
                    const proposed_transaction = (proposal as any).get(
                        "proposed_transaction"
                    );
                    const proposalOperations = proposed_transaction.get(
                        "operations"
                    );
                    proposals.push({
                        operations: proposalOperations,
                        account,
                        proposal
                    });
                }
            });
            proposals = proposals.sort((a, b) => {
                return (utils as any).sortID(
                    a.proposal.get("id"),
                    b.proposal.get("id"),
                    true
                );
            });
            proposals.forEach(proposal => {
                const type = proposal.proposal.get(
                    "required_active_approvals"
                ).size
                    ? "active"
                    : "owner";
                const required = (permission_utils as any).listToIDs(
                    proposal.proposal.get(`required_${type}_approvals`)
                );
                proposal.requiredPermissions = (permission_utils as any).unnest(
                    required,
                    type
                );
            });
            proposalsRef.current = proposals;
            loadingRef.current = false;
        }
    };

    if (!account) return null;

    if (
        (account.get("proposals").size > 0 &&
            proposalsRef.current.length == 0) ||
        (proposalsRef.current.length > 0 &&
            account !== proposalsRef.current[0].account &&
            !loadingRef.current)
    ) {
        setProposals();
    }

    const proposalRows = proposalsRef.current.reduce(
        (result: any[], proposal: any, index: number) => {
            const id = proposal.proposal.get("id");
            const proposer = proposal.proposal.get("proposer");
            const expiration = proposal.proposal.get("expiration_time");
            const trxTypes = counterpart.translate("transaction.trxTypes");
            const proposalOperations =
                proposal.operations && proposal.operations.toJS();
            const title =
                proposalOperations.length > 1
                    ? counterpart.translate("transaction.operations")
                    : (trxTypes as any)[
                          ops[
                              proposalOperations[0] && proposalOperations[0][0]
                          ]
                      ];

            const text = proposal.operations
                .map((o: any, opIndex: number) => {
                    return (
                        <ProposedOperation
                            key={
                                proposal.proposal.get("id") +
                                "_operation_" +
                                opIndex
                            }
                            expiration={expiration}
                            index={opIndex}
                            op={o.toJS()}
                            inverted={false}
                            hideFee={true}
                            hideOpLabel={true}
                            hideExpiration
                            hideDate={true}
                            proposal={true}
                            id={id}
                            proposer={proposer}
                            collapsed={false}
                        />
                    );
                })
                .toArray();

            const proposalCanReject = canReject(proposal.proposal.toJS());
            const proposalId = proposal.proposal.get("id");

            const type = proposal.proposal.get("required_active_approvals")
                .size
                ? "active"
                : "owner";
            result.push(
                <tr key={`${proposalId}_id`}>
                    <td
                        colSpan={4}
                        className={"proposal" + (index === 0 ? " first" : "")}
                    >
                        <TransactionIDAndExpiry
                            id={id}
                            expiration={expiration}
                            style={undefined}
                            openJSONModal={() => openJSONModal(id)}
                        />
                        <JSONModal
                            visible={visibleId === id}
                            operation={
                                proposalOperations.length > 1
                                    ? proposalOperations
                                    : proposalOperations[0] &&
                                      proposalOperations[0][1]
                            }
                            title={title || ""}
                            hideModal={closeJSONModal}
                        />
                    </td>
                </tr>
            );

            const available = (permission_utils as any).listToIDs(
                proposal.proposal.get(`available_${type}_approvals`)
            );
            const availableKeys = (permission_utils as any).listToIDs(
                proposal.proposal.get("available_key_approvals")
            );

            const requiredPermissions = proposal.requiredPermissions;

            const [accounts, keys] = finalRequiredPerms(
                requiredPermissions,
                available,
                availableKeys
            );

            const accountNames: any[] = [];

            if (accounts.length) {
                accounts.forEach((acc: any) => {
                    if (
                        acc &&
                        !proposal.proposal
                            .get(`available_${type}_approvals`)
                            .includes(acc)
                    ) {
                        accountNames.push(acc);
                    }
                });
            }

            const keyNames: any[] = [];
            if (keys.length) {
                keys.forEach((key: any) => {
                    const isMine = (AccountStore as any).isMyKey(key);
                    if (
                        isMine &&
                        !proposal.proposal
                            .get("available_key_approvals")
                            .includes(key)
                    ) {
                        keyNames.push(key);
                    }
                });
            }

            const canApprove = accountNames.length + keyNames.length > 0;

            const proposalIsScam = isScam(proposal, account);
            const proposalIsUnknown = isUnknown(proposal, account);

            result.push(
                <tr className="top-left-align" key={`${proposalId}_content`}>
                    <td>{text}</td>
                    <td>
                        {requiredPermissions.map((acc: any, permIndex: number) => (
                            <div
                                className="list-item"
                                key={`${proposalId}_approver_${permIndex}`}
                            >
                                <LinkToAccountById
                                    subpage="permissions"
                                    account={acc.id}
                                />
                            </div>
                        ))}
                    </td>
                    <td>
                        <NestedApprovalState
                            proposal={proposal.proposal.get("id")}
                            type={type}
                        />
                    </td>
                    <td className="approval-buttons">
                        {proposalIsScam && (
                            <Tooltip
                                title={counterpart.translate(
                                    "tooltip.propose_scam"
                                )}
                            >
                                <div className="tooltip has-error scam-error">
                                    SCAM ATTEMPT
                                </div>
                            </Tooltip>
                        )}
                        {hideFishingProposals &&
                            !proposalIsScam &&
                            proposalIsUnknown && (
                                <Tooltip
                                    title={counterpart.translate(
                                        "tooltip.propose_unknown"
                                    )}
                                >
                                    <div className="tooltip has-error scam-error">
                                        UNKNOWN SOURCE
                                    </div>
                                </Tooltip>
                            )}
                        {!proposalIsScam &&
                            (!proposalIsUnknown || !hideFishingProposals) && (
                                <button
                                    onClick={
                                        canApprove
                                            ? () =>
                                                  onApproveModal(
                                                      proposalId,
                                                      proposal.account.get(
                                                          "id"
                                                      ),
                                                      "approve"
                                                  )
                                            : () => {}
                                    }
                                    className={
                                        "button primary hollow" +
                                        (canApprove ? "" : " hidden")
                                    }
                                >
                                    <span>
                                        <Translate content="proposal.approve" />
                                    </span>
                                </button>
                            )}
                        {proposalCanReject ? (
                            <button
                                onClick={() =>
                                    onApproveModal(
                                        proposalId,
                                        proposal.account.get("id"),
                                        "reject"
                                    )
                                }
                                className="button primary hollow"
                            >
                                <Translate content="proposal.reject" />
                            </button>
                        ) : null}
                        <button
                            onClick={() =>
                                onApproveModal(
                                    proposalId,
                                    proposal.account.get("id"),
                                    "delete"
                                )
                            }
                            className="button primary hollow"
                        >
                            <Translate content="proposal.delete" />
                        </button>
                    </td>
                </tr>
            );
            result.push(
                <tr key={`${proposalId}_separator`}>
                    <td colSpan={4}>
                        <hr />
                    </td>
                </tr>
            );
            return result;
        },
        []
    );

    return (
        <div>
            <table className={"table proposals compact " + className}>
                <thead>
                    <tr>
                        <th>
                            <Translate content="proposal.proposals" />
                        </th>
                        <th>
                            <Translate content="proposal.approvers" />
                        </th>
                        <th>
                            <Translate content="proposal.status" />
                        </th>
                        <th>
                            <Translate content="proposal.action" />
                        </th>
                    </tr>
                </thead>
                <tbody>{proposalRows}</tbody>
            </table>
            <ProposalModal
                visible={isModalVisible}
                hideModal={hideModal}
                showModal={showModal}
                account={modal.accountId}
                proposal={modal.proposalId}
                action={modal.action}
            />
        </div>
    );
}

interface ProposalsContainerProps {
    account: any;
    className?: string;
    hideFishingProposals?: boolean;
}

function ProposalsContainer({
    account,
    className,
    hideFishingProposals
}: ProposalsContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, undefined);

    if (!resolvedAccount) {
        return <span />;
    }

    return (
        <Proposals
            account={resolvedAccount}
            className={className}
            hideFishingProposals={hideFishingProposals}
        />
    );
}

export default ProposalsContainer;
