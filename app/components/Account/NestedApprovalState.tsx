// TypeScript/functional-component port of the legacy
// NestedApprovalState.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Structural changes (not behavior changes):
// - `AccountPermissionTree`'s `BindToChainState(Component)` (required
//   `account`) replaced by a Container+Core split under
//   `useChainStoreTick()`, same recursive-usage pattern as the original
//   (the Container is what's used recursively, matching `BoundAccount
//   PermissionTree` in the original). Its `accounts` prop
//   (`ChainTypes.ChainAccountsList`) is declared in propTypes but never
//   actually read anywhere in the component (only threaded down
//   recursively to children, who also never read it) - confirmed dead,
//   so no resolution Container is built for it here.
// - `FirstLevel`'s `BindToChainState(Component)` (optional `required`/
//   `available` lists) replaced by a Container replicating
//   `BindToChainState.jsx`'s `chain_accounts_list` resolution loop
//   directly - unlike `chain_objects_list`/`chain_assets_list` (ported
//   in earlier batches), this resolution loop increments its index
//   *after* assigning, so it has no sparse-array/off-by-one quirk.
// - `FirstLevel`'s `UNSAFE_componentWillMount` + manual
//   `ChainStore.subscribe(this._updateState)`/`componentWillUnmount`
//   unsubscribe (recomputing `requiredPermissions`/`required`/`available`
//   on every chain-store tick, not just on prop changes) is replaced by
//   computing those same values directly in the render body on every
//   render, combined with `useChainStoreTick()` to force a re-render on
//   every chain-store tick - at least as fresh as the original's
//   subscribe-then-setState round trip, without the possibility of a
//   render showing stale derived data in between.
// - `ProposalWrapper`'s `BindToChainState(Component)` (required
//   `proposal`, `globalObject`) replaced by a Container gating on both.
import * as React from "react";
import LinkToAccountById from "../Utility/LinkToAccountById";
import pu from "common/permission_utils";
import {cloneDeep} from "lodash-es";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {
    AuthorityDepthOverflowWarning,
    ChildAuthorityDepthOverflowWarning,
    Pending,
    Review,
    Failed,
    ExpandButton,
    ApprovedIcon,
    KeyPermissionBranch,
    hasAuthorityDepthProblem,
    isApproved,
    statusText,
    notNestdWeight
} from "./NestedApprovalStateLib";

function resolveAccountsList(prop: any, autosubscribe: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        if (obj_id) {
            result[index] = (ChainStore as any).getAccount(obj_id, autosubscribe);
        }
        ++index;
    });
    return result;
}

interface AccountPermissionTreeCoreProps {
    account: any;
    accounts?: any;
    available: any;
    availableKeys: any;
    permission: any;
    threshold?: any;
    level: number;
    maxAuthorityDepth: any;
    hideRoot?: boolean;
    expanded?: boolean;
}

