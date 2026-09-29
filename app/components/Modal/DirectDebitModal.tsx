// TypeScript/functional-component port of the legacy DirectDebitModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// withdraw-permission create/update transaction via
// `ApplicationApi.createWithdrawPermission`/`updateWithdrawPermission` -
// transcribed verbatim.
//
// `connect(DirectDebitModal, {listenTo: [AccountStore, SettingsStore],
// getProps})` replaced by a Container using the established multi-store
// `useAltStore` pattern (see `SetDefaultFeeAssetModal.tsx`).
// `getProps().passwordAccount` is dropped - grep-verified unused anywhere
// in the file (grabbed from `AccountStore` but never read).
//
// `componentDidUpdate(prevProps, prevState)` runs two independent checks
// on every update (never on mount) and becomes one dependency-less
// `useEffect` (fires after every render), using the same
// "componentDidUpdate never fires on mount" mount-flag-ref pattern as
// `AccountSelector.tsx`/`JoinWitnessesModal.tsx`/
// `SetDefaultFeeAssetModal.tsx`/`DirectDebitClaimModal.tsx` (earlier
// Modal batches):
// - The first check compares `currentAccount` to `prevProps
//   .currentAccount`, which needs an actual "previous props" ref (props,
//   unlike state, have no `stateRef`-style mirror already available) -
//   tracked with a dedicated `prevCurrentAccountRef`, updated at the end
//   of the effect for the next run. `this.state.from_account == null` in
//   the original reads *current* (not previous) state, so it's read
//   directly from the render closure's `state`, matching that exactly.
// - The second check compares `prevState.permissionId` to `operation
//   .payload.id`; like `DirectDebitClaimModal.tsx`'s identical pattern,
//   nothing else in the file ever sets `permissionId` except this same
//   effect, so reading it through a `stateRef` mirror (kept for
//   consistency with that sibling file) is behaviorally identical to
//   `prevState.permissionId` in every case that occurs.
//
// Dropped as confirmed dead (grepped, not assumed):
// - `state.error`: set to `null` in four places, never read anywhere.
// - `state.feeStatus`: initialized, never set again or read.
// - `state.maxAmount`: set `true`/`false` in two places, but not among
//   the fields `render()` destructures from state, and not read anywhere
//   else either.
// - `componentDidMount`/`componentWillUnmount` and the `_isMounted` flag
//   they toggle: `_isMounted` is written in three places but never read
//   anywhere in the file.
// - `onTrxIncluded` and the `TransactionConfirmStore` import: `
//   onTrxIncluded` is bound in the constructor but `TransactionConfirmStore
//   .listen(this.onTrxIncluded)` is never called anywhere - the listener
//   is never actually registered, so the method (and its `.unlisten`
//   calls) are unreachable dead code.
//
// Preserved verbatim, not "fixed":
// - `state.feeAmount` is initialized once (`new Asset({amount: 0})`) and
//   read in several places (`_checkBalance`, `_setTotal`), but never
//   updated afterwards - `onFeeChanged` only ever sets `fee_asset_id`,
//   not `feeAmount` itself. Kept as real (if permanently-constant)
//   state, matching this migration's established treatment of
//   read-but-never-toggled fields (see `ReportModal.tsx`'s
//   `loadingImage`/`logsCopySuccess`, `DirectDebitClaimModal.tsx`'s
//   `payerBalanceWarning`).
// - `_setTotal(asset_id, balance_id)` only declares two parameters, but
//   its one call site binds four arguments (`current_asset_id,
//   account_balances[current_asset_id], fee, feeID`) - the extra `fee`/
//   `feeID` args were always silently discarded by JS, same
//   simplification already applied to `IssueModal.tsx` (earlier Modal
//   batch).
//
// Dropped, not merely "unused": `render()`'s local `fee` (`this.state
// .feeAmount.getAmount({real: true})`) and `feeID` (`= fee_asset_id`)
// were computed only to be passed as those same discarded extra
// `_setTotal.bind()` arguments above - with that passthrough gone, both
// are provably dead computations with no other reader anywhere in the
// file (grep-verified), so they're dropped rather than kept as
// interned-but-unused locals. That in turn makes `render()`'s
// `balance_fee` - assigned from `fee`/`feeID`'s only consumer, the
// `feeID == current_asset_id && balanceError` branch - dead too. That
// branch and its `no-funds` `else`-branch twin also happen to be a real,
// TypeScript-incompatible bug in the original: `balance_fee` is used
// without ever being declared anywhere in the file, which (ES modules
// always running in strict mode) is a `ReferenceError` at the moment of
// assignment, not silent global creation - and `balance_fee`'s value is
// never read anywhere afterwards regardless of whether that assignment
// succeeds. Unlike this migration's usual "preserve every bug verbatim"
// rule, TypeScript refuses to compile an assignment to an undeclared
// identifier at all (the same category of forced judgment call as the
// bare-`account`-identifier fix in `JoinCommitteeModal.tsx`/
// `JoinWitnessesModal.tsx`, earlier Modal batches); since the value was
// already provably unused, dropping the dead branches entirely - rather
// than keeping an inert `let balance_fee` around just to receive a
// never-read assignment - removes the latent crash without changing
// anything the UI actually renders.
//
// `_checkBalance` was invoked as a `setState(update, this._checkBalance)`
// callback from `onAmountChanged`/`_setTotal`, guaranteeing it always
// read the just-applied `amount`/`asset` - not whatever `this.state` held
// before that update. Since hooks' `setState` is async and this
// component otherwise reads "current" state through a `stateRef` mirror
// (which only catches up on the *next* render, too late for these two
// callers), `doCheckBalance` instead takes an optional overrides object
// for the fields a given call site just changed (`amount`/`asset`),
// falling back to `stateRef.current` for the rest (`feeAmount`,
// `from_account`, neither of which either call site touches) - this
// reproduces "runs against the post-update state" exactly, without a
// stale read.
//
// TS-forced cast: `String.prototype.replace.call(amount, /,/g, "")`
// needs the same `as any` as `DirectDebitClaimModal.tsx` - `amount`'s
// `any` type otherwise makes `tsc` pick the regex-replacer-function
// overload instead of the string-replacement one. No behavior change.
// `onDatepickerRef`'s `el.picker.input` (an antd `DatePicker` ref
// internal, untyped by its TS defs) needs an `as any` cast too.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelector";
import PeriodSelector from "../Utility/PeriodSelector";
import FeeAssetSelector from "components/Utility/FeeAssetSelector";
import AccountStore from "stores/AccountStore";
import AccountSelector from "../Account/AccountSelector";
import {Asset} from "common/MarketClasses";
import {isNaN} from "lodash-es";
import {checkBalance} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import utils from "common/utils";
import counterpart from "counterpart";
import SettingsStore from "stores/SettingsStore";
import {Modal, Button, Tooltip, Form} from "bitshares-ui-style-guide";
import {DatePicker} from "antd";
import ApplicationApi from "../../api/ApplicationApi";
import moment from "moment";
import {useAltStore} from "../../next/hooks/useAltStore";

