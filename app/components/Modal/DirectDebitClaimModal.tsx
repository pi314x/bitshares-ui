// TypeScript/functional-component port of the legacy
// DirectDebitClaimModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// direct-debit claim transaction via
// `ApplicationApi.claimWithdrawPermission` - transcribed verbatim.
//
// `componentDidUpdate` (async, fetches the authorizing/withdraw-from
// accounts, the withdrawal asset, and the payer's balance whenever a
// new `operation` arrives while the modal is visible) runs after every
// update but *not* the initial mount - replicated with a
// dependency-less `useEffect` (fires after every render) wrapping an
// async IIFE, using the same "componentDidUpdate never fires on mount"
// mount-flag-ref pattern established for `AccountSelector.tsx`/
// `JoinWitnessesModal.tsx`/`SetDefaultFeeAssetModal.tsx` (earlier Modal
// batches). The original's guard compares `prevState.permissionId` (the
// state *before* this update) to `operation.payload.id`; since nothing
// else in the file ever sets `permissionId` except this same effect
// (setting it to `operation.payload.id` once the fetch completes),
// `state.permissionId` read through a `stateRef` mirror at the time the
// effect actually runs is behaviorally identical to `prevState
// .permissionId` in every case that matters here - immediately after
// this effect's own `setState`, both would already equal `operation
// .payload.id` and skip the refetch, exactly as the original does.
//
// Dropped as confirmed dead (grepped, not assumed): `state.to_name`,
// `state.error`, `state.firstPeriodError`, `state.maxAmount`,
// `state.current_period_expires` (distinct from the actively-used
// `current_period_expires_date` - a genuinely separate, unrelated,
// never-read field) - all set at some point but never read anywhere in
// the file. `state.payerBalanceWarning`, by contrast, *is* read (in
// `isSubmitNotValid`) but never actually toggled anywhere - kept as
// real (if permanently-`false`) state, matching this migration's
// established treatment of read-but-never-toggled fields (see
// `ReportModal.tsx`'s `loadingImage`/`logsCopySuccess`). Three more
// confirmed-dead imports dropped the same way (each appears only on its
// own `import` line): `ChainStore` (only `FetchChain`, from the same
// `bitsharesjs` module, is actually used), `debounceRender` (the export
// at the bottom of the original is a bare `export default
// DirectDebitClaimModal;`, never wrapped in it), and `AccountStore`.
//
// One TS-forced cast: `String.prototype.replace.call(amount, /,/g, "")`
// needs an `as any` on `String.prototype.replace` - `amount`'s `any`
// type otherwise makes `tsc` pick the regex-replacer-function overload
// instead of the string-replacement one. No behavior change.
//
// `_checkBalance`'s `setState` branch (triggered only when called with
// no arguments) is preserved even though the file's one actual call
// site always passes both arguments, keeping that branch dead in
// practice - it's a small, cohesive part of one utility function, not
// a separate unused method, so it's kept as a generically-written
// helper rather than special-cased away.
import * as React from "react";
import Translate from "react-translate-component";
import {FetchChain} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import AccountSelector from "../Account/AccountSelector";
import {isNaN} from "lodash-es";
import LimitToWithdraw from "../Utility/LimitToWithdraw";
import utils from "common/utils";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import {Icon} from "../../design-system/Icon";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";
import ApplicationApi from "../../api/ApplicationApi";
import FeeAssetSelector from "components/Utility/FeeAssetSelector";
import TranslateWithLinks from "../Utility/TranslateWithLinks";

interface DirectDebitClaimModalState {
    from_account: any;
    from_account_balance: any;
    to_account: any;
    amount: any;
    asset_id: any;
    asset: any;
    memo: string;
    feeAsset: any;
    permissionId: any;
    payerBalanceWarning: boolean;
    withdrawal_limit: any;
    current_period_expires_date?: any;
    claimedAmount: any;
    errorMessage: any;
}

interface DirectDebitClaimModalProps {
    isModalVisible: boolean;
    hideModal: () => void;
    operation: any;
}

