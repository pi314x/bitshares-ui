// TypeScript/functional-component port of the legacy IssueModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// asset-issue transaction via `ApplicationApi.issue_asset` - transcribed
// verbatim.
//
// `BindToChainState(Component)` (required `asset_to_issue`, no options)
// replaced by a Container gating on the default blank `<span/>`
// fallback.
//
// The one real caller (`AccountAssets.tsx`, verified via that file's
// own header comment) only ever passes `visible`/`hideModal`/
// `showModal`/`asset_to_issue` - `amount`/`to` (read once in the
// constructor to seed initial state) and `showModal` (never read at all
// here) are accepted-but-effectively-unset/-unused props, matching the
// original exactly rather than being "corrected" to required ones.
//
// `onSubmit`'s original `.bind(this, this.state.to, this.state.amount)`
// passed two extra arguments to a method whose signature (`onSubmit()`)
// never declares any parameters - those bound values were always
// silently discarded. Simplified to a direct `onClick={onSubmit}`
// (dropping the no-op bind args), matching this migration's established
// mechanical `.bind()`-call translation.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import utils from "common/utils";
import counterpart from "counterpart";
import ApplicationApi from "api/ApplicationApi";
import AccountSelector from "../Account/AccountSelector";
import AmountSelector from "../Utility/AmountSelector";
import {Notification} from "../../design-system/Notification";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";

interface IssueModalState {
    amount: any;
    to: any;
    to_id: any;
    memo: string;
}

interface IssueModalCoreProps {
    visible: boolean;
    hideModal: () => void;
    showModal?: () => void;
    asset_to_issue: any;
    amount?: any;
    to?: any;
}

function IssueModal({
    visible,
    hideModal,
    asset_to_issue,
    amount: amountProp,
    to: toProp
}: IssueModalCoreProps) {
    const [state, setState] = React.useState<IssueModalState>({
        amount: amountProp,
        to: toProp,
        to_id: null,
        memo: ""
    });

    const mergeState = (partial: Partial<IssueModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const onAmountChanged = ({amount}: any) => {
        mergeState({amount: amount});
    };

    const onToAccountChanged = (to: any) => {
        const partial: Partial<IssueModalState> = to
            ? {to: to.get("name"), to_id: to.get("id")}
            : {to_id: null};
        mergeState(partial);
    };

    const onToChanged = (to: any) => {
        mergeState({to: to, to_id: null});
    };

    const onSubmit = () => {
        hideModal();
        const precision = (utils as any).get_asset_precision(
            asset_to_issue.get("precision")
        );
        let amount: any = state.amount.toString().replace(/,/g, "");
        amount *= precision;

        (ApplicationApi as any)
            .issue_asset(
                state.to_id,
                asset_to_issue.get("issuer"),
                asset_to_issue.get("id"),
                amount,
                state.memo ? new (Buffer as any)(state.memo, "utf-8") : state.memo
            )
            .catch((err: any) => {
                console.log("issue error caught here:", err);
                Notification.error({
                    message: counterpart.translate(
                        "notifications.asset_issue_failure"
                    ) //: ${this.state.wallet_public_name}
                });
            });

        mergeState({
            amount: 0,
            to: "",
            to_id: null,
            memo: ""
        });
    };

    const onMemoChanged = (e: any) => {
        mergeState({memo: e.target.value});
    };

    const assetToIssueId = asset_to_issue.get("id");
    let tabIndex = 1;

    const footer = [
        <Button
            variant="accent"
            key="submit"
            onClick={onSubmit}
            disabled={!state.to_id || !state.amount}
        >
            {counterpart.translate("modal.issue.submit")}
        </Button>,
        <Button key="cancel" onClick={hideModal}>
            {counterpart.translate("cancel")}
        </Button>
    ];

    return (
        <Modal
            title={counterpart.translate("modal.issue.submit")}
            visible={visible}
            onCancel={hideModal}
            footer={footer}
        >
            <form className="grid-block vertical full-width-content">
                <div className="grid-container ">
                    {/* T O */}
                    <div className="content-block">
                        <AccountSelector
                            label={"modal.issue.to"}
                            accountName={state.to}
                            onAccountChanged={onToAccountChanged}
                            typeahead={true}
                            onChange={onToChanged}
                            account={state.to}
                            tabIndex={tabIndex++}
                        />
                    </div>

                    {/* A M O U N T */}
                    <div className="content-block">
                        <AmountSelector
                            label="modal.issue.amount"
                            amount={state.amount}
                            onChange={onAmountChanged}
                            asset={assetToIssueId}
                            assets={[assetToIssueId]}
                            tabIndex={tabIndex++}
                        />
                    </div>

                    {/*  M E M O  */}
                    <div className="content-block">
                        <label>
                            <Translate component="span" content="transfer.memo" />{" "}
                            (<Translate content="transfer.optional" />)
                        </label>
                        <textarea
                            rows={3}
                            value={state.memo}
                            tabIndex={tabIndex++}
                            onChange={onMemoChanged}
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
}

interface IssueModalContainerProps
    extends Omit<IssueModalCoreProps, "asset_to_issue"> {
    asset_to_issue: any;
}

function IssueModalContainer({
    asset_to_issue,
    ...rest
}: IssueModalContainerProps) {
    useChainStoreTick();
    const resolvedAsset = ChainStore.getAsset(asset_to_issue);

    if (!resolvedAsset) {
        return <span />;
    }

    return <IssueModal {...rest} asset_to_issue={resolvedAsset} />;
}

export default IssueModalContainer;