interface DirectDebitModalState {
    to_name: string;
    from_account: any;
    to_account: any;
    amount: any;
    asset_id: any;
    asset: any;
    fee_asset_id: any;
    feeAmount: any;
    num_of_periods: any;
    period: any;
    period_start_time: any;
    permissionId: any;
    balanceError: boolean;
}

interface DirectDebitModalCoreProps {
    isModalVisible: boolean;
    hideModal: () => void;
    operation: any;
    currentAccount: any;
    fee_asset_symbol: any;
}

function DirectDebitModal({
    isModalVisible,
    hideModal,
    operation,
    currentAccount,
    fee_asset_symbol
}: DirectDebitModalCoreProps) {
    const getInitialState = (): DirectDebitModalState => ({
        to_name: "",
        from_account: null,
        to_account: null,
        amount: "",
        asset_id: null,
        asset: null,
        fee_asset_id:
            (ChainStore as any).assets_by_symbol.get(fee_asset_symbol) ||
            "1.3.0",
        feeAmount: new (Asset as any)({amount: 0}),
        num_of_periods: "",
        period: {amount: "", type: {seconds: 604800, name: "Week"}},
        period_start_time: (moment as any)().add("seconds", 120),
        permissionId: "",
        balanceError: false
    });

    const [state, setState] = React.useState<DirectDebitModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<DirectDebitModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const onSubmit = (e: any) => {
        e.preventDefault();
        const {
            from_account,
            to_account,
            amount,
            asset,
            asset_id,
            fee_asset_id,
            period,
            num_of_periods,
            period_start_time,
            permissionId
        } = state;
        const operationType = operation.type;

        if (operationType === "create") {
            (ApplicationApi as any)
                .createWithdrawPermission(
                    from_account,
                    to_account,
                    asset_id,
                    (utils as any).convert_typed_to_satoshi(amount, asset),
                    period.type.seconds * Number(period.amount),
                    num_of_periods,
                    period_start_time.valueOf(),
                    fee_asset_id
                )
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        } else if (operationType === "update") {
            (ApplicationApi as any)
                .updateWithdrawPermission(
                    permissionId,
                    from_account,
                    to_account,
                    asset_id,
                    (utils as any).convert_typed_to_satoshi(amount, asset),
                    period.type.seconds * Number(period.amount),
                    num_of_periods,
                    period_start_time.valueOf(),
                    fee_asset_id
                )
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        }
    };

    const isMountRef = React.useRef(true);
    const prevCurrentAccountRef = React.useRef(currentAccount);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevCurrentAccountRef.current = currentAccount;
            return;
        }

        const prevCurrentAccount = prevCurrentAccountRef.current;

        if (
            currentAccount !== prevCurrentAccount ||
            state.from_account == null
        ) {
            mergeState({
                from_account: (ChainStore as any).getAccount(currentAccount)
            });
        }

        if (
            operation &&
            operation.type === "update" &&
            operation.payload.id !== stateRef.current.permissionId
        ) {
            const toAccount = (ChainStore as any).getAccount(
                operation.payload.authorized_account
            );

            if (toAccount && toAccount.get) {
                const timeStart = (moment as any)
                    .utc(operation.payload.period_start_time)
                    .valueOf();
                const timeEnd = (moment as any)
                    .utc(operation.payload.expiration)
                    .valueOf();
                const numberOfPeriods =
                    (timeEnd - timeStart) /
                    (operation.payload.withdrawal_period_sec * 1000);

                const periodTypes = [
                    {seconds: 604800, name: "Week"},
                    {seconds: 86400, name: "Day"},
                    {seconds: 3600, name: "Hour"},
                    {seconds: 60, name: "Minute"}
                ];

                let periodSecs, periodName, periodAmount;

                for (let i = 0; i < periodTypes.length; i++) {
                    if (
                        operation.payload.withdrawal_period_sec >=
                        periodTypes[i].seconds
                    ) {
                        const currentPeriod = periodTypes[i];

                        periodName = currentPeriod.name;
                        periodSecs = currentPeriod.seconds;
                        periodAmount = Math.round(
                            operation.payload.withdrawal_period_sec /
                                currentPeriod.seconds
                        );
                        break;
                    }
                }
                const asset = (ChainStore as any).getAsset(
                    operation.payload.withdrawal_limit.asset_id
                );
                mergeState({
                    to_account: toAccount,
                    to_name: toAccount.get("name"),
                    asset: asset,
                    permissionId: operation.payload.id,
                    amount: (utils as any).convert_satoshi_to_typed(
                        operation.payload.withdrawal_limit.amount,
                        asset
                    ),
                    asset_id: operation.payload.withdrawal_limit.asset_id,
                    num_of_periods: numberOfPeriods,
                    period: {
                        amount: periodAmount,
                        type: {
                            seconds: periodSecs,
                            name: periodName
                        }
                    },
                    period_start_time: (moment as any).utc(
                        operation.payload.period_start_time
                    )
                });
            }
        }

        prevCurrentAccountRef.current = currentAccount;
    });

    const doCheckBalance = (overrides: Partial<DirectDebitModalState> = {}) => {
        const feeAmount = "feeAmount" in overrides
            ? overrides.feeAmount
            : stateRef.current.feeAmount;
        const amount =
            "amount" in overrides ? overrides.amount : stateRef.current.amount;
        const from_account =
            "from_account" in overrides
                ? overrides.from_account
                : stateRef.current.from_account;
        const asset =
            "asset" in overrides ? overrides.asset : stateRef.current.asset;
        if (!asset || !from_account) return;
        const balanceID = from_account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = from_account.getIn([
            "balances",
            feeAmount.asset_id
        ]);
        if (!asset || !from_account) return;
        if (!balanceID) return mergeState({balanceError: true});
        const balanceObject = ChainStore.getObject(balanceID);
        const feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || (feeBalanceObject as any).get("balance") === 0) {
            mergeState({fee_asset_id: stateRef.current.fee_asset_id});
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount) return mergeState({balanceError: false});
        const hasBalance = (checkBalance as any)(
            amount,
            asset,
            feeAmount,
            balanceObject
        );
        if (hasBalance === null) return;
        mergeState({balanceError: !hasBalance});
    };

    const setTotal = (asset_id: any, balance_id: any) => {
        const {feeAmount} = stateRef.current;
        const balanceObject: any = ChainStore.getObject(balance_id);
        const transferAsset: any = ChainStore.getObject(asset_id);

        const balance = new (Asset as any)({
            amount: balanceObject.get("balance"),
            asset_id: transferAsset.get("id"),
            precision: transferAsset.get("precision")
        });

        if (balanceObject) {
            if (feeAmount.asset_id === balance.asset_id) {
                balance.minus(feeAmount);
            }
            const newAmount = balance.getAmount({real: true});
            mergeState({amount: newAmount});
            doCheckBalance({amount: newAmount});
        }
    };

    const getAvailableAssets = () => {
        const {from_account} = state;
        let asset_types: any[] = [],
            fee_asset_types: any[] = [];
        if (!(from_account && from_account.get("balances"))) {
            return {asset_types, fee_asset_types};
        }
        const account_balances = state.from_account.get("balances").toJS();
        asset_types = Object.keys(account_balances).sort(
            (utils as any).sortID
        );
        fee_asset_types = Object.keys(account_balances).sort(
            (utils as any).sortID
        );
        for (const key in account_balances) {
            const balanceObject: any = ChainStore.getObject(
                account_balances[key]
            );
            if (balanceObject && balanceObject.get("balance") === 0) {
                asset_types.splice(asset_types.indexOf(key), 1);
                if (fee_asset_types.indexOf(key) !== -1) {
                    fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
                }
            }
        }
        return {asset_types, fee_asset_types};
    };

    const onToAccountChanged = (to_account: any) => {
        mergeState({to_account});
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
        doCheckBalance({amount, asset});
    };

    const toChanged = (to_name: any) => {
        mergeState({to_name});
    };

    const onFeeChanged = (asset: any) => {
        mergeState({fee_asset_id: asset.asset_id});
    };

    const onNumOfPeriodsChanged = (e: any) => {
        const newValue = parseInt(e.target.value, 10);
        if (!isNaN(newValue) && typeof newValue === "number" && newValue >= 0) {
            mergeState({num_of_periods: newValue});
        }
    };

    const onPeriodChanged = ({amount, type}: any) => {
        mergeState({period: {amount, type}});
    };

    const onDatepickerRef = (el: any) => {
        if (el && el.picker.input) {
            el.picker.input.readOnly = false;
        }
    };

    const onStartDateChanged = (utcValue: any) => {
        if (utcValue) {
            mergeState({period_start_time: utcValue});
        } else {
            mergeState({period_start_time: null});
        }
    };

    const {
        from_account,
        to_account,
        asset_id,
        amount,
        to_name,
        balanceError,
        num_of_periods,
        period,
        period_start_time
    } = state;
    let asset = state.asset;

    const {asset_types} = getAvailableAssets();

    let balance = null;

    if (from_account && from_account.get("balances")) {
        const account_balances = from_account.get("balances").toJS();
        const _error = state.balanceError ? "has-error" : "";
        if (asset_types.length === 1)
            asset = (ChainStore as any).getAsset(asset_types[0]);
        if (asset_types.length > 0) {
            const current_asset_id = asset ? asset.get("id") : asset_types[0];

            balance = (
                <span>
                    <Translate component="span" content="transfer.available" />
                    :{" "}
                    <span
                        className={_error}
                        style={{
                            borderBottom: "#A09F9F 1px dotted",
                            cursor: "pointer"
                        }}
                        onClick={() =>
                            setTotal(
                                current_asset_id,
                                account_balances[current_asset_id]
                            )
                        }
                    >
                        <BalanceComponent
                            balance={account_balances[current_asset_id]}
                        />
                    </span>
                </span>
            );
        } else {
            balance = (
                <span>
                    <span className={_error}>
                        <Translate content="transfer.errors.noFunds" />
                    </span>
                </span>
            );
        }
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
        from_account.get("id") == to_account.get("id") ||
        !period.amount ||
        !num_of_periods ||
        !period_start_time;

    if (__DEV__) {
        console.log("DirectDebitModal.render", from_account);
    }

    return (
        <Modal
            title={
                operation && operation.type === "create"
                    ? counterpart.translate(
                          "showcases.direct_debit.create_new_mandate"
                      )
                    : counterpart.translate(
                          "showcases.direct_debit.update_mandate"
                      )
            }
            visible={isModalVisible}
            overlay={true}
            onCancel={hideModal}
            footer={[
                <Button
                    key={"send"}
                    disabled={isSubmitNotValid}
                    onClick={!isSubmitNotValid ? onSubmit : null}
                >
                    {operation && operation.type === "create"
                        ? counterpart.translate("showcases.direct_debit.create")
                        : counterpart.translate("showcases.direct_debit.update")}
                </Button>,
                <Button key="Cancel" onClick={hideModal}>
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <Form className="full-width" layout="vertical">
                    <div>
                        {/* AUTHORIZED ACCOUNT */}
                        <Tooltip
                            title={counterpart.translate(
                                "showcases.direct_debit.tooltip.authorized_account"
                            )}
                            mouseEnterDelay={0.5}
                        >
                            <div className="content-block">
                                <AccountSelector
                                    label="showcases.direct_debit.authorized_account"
                                    accountName={to_name}
                                    account={to_account}
                                    onChange={toChanged}
                                    onAccountChanged={onToAccountChanged}
                                    size={60}
                                    typeahead={true}
                                    hideImage
                                />
                            </div>
                        </Tooltip>
                    </div>
                    <Tooltip
                        title={counterpart.translate(
                            "showcases.direct_debit.tooltip.limit_per_period"
                        )}
                        mouseEnterDelay={0.5}
                    >
                        <div className="content-block transfer-input">
                            {/*  LIMIT */}
                            <AmountSelector
                                label="showcases.direct_debit.limit_per_period"
                                amount={amount}
                                onChange={onAmountChanged}
                                asset={
                                    asset_types.length > 0 && asset
                                        ? asset.get("id")
                                        : asset_id
                                            ? asset_id
                                            : asset_types[0]
                                }
                                assets={asset_types}
                                display_balance={balance}
                                allowNaN={true}
                            />
                        </div>
                    </Tooltip>
                    <Tooltip
                        title={counterpart.translate(
                            "showcases.direct_debit.tooltip.period"
                        )}
                        mouseEnterDelay={0.5}
                    >
                        <div className="content-block transfer-input">
                            {/*  PERIOD  */}
                            <PeriodSelector
                                label="showcases.direct_debit.period"
                                inputValue={period.amount}
                                entries={["Minute", "Hour", "Day", "Week"]}
                                values={{
                                    Minute: {seconds: 60, name: "Minute"},
                                    Hour: {seconds: 60 * 60, name: "Hour"},
                                    Day: {
                                        seconds: 60 * 60 * 24,
                                        name: "Day"
                                    },
                                    Week: {
                                        seconds: 60 * 60 * 24 * 7,
                                        name: "Week"
                                    }
                                }}
                                periodType={period.type}
                                onChange={onPeriodChanged}
                            />
                        </div>
                    </Tooltip>
                    <Tooltip
                        title={counterpart.translate(
                            "showcases.direct_debit.tooltip.num_of_periods"
                        )}
                        mouseEnterDelay={0.5}
                    >
                        <div className="content-block transfer-input">
                            {/*  NUMBEER OF PERIODS  */}
                            <label className="left-label">
                                {counterpart.translate(
                                    "showcases.direct_debit.num_of_periods"
                                )}
                            </label>
                            <input
                                type="number"
                                value={num_of_periods}
                                onChange={onNumOfPeriodsChanged}
                            />
                        </div>
                    </Tooltip>
                    <div className="content-block transfer-input">
                        {/*  START DATE  */}
                        <label className="left-label">
                            {counterpart.translate(
                                "showcases.direct_debit.start_date"
                            )}
                        </label>
                        <Tooltip
                            title={counterpart.translate(
                                "showcases.direct_debit.tooltip.start_time"
                            )}
                            mouseEnterDelay={0.5}
                        >
                            <DatePicker
                                value={period_start_time}
                                showToday={false}
                                showTime
                                placeholder=""
                                onChange={onStartDateChanged}
                                className="date-picker-width100"
                                style={{width: "100%"}}
                                ref={(el: any) => onDatepickerRef(el)}
                                disabledDate={(current: any) =>
                                    current &&
                                    current < (moment as any)().add(2, "minutes")
                                }
                            />
                        </Tooltip>
                    </div>
                    <div className="content-block transfer-input">
                        <div className="no-margin no-padding">
                            {/*  F E E  */}

                            <FeeAssetSelector
                                account={from_account}
                                transaction={{
                                    type:
                                        operation && operation.type === "update"
                                            ? "withdraw_permission_update"
                                            : "withdraw_permission_create",
                                    options: ["price_per_kbyte"],
                                    data: {
                                        type: "memo",
                                        content: null
                                    }
                                }}
                                onChange={onFeeChanged}
                            />
                        </div>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}

interface DirectDebitModalContainerProps {
    isModalVisible: boolean;
    hideModal: () => void;
    operation: any;
}

function DirectDebitModalContainer(props: DirectDebitModalContainerProps) {
    const accountState = useAltStore<any>(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <DirectDebitModal
            {...props}
            currentAccount={accountState.currentAccount}
            fee_asset_symbol={settingsState.settings.get("fee_asset")}
        />
    );
}

export default DirectDebitModalContainer;
