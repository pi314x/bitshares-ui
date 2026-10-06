// TypeScript/functional-component port of the legacy
// PiratecashWithdrawModal.jsx (Phase 7, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes to the real withdrawal flow. Structurally
// identical to XbtsxWithdrawModal.tsx (this codebase already had the two
// gateways as near-duplicate files before this migration) - including
// its translate content keys, e.g. `gateway.xbtsx.min_amount` /
// `gateway.xbtsx.min_amount_error`, which are unchanged copy-paste
// artifacts from the Xbtsx original and are kept exactly as-is here too,
// not "fixed" to a `gateway.piratecash.*` key.
//
// Security-sensitive per AGENTS.md: `onSubmit`/`onSubmitConfirmation`
// still call the real `AccountActions.transfer(...)` with amount/asset
// /address/memo/fee read from current component state at submit time,
// unchanged from the original.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(PiratecashWithdrawModal)` (resolving the required
// `account`/`issuer`/`asset` and optional `balance` props) plus the outer
// `connect(..., {listenTo: [SettingsStore], getProps: fee_asset_symbol})`
// collapse into one container component resolving the same data directly
// via `ChainStore` under `useChainStoreTick()` plus `useAltStore()`, per
// this migration's established `BindToChainState` replacement pattern -
// `account`/`issuer`/`asset` are `.isRequired` in the original propTypes
// (so `BindToChainState` gated rendering behind a loading fallback until
// they resolved), `balance` is not (resolved without a loading gate,
// same as the original).
//
// Preserved verbatim (not "fixed"), found while reading the original
// closely: `onWithdrawAmountChange`'s setState callback reads
// `this._checkBalance;` - a bare property reference with no call
// parentheses, so it evaluates the function value and discards it rather
// than invoking it. Only the following `this._checkMinAmount();` (which
// *does* have parentheses) actually runs. This port keeps the same
// behavior: changing the withdraw amount re-checks the minimum-amount
// error but does *not* re-run the balance check.
//
// `UNSAFE_componentWillMount`'s two calls (`_updateFee()`,
// `_checkFeeStatus()`) and the constructor's `_validateAddress(...)` call
// (both of which merely *kick off* async network requests whose results
// arrive later via their own promise `.then()`) are all replicated in a
// single `useRef`-guarded block executed directly in the render body on
// the first render only, matching this migration's established
// `UNSAFE_componentWillMount`/constructor-side-effect translation
// (`useEffect` would run after first paint, which the originals did not
// wait for).
//
// Dropped as confirmed dead (grep-verified against the original):
// `confirmation_is_valid` (set once in the initial state, never read or
// re-set again), `withdraw_address_first` (set in the initial state and
// once more in `onDropDownList`, never read anywhere), and
// `setNestedRef`/`this.nestedRef` (the `AmountSelector`'s `refCallback`
// prop is wired up only to store a ref that is then never read again -
// `AmountSelector` itself just forwards whatever `refCallback` it is
// given straight to a native `ref`, so omitting the prop entirely is
// harmless), and `getWithdrawModalId()`/its `withdrawModalId` render
// variable (a hardcoded `"confirmation"` string, computed but never
// actually read anywhere - not passed as a prop, not used in a key or
// id attribute).
import * as React from "react";
import Translate from "react-translate-component";
import utils from "common/utils";
import BalanceComponent from "components/Utility/BalanceComponent";
import counterpart from "counterpart";
import AmountSelector from "components/Utility/AmountSelector";
import AccountActions from "actions/AccountActions";
import {validateAddress, WithdrawAddresses} from "common/PiratecashMethods";
import SettingsStore from "stores/SettingsStore";
import {ChainStore} from "bitsharesjs";
import {checkFeeStatusAsync, checkBalance} from "common/trxHelper";
import {Price, Asset} from "common/MarketClasses";
import {debounce} from "lodash-es";
import {Button} from "../../../design-system/Button";
import {Modal} from "../../../design-system/Modal";
import {useAltStore} from "../../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../../next/hooks/useChainStoreTick";