function AccountPermissionTreeCore({
    account,
    available,
    availableKeys,
    permission,
    threshold,
    level,
    maxAuthorityDepth,
    hideRoot,
    expanded: expandedProp
}: AccountPermissionTreeCoreProps) {
    const [expanded, setExpanded] = React.useState(!!expandedProp);

    const handleExpandToggle = () => {
        setExpanded(!expanded);
    };

    const isOK = isApproved(permission, available, availableKeys);
    const isNested = permission.isNested();
    const isMultiSig = permission.isMultiSig();

    const notNestedWeight = notNestdWeight(permission.weight, threshold) || 1;

    const nestedWeight = statusText(permission, available, availableKeys);

    const authorityDepthOverflow = level >= maxAuthorityDepth;

    const rootPerm =
        !isNested && !isMultiSig ? (
            <tr>
                <td colSpan={2}>
                    <ApprovedIcon approved={isOK} />
                    <LinkToAccountById subpage="permissions" account={account.get("id")} />
                </td>
                <td>
                    {!isNested && notNestedWeight
                        ? `${
                              (notNestedWeight as any) &&
                              (notNestedWeight as any).length === 2
                                  ? "  "
                                  : ""
                          }${notNestedWeight} `
                        : null}
                </td>
            </tr>
        ) : (
            <tr>
                <td colSpan={2}>
                    <ApprovedIcon approved={isOK} />
                    <LinkToAccountById subpage="permissions" account={account.get("id")} />
                </td>
                <td>
                    {expanded ? (
                        <span className={isOK ? "success-text" : ""}>
                            {notNestedWeight}
                        </span>
                    ) : (
                        notNestedWeight &&
                        `${
                            notNestedWeight &&
                            (notNestedWeight as any).length === 2
                                ? "  "
                                : ""
                        }${notNestedWeight} `
                    )}
                    <ExpandButton onToggle={handleExpandToggle} expanded={expanded} />
                    {expanded && <span className="appended">({nestedWeight})</span>}
                    {authorityDepthOverflow ? (
                        <AuthorityDepthOverflowWarning />
                    ) : (
                        hasAuthorityDepthProblem(maxAuthorityDepth, permission, level) &&
                        !expanded && <ChildAuthorityDepthOverflowWarning />
                    )}
                </td>
            </tr>
        );

    const status: React.ReactNode[] = [];

    if ((isNested || isMultiSig) && expanded) {
        permission.accounts.forEach((subAccount: any) => {
            status.push(
                <AccountPermissionTree
                    key={subAccount.id}
                    account={subAccount.id}
                    accounts={subAccount.accounts}
                    permission={subAccount}
                    available={available}
                    availableKeys={availableKeys}
                    threshold={permission.threshold}
                    level={level + 1}
                    maxAuthorityDepth={maxAuthorityDepth}
                />
            );
        });

        if (permission.keys.length) {
            permission.keys.forEach((key: any) =>
                status.push(
                    <KeyPermissionBranch
                        key={key.id}
                        permission={key}
                        available={availableKeys}
                        level={level + (hideRoot ? 0 : 1)}
                        weight={notNestdWeight(key.weight, threshold)}
                    />
                )
            );
        }
    }

    return status.length > 0 ? (
        <tbody>
            {hideRoot || rootPerm}
            <tr>
                <td colSpan={3} className="heading-perm">
                    <div className={hideRoot ? "" : "table-container"}>
                        <table>{status}</table>
                    </div>
                    {expanded && level === 0 && <div className="spacer" />}
                </td>
            </tr>
        </tbody>
    ) : (
        <tbody>{rootPerm}</tbody>
    );
}

interface AccountPermissionTreeProps
    extends Omit<AccountPermissionTreeCoreProps, "account"> {
    account: string;
}

function AccountPermissionTree({
    account,
    level = 0,
    ...rest
}: AccountPermissionTreeProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, undefined);

    if (!resolvedAccount) {
        return <span />;
    }

    return (
        <AccountPermissionTreeCore
            {...(rest as any)}
            account={resolvedAccount}
            level={level}
        />
    );
}

interface FirstLevelCoreProps {
    required?: any;
    available?: any;
    type?: string;
    added?: any;
    removed?: any;
    availableKeys: any;
    globalObject?: any;
    reviewPeriodTime?: any;
    noFail?: boolean;
    failReason?: string;
    expanded?: boolean;
}