export default function DirectDebitClaimModal({
    isModalVisible,
    hideModal,
    operation
}: DirectDebitClaimModalProps) {
    const getInitialState = (): DirectDebitClaimModalState => ({
        from_account: null,
        from_account_balance: null,
        to_account: null,
        amount: "",
        asset_id: null,
        asset: null,
        memo: "",
        feeAsset: null, // will be filled by FeeAssetSelector
        permissionId: "",
        payerBalanceWarning: false,
        withdrawal_limit: operation.payload.withdrawal_limit,
        claimedAmount: "",
        errorMessage: null
    });

    const [state, setState] = React.useState<DirectDebitClaimModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<DirectDebitClaimModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const checkBalance = async (
        from_account: any = null,
        withdrawal_limit: any = null
    ) => {
        let doSetState = false;
        if (from_account == null) {
            from_account = stateRef.current.from_account;
            doSetState = true;
        }
        if (withdrawal_limit == null) {
            withdrawal_limit = stateRef.current.withdrawal_limit;
            doSetState = true;
        }
        const balanceID = from_account.getIn([
            "balances",
            withdrawal_limit.asset_id
        ]);

        let from_account_balance: any = 0;
        if (!!balanceID) {
            from_account_balance = (
                await FetchChain("getObject", balanceID)
            ).get("balance");
        }
        if (doSetState) {
            mergeState({from_account_balance});
        }
        return from_account_balance;
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        (async () => {
            if (
                isModalVisible &&
                operation &&
                stateRef.current.permissionId !== operation.payload.id
            ) {
                const timeStart = new Date(
                    operation.payload.period_start_time + "Z"
                ).getTime();

                const timePassed = new Date().getTime() - timeStart;

                let currentPeriodNum;
                let currentPeriodExpires: any = "";

                const periodMs =
                    operation.payload.withdrawal_period_sec * 1000;
                if (timePassed < 0) {
                    console.log("first period is not started");
                } else {
                    currentPeriodNum = Math.ceil(timePassed / periodMs);
                    currentPeriodExpires =
                        timeStart + periodMs * currentPeriodNum;
                }

                const to = await FetchChain(
                    "getAccount",
                    operation.payload.authorized_account
                );
                const from = await FetchChain(
                    "getAccount",
                    operation.payload.withdraw_from_account
                );
                const asset = await FetchChain(
                    "getAsset",
                    operation.payload.withdrawal_limit.asset_id
                );
                const from_account_balance = await checkBalance(
                    from,
                    operation.payload.withdrawal_limit
                );
                mergeState({
                    to_account: to,
                    from_account: from,
                    permissionId: operation.payload.id,
                    withdrawal_limit: operation.payload.withdrawal_limit,
                    claimedAmount: operation.payload.claimed_this_period,
                    current_period_expires_date: currentPeriodExpires,
                    asset: asset,
                    from_account_balance
                });
            }
        })();
    });

    const setTotalLimit = (limit: any) => () => {
        const {asset, claimedAmount} = state;
        const amount = (utils as any).get_asset_amount(
            limit - claimedAmount,
            asset
        );
        mergeState({amount});
    };

    const onAmountChanged = ({amount, asset}: any) => {
        if (!asset) {
            return;
        }

        mergeState({
            amount,
            asset,
            asset_id: asset.get("id")
        });
    };

    const onFeeChanged = (asset: any) => {
        mergeState({feeAsset: asset});
    };

    const onMemoChanged = (e: any) => {
        mergeState({memo: e.target.value});
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        const {
            from_account,
            to_account,
            feeAsset,
            permissionId,
            amount,
            asset,
            asset_id,
            memo
        } = state;

        (ApplicationApi as any)
            .claimWithdrawPermission(
                permissionId,
                from_account,
                to_account,
                asset_id,
                (utils as any).convert_typed_to_satoshi(amount, asset),
                memo ? new (Buffer as any)(memo, "utf-8") : memo,
                feeAsset.asset_id
            )
            .then(() => {
                hideModal();
            })
            .catch((err: any) => {
                mergeState({errorMessage: err});
            });
    };

    const {
        from_account,
        from_account_balance,
        to_account,
        asset,
        amount,
        memo,
        payerBalanceWarning,
        withdrawal_limit,
        current_period_expires_date
    } = state;

    let enteredMoreThanAvailable = false;
    let balanceError = false;
    let maximumToClaim: any = 0;
    if (withdrawal_limit) {
        maximumToClaim =
            from_account_balance !== null
                ? Math.min(from_account_balance, withdrawal_limit.amount)
                : withdrawal_limit.amount;
        if (asset && amount)
            enteredMoreThanAvailable =
                (utils as any).convert_typed_to_satoshi(amount, asset) >
                maximumToClaim;
        if (
            from_account_balance !== null &&
            from_account_balance < withdrawal_limit.amount
        ) {
            balanceError = true;
        }
    }

    let balance = null;

    // balance
    if (from_account && from_account.get("balances")) {
        balance = (
            <span>
                <Translate
                    component="span"
                    content="showcases.direct_debit.limit"
                />
                :{" "}
                <span
                    className={enteredMoreThanAvailable ? "has-error" : ""}
                    style={{
                        borderBottom: "#A09F9F 1px dotted",
                        cursor: "pointer"
                    }}
                    onClick={setTotalLimit(maximumToClaim)}
                >
                    <LimitToWithdraw
                        amount={maximumToClaim}
                        assetId={
                            withdrawal_limit && withdrawal_limit.asset_id
                        }
                    />
                </span>
                &nbsp;
                {balanceError && (
                    <Tooltip
                        placement="topRight"
                        title={
                            <TranslateWithLinks
                                string="showcases.direct_debit.payer_balance_not_sufficient"
                                keys={[
                                    {
                                        type: "amount",
                                        value: withdrawal_limit,
                                        arg: "limit"
                                    }
                                ]}
                            />
                        }
                    >
                        <Icon
                            type="exclamation-circle"
                            theme="filled"
                            style={{color: "#fe8c00"}}
                        />
                    </Tooltip>
                )}
            </span>
        );
    }

    const amountValue = parseFloat(
        (String.prototype.replace as any).call(amount, /,/g, "")
    );
    const isAmountValid = amountValue && !isNaN(amountValue);
    const isSubmitNotValid =
        !from_account ||
        !to_account ||
        !isAmountValid ||
        !asset ||
        balanceError ||
        enteredMoreThanAvailable ||
        payerBalanceWarning ||
        !current_period_expires_date ||
        from_account.get("id") == to_account.get("id");

    if (__DEV__) {
        console.log("DirectDebitClaimModal.render", {isModalVisible, operation}, state);
    }

    return (
        <Modal
            title={counterpart.translate("showcases.direct_debit.claim_funds")}
            visible={isModalVisible}
            onCancel={hideModal}
            footer={[
                state.errorMessage && (
                    <span className={"red"} style={{marginRight: "10px"}}>
                        {state.errorMessage}
                    </span>
                ),
                <Button
                    key={"send"}
                    disabled={isSubmitNotValid}
                    onClick={!isSubmitNotValid ? onSubmit : undefined}
                >
                    {counterpart.translate("showcases.direct_debit.claim")}
                </Button>,
                <Button key="Cancel" onClick={hideModal}>
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <Form className="full-width" layout="vertical">
                    <AccountSelector
                        label="showcases.direct_debit.authorizing_account"
                        accountName={
                            !!to_account ? to_account.get("name") : ""
                        }
                        account={to_account}
                        size={60}
                        hideImage
                        disabled
                        noForm
                    />
                    <Form.Item
                        label={counterpart.translate(
                            "showcases.direct_debit.current_period_expires"
                        )}
                    >
                        <Input
                            type="text"
                            value={
                                current_period_expires_date
                                    ? counterpart.localize(
                                          new Date(
                                              current_period_expires_date
                                          ),
                                          {
                                              type: "date",
                                              format: "full"
                                          }
                                      )
                                    : counterpart.translate(
                                          "showcases.direct_debit.first_period_not_started"
                                      )
                            }
                            disabled
                            className={
                                current_period_expires_date ? "" : "error-area"
                            }
                        />
                    </Form.Item>
                    <AmountSelector
                        label="showcases.direct_debit.amount_to_withdraw"
                        amount={amount}
                        onChange={onAmountChanged}
                        asset={withdrawal_limit && withdrawal_limit.asset_id}
                        assets={
                            withdrawal_limit && [withdrawal_limit.asset_id]
                        }
                        display_balance={balance}
                        allowNaN={true}
                    />
                    {memo && memo.length ? (
                        <label className="right-label">{memo.length}</label>
                    ) : null}
                    <Form.Item
                        label={
                            <Tooltip
                                placement="top"
                                title={counterpart.translate("tooltip.memo_tip")}
                            >
                                {counterpart.translate("transfer.memo")}
                            </Tooltip>
                        }
                    >
                        <Input.TextArea
                            style={{marginBottom: 0}}
                            rows={3}
                            value={memo}
                            onChange={onMemoChanged}
                        />
                    </Form.Item>
                    <FeeAssetSelector
                        account={to_account}
                        transaction={{
                            type: "withdraw_permission_claim",
                            options: ["price_per_kbyte"],
                            data: {
                                type: "memo",
                                content: memo
                            }
                        }}
                        onChange={onFeeChanged}
                    />
                </Form>
            </div>
        </Modal>
    );
}