function getAvailableAssets(state: PiratecashWithdrawState) {
    const {from_account, feeStatus} = state;
    function hasFeePoolBalance(id: string) {
        if ((feeStatus as any)[id] === undefined) return true;
        return (feeStatus as any)[id] && (feeStatus as any)[id].hasPoolBalance;
    }

    function hasBalance(id: string) {
        if ((feeStatus as any)[id] === undefined) return true;
        return (feeStatus as any)[id] && (feeStatus as any)[id].hasBalance;
    }

    let fee_asset_types: string[] = [];
    if (!(from_account && from_account.get("balances"))) {
        return {fee_asset_types};
    }
    const account_balances = state.from_account.get("balances").toJS();
    fee_asset_types = Object.keys(account_balances).sort((utils as any).sortID);
    for (const key in account_balances) {
        const asset: any = ChainStore.getObject(key);
        const balanceObject: any = ChainStore.getObject(account_balances[key]);
        if (balanceObject && balanceObject.get("balance") === 0) {
            if (fee_asset_types.indexOf(key) !== -1) {
                fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
            }
        }

        if (asset) {
            // Remove any assets that do not have valid core exchange rates
            let priceIsValid = false,
                p;
            try {
                p = new (Price as any)({
                    base: new (Asset as any)(
                        asset
                            .getIn(["options", "core_exchange_rate", "base"])
                            .toJS()
                    ),
                    quote: new (Asset as any)(
                        asset
                            .getIn(["options", "core_exchange_rate", "quote"])
                            .toJS()
                    )
                });
                priceIsValid = p.isValid();
            } catch (err) {
                priceIsValid = false;
            }

            if (asset.get("id") !== "1.3.0" && !priceIsValid) {
                fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
            }
        }
    }

    fee_asset_types = fee_asset_types.filter(a => {
        return hasFeePoolBalance(a) && hasBalance(a);
    });

    return {fee_asset_types};
}

interface PiratecashWithdrawState {
    isConfirmationModalVisible: boolean;
    withdraw_amount: any;
    withdraw_address: string;
    withdraw_address_check_in_progress: boolean;
    withdraw_address_is_valid: boolean | null;
    options_is_valid: boolean;
    withdraw_address_selected: string;
    memo: string;
    empty_withdraw_value: boolean;
    from_account: any;
    fee_asset_id: string;
    feeStatus: any;
    feeAmount?: any;
    hasBalance?: boolean;
    hasPoolBalance?: boolean;
    error?: boolean;
    balanceError?: boolean;
    minAmountError?: boolean;
}

function getInitialState(
    props: PiratecashWithdrawModalProps
): PiratecashWithdrawState {
    return {
        isConfirmationModalVisible: false,
        withdraw_amount: props.amount_to_withdraw,
        withdraw_address: WithdrawAddresses.getLast(
            props.output_wallet_type as string
        ),
        withdraw_address_check_in_progress: true,
        withdraw_address_is_valid: null,
        options_is_valid: false,
        withdraw_address_selected: WithdrawAddresses.getLast(
            props.output_wallet_type as string
        ),
        memo: "",
        empty_withdraw_value: false,
        from_account: props.account,
        fee_asset_id:
            (ChainStore as any).assets_by_symbol.get(props.fee_asset_symbol) ||
            "1.3.0",
        feeStatus: {}
    };
}

interface PiratecashWithdrawModalProps {
    account: any;
    issuer: any;
    asset: any;
    output_coin_name?: string;
    output_coin_symbol?: string;
    output_coin_type?: string;
    url?: string;
    output_wallet_type?: string;
    output_supports_memos: boolean;
    amount_to_withdraw?: string;
    balance: any;
    min_amount?: number;
    withdraw_fee?: number;
    asset_precision?: number;
    hideModal?: () => void;
    showModal?: () => void;
    modal_id?: string;
    memo_prefix?: string;
    fee_asset_symbol?: string;
}