function FirstLevel({
    required: requiredProp,
    available: availableProp,
    type = "active",
    added = null,
    removed = null,
    availableKeys: availableKeysProp,
    globalObject,
    reviewPeriodTime,
    noFail,
    failReason,
    expanded: expandedProp
}: FirstLevelCoreProps) {
    useChainStoreTick();

    const [expanded, setExpanded] = React.useState(expandedProp);

    const handleExpandToggle = () => {
        setExpanded(!expanded);
    };

    const required = pu.listToIDs(requiredProp);
    let available: any = pu.listToIDs(availableProp);
    const requiredPermissions = pu.unnest(required, type);

    available = cloneDeep(available);
    const availableKeys = availableKeysProp.toJS();

    if (added) {
        available.push(added);
        availableKeys.push(added);
    }

    if (removed) {
        if (available.indexOf(removed) !== -1) {
            available.splice(available.indexOf(removed), 1);
        }
        if (availableKeys.indexOf(removed) !== -1) {
            availableKeys.splice(availableKeys.indexOf(removed), 1);
        }
    }

    const approvedCount = requiredPermissions.reduce(
        (total: number, perm: any) =>
            total + (isApproved(perm, available, availableKeys) ? 1 : 0),
        0
    );
    const approversCount = requiredPermissions.length;
    const isOK = approvedCount === approversCount;

    const failed = isOK && !reviewPeriodTime && !noFail;
    const pendingReview = isOK && reviewPeriodTime;

    const maxAuthorityDepth = globalObject
        .get("parameters")
        .get("max_authority_depth");

    const onePerm = requiredPermissions.length === 1;
    const oPermission = onePerm ? requiredPermissions[0] : null;

    const nestedWeight = !onePerm && `${approvedCount} / ${approversCount}`;

    const rows = requiredPermissions.map((account: any) => (
        <AccountPermissionTree
            key={account.id}
            account={account.id}
            accounts={account.accounts}
            permission={account}
            available={available}
            availableKeys={availableKeys}
            expanded={expandedProp || onePerm}
            level={0}
            maxAuthorityDepth={maxAuthorityDepth}
            hideRoot={onePerm}
        />
    ));

    return (
        <div className="nested-approval-state">
            <div className="root-status">
                {failed ? (
                    <Failed reason={failReason} />
                ) : pendingReview ? (
                    <Review />
                ) : (
                    <Pending />
                )}{" "}
                {!oPermission ? (
                    <span>({nestedWeight})</span>
                ) : (
                    oPermission.threshold > 1 &&
                    statusText(oPermission, available, availableKeys)
                )}
                {(!oPermission || oPermission.isMultiSig() || oPermission.isNested()) && (
                    <ExpandButton onToggle={handleExpandToggle} expanded={!!expanded} />
                )}
                {!expanded &&
                    requiredPermissions.some((permission: any) =>
                        hasAuthorityDepthProblem(maxAuthorityDepth, permission, 0)
                    ) && <ChildAuthorityDepthOverflowWarning />}
            </div>
            {expanded && <table>{rows}</table>}
        </div>
    );
}

interface FirstLevelContainerProps
    extends Omit<FirstLevelCoreProps, "required" | "available"> {
    required?: any;
    available?: any;
}

function FirstLevelContainer({
    required,
    available,
    ...rest
}: FirstLevelContainerProps) {
    useChainStoreTick();
    const resolvedRequired = resolveAccountsList(required, false);
    const resolvedAvailable = resolveAccountsList(available, false);

    return (
        <FirstLevel
            {...(rest as any)}
            required={resolvedRequired}
            available={resolvedAvailable}
        />
    );
}

interface ProposalWrapperProps {
    proposal: string;
    type?: string;
    globalObject?: string;
    [key: string]: any;
}

function ProposalWrapperCore({
    proposal,
    type = "active",
    ...rest
}: {
    proposal: any;
    type?: string;
    [key: string]: any;
}) {
    const available = proposal.get(`available_${type}_approvals`);
    const availableKeys = proposal.get("available_key_approvals");
    const required = proposal.get(`required_${type}_approvals`);
    const failReason = proposal.get("fail_reason") || " ";

    return (
        <FirstLevelContainer
            {...rest}
            type={type}
            required={required}
            available={available}
            availableKeys={availableKeys}
            reviewPeriodTime={proposal.get("review_period_time")}
            failReason={failReason}
        />
    );
}

function ProposalWrapper({
    proposal,
    type = "active",
    globalObject = "2.0.0",
    ...rest
}: ProposalWrapperProps) {
    useChainStoreTick();
    const resolvedProposal = ChainStore.getObject(proposal);
    const resolvedGlobalObject = ChainStore.getObject(globalObject);

    if (!resolvedProposal || !resolvedGlobalObject) {
        return <span />;
    }

    return (
        <ProposalWrapperCore
            {...rest}
            proposal={resolvedProposal}
            type={type}
            globalObject={resolvedGlobalObject}
        />
    );
}

export default ProposalWrapper;