function PiratecashWithdrawModal(props: PiratecashWithdrawModalProps) {
    const [state, setState] = React.useState<PiratecashWithdrawState>(() =>
        getInitialState(props)
    );
    const mergeState = (patch: Partial<PiratecashWithdrawState>) =>
        setState(prev => ({...prev, ...patch}));
    // Same "live mutable state bag" pattern used elsewhere this phase:
    // `state` is mutated in place first so a function reading it later in
    // the same synchronous handler (or promise callback) sees the update
    // right away, mirroring the original's `setState(patch, callback)`.
    const setStateSync = (patch: Partial<PiratecashWithdrawState>) => {
        Object.assign(state, patch);
        mergeState(patch);
    };

    const unmountedRef = React.useRef(false);
    React.useEffect(() => {
        return () => {
            unmountedRef.current = true;
        };
    }, []);

    const _checkBalance = () => {
        const {feeAmount, withdraw_amount} = state;
        const {asset, balance} = props;
        if (!balance || !feeAmount) return;
        const hasBalance = (checkBalance as any)(
            withdraw_amount,
            asset,
            feeAmount,
            balance
        );
        if (hasBalance === null) return;
        setStateSync({balanceError: !hasBalance});
        return hasBalance;
    };

    const _checkMinAmount = () => {
        const {withdraw_amount} = state;
        if (withdraw_amount === null) return;
        const lessThanMinimum =
            withdraw_amount <
            (props.min_amount as number) /
                (utils as any).get_asset_precision(props.asset_precision);
        setStateSync({minAmountError: lessThanMinimum});
        return lessThanMinimum;
    };

    const _updateFeeRaw = (s: PiratecashWithdrawState = state) => {
        let fee_asset_id = s.fee_asset_id;
        const {from_account} = s;
        const {fee_asset_types} = getAvailableAssets(s);
        if (
            fee_asset_types.length === 1 &&
            fee_asset_types[0] !== fee_asset_id
        ) {
            fee_asset_id = fee_asset_types[0];
        }

        if (!from_account) return null;
        (checkFeeStatusAsync as any)({
            accountID: from_account.get("id"),
            feeID: fee_asset_id,
            options: ["price_per_kbyte"],
            data: {
                type: "memo",
                content:
                    props.output_coin_type +
                    ":" +
                    s.withdraw_address +
                    (s.memo ? ":" + s.memo : "")
            }
        }).then(
            ({
                fee,
                hasBalance,
                hasPoolBalance
            }: {
                fee: any;
                hasBalance: boolean;
                hasPoolBalance: boolean;
            }) => {
                if (unmountedRef.current) return;

                setStateSync({
                    feeAmount: fee,
                    hasBalance,
                    hasPoolBalance,
                    error: !hasBalance || !hasPoolBalance
                });
                _checkBalance();
            }
        );
    };
    const _updateFeeRef = React.useRef(_updateFeeRaw);
    _updateFeeRef.current = _updateFeeRaw;
    const _updateFee = React.useRef(
        debounce((s?: PiratecashWithdrawState) => _updateFeeRef.current(s), 250)
    ).current;

    const _checkFeeStatus = (s: PiratecashWithdrawState = state) => {
        const account = s.from_account;
        if (!account) return;

        const {fee_asset_types: assets} = getAvailableAssets(s);
        const feeStatus: any = {};
        const p: any[] = [];
        assets.forEach(a => {
            p.push(
                (checkFeeStatusAsync as any)({
                    accountID: account.get("id"),
                    feeID: a,
                    options: ["price_per_kbyte"],
                    data: {
                        type: "memo",
                        content:
                            props.output_coin_type +
                            ":" +
                            s.withdraw_address +
                            (s.memo ? ":" + s.memo : "")
                    }
                })
            );
        });
        Promise.all(p)
            .then(status => {
                assets.forEach((a, idx) => {
                    feeStatus[a] = status[idx];
                });
                if (!(utils as any).are_equal_shallow(s.feeStatus, feeStatus)) {
                    setStateSync({feeStatus});
                }
                _checkBalance();
            })
            .catch(err => {
                console.error(err);
            });
    };

    const _validateAddress = (
        new_withdraw_address: string,
        p: PiratecashWithdrawModalProps = props
    ) => {
        (validateAddress as any)({
            url: p.url,
            walletType: p.output_wallet_type,
            newAddress: new_withdraw_address
        }).then((isValid: any) => {
            if (state.withdraw_address === new_withdraw_address) {
                setStateSync({
                    withdraw_address_check_in_progress: false,
                    withdraw_address_is_valid: isValid
                });
            }
        });
    };

    // Mirrors the constructor's `_validateAddress(...)` call and
    // `UNSAFE_componentWillMount`'s `_updateFee()`/`_checkFeeStatus()`
    // calls - all three merely kick off async requests, so this just
    // needs to run once, before the first paint. See file header.
    const didInitRef = React.useRef(false);
    if (!didInitRef.current) {
        didInitRef.current = true;
        _validateAddress(state.withdraw_address, props);
        _updateFee();
        _checkFeeStatus();
    }

    // Mirrors UNSAFE_componentWillReceiveProps: only fires on the
    // `account` prop changing to something not already reflected in
    // state *or* in the previous render's props.
    const prevAccountPropRef = React.useRef(props.account);
    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else if (
        props.account !== state.from_account &&
        props.account !== prevAccountPropRef.current
    ) {
        setStateSync({
            from_account: props.account,
            feeStatus: {},
            feeAmount: new (Asset as any)({amount: 0})
        });
        _updateFee();
        _checkFeeStatus();
    }
    prevAccountPropRef.current = props.account;

    const showConfirmationModal = () => {
        mergeState({isConfirmationModalVisible: true});
    };

    const hideConfirmationModal = () => {
        mergeState({isConfirmationModalVisible: false});
    };

    const onMemoChanged = (e: any) => {
        setStateSync({memo: e.target.value});
        _updateFee();
    };

    const onWithdrawAmountChange = ({amount}: any) => {
        setStateSync({
            withdraw_amount: amount,
            empty_withdraw_value: amount !== undefined && !parseFloat(amount)
        });
        // Preserved bug: the original's setState callback reads
        // `this._checkBalance` with no call parentheses (a no-op), so
        // only `_checkMinAmount()` actually runs here - see file header.
        _checkMinAmount();
    };

    const onSelectChanged = (index: number) => {
        const new_withdraw_address = (WithdrawAddresses.get(
            props.output_wallet_type as string
        ) as any)[index];
        WithdrawAddresses.setLast({
            wallet: props.output_wallet_type as string,
            address: new_withdraw_address
        });

        setStateSync({
            withdraw_address_selected: new_withdraw_address,
            options_is_valid: false,
            withdraw_address: new_withdraw_address,
            withdraw_address_check_in_progress: true,
            withdraw_address_is_valid: null
        });
        _updateFee();
        _validateAddress(new_withdraw_address);
    };

    const onWithdrawAddressChanged = (e: any) => {
        const new_withdraw_address = e.target.value.trim();

        setStateSync({
            withdraw_address: new_withdraw_address,
            withdraw_address_check_in_progress: true,
            withdraw_address_selected: new_withdraw_address,
            withdraw_address_is_valid: null
        });
        _updateFee();
        _validateAddress(new_withdraw_address);
    };

    const onSubmit = () => {
        if (
            !state.withdraw_address_check_in_progress &&
            state.withdraw_address &&
            state.withdraw_address.length &&
            state.withdraw_amount !== null
        ) {
            if (!state.withdraw_address_is_valid) {
                showConfirmationModal();
            } else if (parseFloat(state.withdraw_amount) > 0) {
                if (
                    !WithdrawAddresses.has(props.output_wallet_type as string)
                ) {
                    const withdrawals = [];
                    withdrawals.push(state.withdraw_address);
                    WithdrawAddresses.set({
                        wallet: props.output_wallet_type as string,
                        addresses: withdrawals
                    });
                } else {
                    const withdrawals = WithdrawAddresses.get(
                        props.output_wallet_type as string
                    );
                    if (
                        (withdrawals as any).indexOf(state.withdraw_address) ==
                        -1
                    ) {
                        (withdrawals as any).push(state.withdraw_address);
                        WithdrawAddresses.set({
                            wallet: props.output_wallet_type as string,
                            addresses: withdrawals
                        });
                    }
                }
                WithdrawAddresses.setLast({
                    wallet: props.output_wallet_type as string,
                    address: state.withdraw_address
                });
                const asset = props.asset;

                const {feeAmount, fee_asset_id} = state;

                const amount = parseFloat(
                    (String.prototype.replace as any).call(
                        state.withdraw_amount,
                        /,/g,
                        ""
                    )
                );
                const sendAmount = new (Asset as any)({
                    asset_id: asset.get("id"),
                    precision: asset.get("precision"),
                    real: amount
                });

                (AccountActions as any).transfer(
                    props.account.get("id"),
                    props.issuer.get("id"),
                    sendAmount.getAmount(),
                    asset.get("id"),
                    props.output_coin_type +
                        ":" +
                        state.withdraw_address +
                        (state.memo
                            ? ":" + new (Buffer as any)(state.memo, "utf-8")
                            : ""),
                    null,
                    feeAmount ? feeAmount.asset_id : fee_asset_id
                );

                setStateSync({empty_withdraw_value: false});
            } else {
                setStateSync({empty_withdraw_value: true});
            }
        }
    };

    const onSubmitConfirmation = () => {
        hideConfirmationModal();

        if (!WithdrawAddresses.has(props.output_wallet_type as string)) {
            const withdrawals = [];
            withdrawals.push(state.withdraw_address);
            WithdrawAddresses.set({
                wallet: props.output_wallet_type as string,
                addresses: withdrawals
            });
        } else {
            const withdrawals = WithdrawAddresses.get(
                props.output_wallet_type as string
            );
            if ((withdrawals as any).indexOf(state.withdraw_address) == -1) {
                (withdrawals as any).push(state.withdraw_address);
                WithdrawAddresses.set({
                    wallet: props.output_wallet_type as string,
                    addresses: withdrawals
                });
            }
        }
        WithdrawAddresses.setLast({
            wallet: props.output_wallet_type as string,
            address: state.withdraw_address
        });
        const asset = props.asset;
        const precision = (utils as any).get_asset_precision(
            asset.get("precision")
        );
        const amount: any = (String.prototype.replace as any).call(
            state.withdraw_amount,
            /,/g,
            ""
        );

        const {feeAmount, fee_asset_id} = state;

        (AccountActions as any).transfer(
            props.account.get("id"),
            props.issuer.get("id"),
            parseInt((amount * precision) as any, 10),
            asset.get("id"),
            props.output_coin_type +
                ":" +
                state.withdraw_address +
                (state.memo
                    ? ":" + new (Buffer as any)(state.memo, "utf-8")
                    : ""),
            null,
            feeAmount ? feeAmount.asset_id : fee_asset_id
        );
    };

    const onDropDownList = () => {
        if (WithdrawAddresses.has(props.output_wallet_type as string)) {
            if (state.options_is_valid === false) {
                setStateSync({options_is_valid: true});
            }

            if (state.options_is_valid === true) {
                setStateSync({options_is_valid: false});
            }
        }
    };

    const onAccountBalance = () => {
        const {feeAmount} = state;
        if (
            Object.keys(props.account.get("balances").toJS()).includes(
                props.asset.get("id")
            )
        ) {
            const total = new (Asset as any)({
                amount: props.balance.get("balance"),
                asset_id: props.asset.get("id"),
                precision: props.asset.get("precision")
            });

            // Subtract the fee if it is using the same asset
            if (total.asset_id === feeAmount.asset_id) {
                total.minus(feeAmount);
            }

            setStateSync({
                withdraw_amount: total.getAmount({real: true}),
                empty_withdraw_value: false
            });
            _checkBalance();
        }
    };

    const onFeeChanged = ({asset}: any) => {
        setStateSync({fee_asset_id: asset.get("id")});
        _updateFee();
    };

    const {withdraw_address_selected, memo} = state;
    const storedAddress = WithdrawAddresses.get(
        props.output_wallet_type as string
    );
    let balance: any = null;

    const account_balances = props.account.get("balances").toJS();
    const asset_types = Object.keys(account_balances);

    let invalid_address_message = null;
    let options = null;
    let confirmation = null;

    if (state.options_is_valid) {
        options = (
            <div
                className={
                    !(storedAddress as any).length
                        ? "rudex-disabled-options"
                        : "rudex-options"
                }
            >
                {(storedAddress as any).map((name: string, index: number) => {
                    return (
                        <a key={index} onClick={() => onSelectChanged(index)}>
                            {name}
                        </a>
                    );
                })}
            </div>
        );
    }

    if (
        !state.withdraw_address_check_in_progress &&
        state.withdraw_address &&
        state.withdraw_address.length
    ) {
        if (!state.withdraw_address_is_valid) {
            invalid_address_message = (
                <div className="has-error" style={{paddingTop: 10}}>
                    <Translate
                        content="gateway.valid_address"
                        coin_type={props.output_coin_type}
                    />
                </div>
            );
            confirmation = (
                <Modal
                    closable={false}
                    footer={[
                        <Button
                            key="submit"
                            variant="accent"
                            onClick={onSubmitConfirmation}
                        >
                            {counterpart.translate("modal.confirmation.accept")}
                        </Button>,
                        <Button
                            key="cancel"
                            style={{marginLeft: "8px"}}
                            onClick={hideConfirmationModal}
                        >
                            {counterpart.translate("modal.confirmation.cancel")}
                        </Button>
                    ]}
                    visible={state.isConfirmationModalVisible}
                    onCancel={hideConfirmationModal}
                >
                    <label>
                        <Translate content="modal.confirmation.title" />
                    </label>
                </Modal>
            );
        }
    }

    let tabIndex = 1;
    let withdraw_memo = null;

    if (props.output_supports_memos) {
        withdraw_memo = (
            <div className="content-block">
                <label>
                    <Translate component="span" content="transfer.memo" />
                </label>
                <textarea
                    rows={3}
                    value={memo}
                    tabIndex={tabIndex++}
                    onChange={onMemoChanged}
                />
            </div>
        );
    }

    // Estimate fee VARIABLES
    const {fee_asset_types} = getAvailableAssets(state);

    if (asset_types.length > 0) {
        const current_asset_id = props.asset.get("id");
        if (current_asset_id) {
            const current = account_balances[current_asset_id];
            balance = (
                <span
                    style={{
                        borderBottom: "#A09F9F 1px dotted",
                        cursor: "pointer"
                    }}
                >
                    <Translate component="span" content="transfer.available" />
                    &nbsp;:&nbsp;
                    <span className="set-cursor" onClick={onAccountBalance}>
                        {current ? (
                            <BalanceComponent
                                balance={account_balances[current_asset_id]}
                            />
                        ) : (
                            0
                        )}
                    </span>
                </span>
            );
        } else balance = "No funds";
    } else {
        balance = "No funds";
    }

    const minDeposit = (utils as any).format_number(
        (props.min_amount as number) /
            (utils as any).get_asset_precision(props.asset_precision),
        props.asset_precision,
        false
    );
    const gateFee = props.withdraw_fee
        ? (utils as any).format_number(
              props.withdraw_fee /
                  (utils as any).get_asset_precision(props.asset_precision),
              props.asset_precision,
              false
          )
        : null;

    return (
        <form
            className="grid-block vertical full-width-content"
            style={{paddingTop: 0}}
        >
            <div className="grid-container">
                {/* Withdraw amount */}
                <div className="content-block">
                    <AmountSelector
                        label="modal.withdraw.amount"
                        amount={state.withdraw_amount}
                        asset={props.asset.get("id")}
                        assets={[props.asset.get("id")]}
                        placeholder="0.0"
                        onChange={onWithdrawAmountChange}
                        display_balance={balance}
                    />
                    {state.empty_withdraw_value ? (
                        <p
                            className="has-error no-margin"
                            style={{paddingTop: 10}}
                        >
                            <Translate content="transfer.errors.valid" />
                        </p>
                    ) : null}
                    {state.balanceError ? (
                        <p
                            className="has-error no-margin"
                            style={{paddingTop: 10}}
                        >
                            <Translate content="transfer.errors.insufficient" />
                        </p>
                    ) : null}
                    {state.minAmountError ? (
                        <p
                            className="has-error no-margin"
                            style={{paddingTop: 10}}
                        >
                            <Translate content="gateway.xbtsx.min_amount_error" />
                        </p>
                    ) : null}
                    <p className="no-margin" style={{paddingTop: 10}}>
                        <b>
                            <Translate
                                content="gateway.xbtsx.min_amount"
                                minAmount={minDeposit}
                                symbol={props.output_coin_symbol}
                            />
                        </b>
                    </p>
                </div>

                {/* Fee selection */}
                {state.feeAmount ? (
                    <div className="content-block gate_fee">
                        <AmountSelector
                            disabled={true}
                            amount={state.feeAmount.getAmount({real: true})}
                            onChange={onFeeChanged}
                            asset={state.feeAmount.asset_id}
                            assets={fee_asset_types}
                            tabIndex={tabIndex++}
                        />
                        {!state.hasBalance ? (
                            <p
                                className="has-error no-margin"
                                style={{paddingTop: 10}}
                            >
                                <Translate content="transfer.errors.noFeeBalance" />
                            </p>
                        ) : null}
                        {!state.hasPoolBalance ? (
                            <p
                                className="has-error no-margin"
                                style={{paddingTop: 10}}
                            >
                                <Translate content="transfer.errors.noPoolBalance" />
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {/* Gate fee */}
                {gateFee ? (
                    <div
                        className="amount-selector right-selector"
                        style={{paddingBottom: 20}}
                    >
                        <label className="left-label">
                            <Translate content="gateway.fee" />
                        </label>
                        <div className="inline-label input-wrapper">
                            <input type="text" disabled value={gateFee} />
                            <div className="form-label select floating-dropdown">
                                <div className="dropdown-wrapper inactive">
                                    <div>{props.output_coin_symbol}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
                <div className="content-block">
                    <label className="left-label">
                        <Translate
                            component="span"
                            content="modal.withdraw.address"
                        />
                    </label>
                    <div className="rudex-select-dropdown">
                        <div className="inline-label">
                            <input
                                type="text"
                                spellCheck={false}
                                value={withdraw_address_selected}
                                tabIndex={4}
                                onChange={onWithdrawAddressChanged}
                                autoComplete="off"
                            />
                            <span onClick={onDropDownList}>&#9660;</span>
                        </div>
                    </div>
                    <div className="rudex-position-options">{options}</div>
                    {invalid_address_message}
                </div>

                {/* Memo input */}
                {withdraw_memo}

                {/* Withdraw/Cancel buttons */}
                <div>
                    <Button
                        variant="accent"
                        disabled={
                            state.error ||
                            state.balanceError ||
                            state.minAmountError
                        }
                        onClick={onSubmit}
                    >
                        {counterpart.translate("modal.withdraw.submit")}
                    </Button>

                    <Button
                        onClick={props.hideModal}
                        style={{marginLeft: "8px"}}
                    >
                        {counterpart.translate("account.perm.cancel")}
                    </Button>
                </div>
                {confirmation}
            </div>
        </form>
    );
}

function PiratecashWithdrawModalContainer(props: {
    account: string;
    issuer: string;
    asset: string;
    output_coin_name?: string;
    output_coin_symbol?: string;
    output_coin_type?: string;
    url?: string;
    output_wallet_type?: string;
    output_supports_memos: boolean;
    amount_to_withdraw?: string;
    balance: any;
    min_amount?: number;
    withdraw_fee?: number;
    asset_precision?: number;
    hideModal?: () => void;
    showModal?: () => void;
    modal_id?: string;
    memo_prefix?: string;
}) {
    useChainStoreTick();
    const settingsState = useAltStore<any>(SettingsStore as any);
    const fee_asset_symbol = settingsState.settings.get("fee_asset");

    const account = ChainStore.getAccount(props.account);
    const issuer = ChainStore.getAccount(props.issuer);
    const asset = ChainStore.getAsset(props.asset);
    const balance = props.balance
        ? ChainStore.getObject(props.balance)
        : props.balance;

    // `account`/`issuer`/`asset` are `.isRequired` ChainTypes in the
    // original, so `BindToChainState` showed a loading fallback until
    // all three resolved; `balance` is not required, resolved without a
    // gate either way.
    if (!account || !issuer || !asset) {
        return <span />;
    }

    return (
        <PiratecashWithdrawModal
            {...props}
            account={account}
            issuer={issuer}
            asset={asset}
            balance={balance}
            fee_asset_symbol={fee_asset_symbol}
        />
    );
}

export default PiratecashWithdrawModalContainer;
