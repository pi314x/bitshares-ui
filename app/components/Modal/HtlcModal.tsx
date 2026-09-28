// TypeScript/functional-component port of the legacy HtlcModal.jsx (Phase
// 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes to the real
// HTLC create/redeem/extend flow.
//
// Security-sensitive per AGENTS.md: `onSubmit` still calls the real
// `HtlcActions.create`/`redeem`/`extend` with the exact same data read
// from current component state at submit time.
//
// Dropped as confirmed dead (grep-verified against the original, `git
// show HEAD:app/components/Modal/HtlcModal.jsx | grep <name>`):
//   - `onTrxIncluded` and the `TransactionConfirmStore` import: the method
//     is defined and bound in the constructor, and calls
//     `TransactionConfirmStore.unlisten(this.onTrxIncluded)` on itself,
//     but is never passed to `TransactionConfirmStore.listen(...)`
//     anywhere - it can never actually run.
//   - The `connect()` wrapper around the class and its sole injected prop
//     `fee_asset_symbol` (from `SettingsStore`): grepped, `fee_asset_symbol`
//     is never read anywhere in the component body. Since nothing else in
//     the component needs `SettingsStore` either, the wrapper is dropped
//     entirely rather than kept for a pure (and here, entirely unused)
//     re-render-on-settings-change side effect.
//   - The `error` state field: set to `null` in several `setState` calls,
//     never read anywhere (render destructures `this.state` but never
//     includes `error`).
//   - The `num_of_periods` state field: initialized once, never read or
//     re-set anywhere.
//   - The `htlcId` state field: set in `_syncOperation`, never read
//     anywhere (the real HTLC id used for redeem/extend submission is
//     always read fresh from `this.props.operation.payload.id`, not from
//     state).
//   - `this.hashingInProgress` in `Preimage.onInputChanged`: written once,
//     never read anywhere.
//   - `this.preimage` (the `Preimage` ref in `HtlcModal.render`): written
//     via a callback ref, never read anywhere.
//   - `_setTotal`'s two extra bound arguments at the call site
//     (`feeAmount.getAmount({real: true})`, `feeAmount.asset_id`): the
//     method itself only declares/uses 2 parameters, matching the same
//     dead-extra-bound-args pattern already found and dropped in
//     `SendModal.jsx`/`WithdrawModalNew.jsx` this same phase.
//
// Preserved verbatim (not "fixed"): `_getAvailableAssets` destructures a
// `from_error` field out of its `state` parameter, but `from_error` is
// never actually part of `this.state` anywhere in the original (only a
// same-named *local* `let from_error = ...` inside `render()`, which is
// never written back to state) - so `state.from_error` is always
// `undefined`, and the `!from_error` half of the gating condition is
// always `true`. Ported by just dropping that always-true half of the
// condition rather than threading a permanently-`undefined` field through
// the state type, with this note in place of the original's dead
// plumbing.
//
// `shouldComponentUpdate` (`return false` while `fromAccount` is truthy
// but not yet chain-loaded) is a pure loading-gate with no other observable
// side effects, in the same category already treated as droppable this
// phase (see `WalletUnlockModal.tsx`) - hooks re-render naturally on every
// dependency change, so it is not replicated. Flagged for human-reviewer
// manual QA per the plan's Phase 5 mandate: if `fromAccount` can genuinely
// transition into an unloaded state while this modal is mounted (its only
// caller, `Showcases/Htlc.jsx`, passes an already `bindToCurrentAccount`
// -resolved account, making this an edge case), this component will now
// render through that transition instead of bailing out, relying on
// `ChainStore`'s placeholder objects being safe to call `.get()`/`.getIn()`
// on (a pre-existing codebase convention, not new to this port).
//
// componentDidMount+componentDidUpdate pairs (`Preimage`'s hash
// auto-generation; `HtlcModal`'s `_syncOperation` + from-props account
// sync) are each replicated as a single `useEffect` with no dependency
// array, so they run after every render exactly like "componentDidMount
// once, then componentDidUpdate on every subsequent render" would.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore, key} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import cnames from "classnames";
import AccountSelector from "../Account/AccountSelector";
import AccountStore from "stores/AccountStore";
import {Asset} from "common/MarketClasses";
import {isNaN} from "lodash-es";
import {checkBalance} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import utils from "common/utils";
import counterpart from "counterpart";
import CopyButton from "../Utility/CopyButton";
import {
    Form,
    Modal,
    Button,
    Select,
    Input,
    DatePicker,
    Tooltip,
    Radio
} from "bitshares-ui-style-guide";
import moment from "moment";
import HtlcActions from "actions/HtlcActions";
import "../../assets/stylesheets/components/_htlc.scss";
import FeeAssetSelector from "../Utility/FeeAssetSelector";

const getUninitializedFeeAmount = () =>
    new Asset({amount: 0, asset_id: "1.3.0"});

const CIPHERS = ["sha256", "ripemd160"];

interface PreimageProps {
    label: string;
    onAction: (patch: any) => void;
    preimage_hash: string | null;
    preimage_size: number | null;
    preimage: string | null;
    preimage_cipher: string | null;
    type: string;
}

function Preimage(props: PreimageProps) {
    const [stage, setStageState] = React.useState(1);
    const stageRef = React.useRef(stage);
    const setStage = (value: number) => {
        stageRef.current = value;
        setStageState(value);
    };
    const [preimageHashCalculated, setPreimageHashCalculated] = React.useState<
        string | null
    >(null);

    const hasRandomHashRef = React.useRef(false);
    const isFirstRenderRef = React.useRef(true);
    const prevPreimageHashRef = React.useRef(props.preimage_hash);

    const onInputChanged = (e: any) => {
        let {preimage, preimage_cipher} = props;
        if (!preimage_cipher) {
            preimage_cipher = "sha256";
        }
        if (e.target) {
            preimage = e.target.value;
        } else {
            preimage_cipher = e;
        }
        if (stageRef.current == 2) {
            props.onAction({
                preimage_cipher: preimage_cipher
            });
        } else {
            const {hash} = (HtlcActions as any).calculateHash(
                preimage,
                preimage_cipher
            );
            if (props.type !== "create") {
                // user tries to match hash
                props.onAction({
                    preimage,
                    preimage_cipher: preimage_cipher,
                    preimage_size: (preimage as string).length
                });
                setPreimageHashCalculated(hash);
            } else {
                props.onAction({
                    preimage,
                    preimage_cipher: preimage_cipher,
                    preimage_hash: hash,
                    preimage_size: (preimage as string).length
                });
            }
        }
    };

    const generateRandom = (e: any = {target: {}}) => {
        hasRandomHashRef.current = true;
        e.target.value = (key as any)
            .get_random_key()
            .toWif()
            .substr(10, 30);
        onInputChanged(e);
    };

    // Mirrors componentDidMount + componentDidUpdate combined (see file
    // header): runs after every render.
    React.useEffect(() => {
        if (!isFirstRenderRef.current) {
            if (
                prevPreimageHashRef.current !== props.preimage_hash &&
                !props.preimage_hash
            ) {
                hasRandomHashRef.current = false;
            }
        }
        isFirstRenderRef.current = false;
        prevPreimageHashRef.current = props.preimage_hash;
        if (!props.preimage_hash && !hasRandomHashRef.current) {
            // make sure there is always a hash if no hash given
            generateRandom({target: {}});
        }
    });

    const onClick = (e: any) => {
        let redo = false;
        if (stage !== e.target.value && e.target.value == 1) {
            redo = true;
        }
        setStage(e.target.value);
        if (redo) {
            generateRandom();
        }
    };

    const onSizeChanged = (e: any) => {
        props.onAction({
            preimage_size: !e.target.value ? null : parseInt(e.target.value)
        });
    };

    const onHashChanged = (e: any) => {
        props.onAction({
            preimage_hash: e.target.value
        });
    };

    const label = (
        <React.Fragment>
            {counterpart.translate(props.label)}
            {props.type == "create" && (
                <Radio.Group
                    value={stage}
                    onChange={onClick}
                    style={{
                        marginBottom: "7px",
                        marginLeft: "24px"
                    }}
                >
                    <Radio value={1}>
                        <Translate content="showcases.htlc.first_stage" />
                    </Radio>
                    <Radio value={2}>
                        <Translate content="showcases.htlc.second_stage" />
                    </Radio>
                    <Radio value={3}>
                        <Translate content="showcases.htlc.custom" />
                    </Radio>
                </Radio.Group>
            )}
        </React.Fragment>
    );

    // if user redeems, indicate if it matches
    const hashMatch =
        props.type !== "create" && preimageHashCalculated !== null
            ? preimageHashCalculated == props.preimage_hash
            : null;

    return (
        <Form.Item label={label}>
            <span>
                {counterpart.translate(
                    "showcases.htlc.preimage_has_been_created"
                )}
            </span>
            <Input.Group className="content-block transfer-input preimage-row">
                <Tooltip
                    title={counterpart.translate(
                        props.type !== "create"
                            ? "showcases.htlc.tooltip.enter_preimage"
                            : "showcases.htlc.tooltip.preimage_random"
                    )}
                    mouseEnterDelay={0.5}
                >
                    <Input
                        style={{
                            width: "60%",
                            color:
                                hashMatch == null
                                    ? undefined
                                    : hashMatch
                                    ? "green"
                                    : "red"
                        }}
                        name="preimage"
                        id="preimage"
                        type="text"
                        onChange={onInputChanged}
                        value={stage == 2 ? "" : props.preimage || ""}
                        placeholder={counterpart.translate(
                            (props as any).hash
                                ? "showcases.htlc.enter_secret_preimage"
                                : "showcases.htlc.preimage"
                        )}
                        disabled={
                            props.type !== "create"
                                ? false
                                : stage == 1 || stage == 2
                        }
                    />
                </Tooltip>
                <Select
                    optionLabelProp={"value"}
                    style={{width: "19.5%"}}
                    onChange={onInputChanged}
                    value={props.preimage_cipher}
                >
                    {CIPHERS.map(cipher => (
                        <Select.Option key={cipher} value={cipher}>
                            {cipher}
                        </Select.Option>
                    ))}
                </Select>
                <Tooltip
                    title={counterpart.translate(
                        "showcases.htlc.tooltip.new_random"
                    )}
                    mouseEnterDelay={0.5}
                >
                    <Button
                        type="primary"
                        icon="deployment-unit"
                        style={{verticalAlign: "top"}}
                        onClick={generateRandom}
                    />
                </Tooltip>
                <div style={{float: "right"}}>
                    <CopyButton
                        dataPlace="top"
                        text={
                            "preimage: " +
                            props.preimage +
                            " hash type: " +
                            props.preimage_cipher
                        }
                    />
                </div>
            </Input.Group>

            <Input.Group className="content-block transfer-input preimage-row">
                <Tooltip
                    title={counterpart.translate(
                        "showcases.htlc.tooltip.preimage_hash"
                    )}
                    mouseEnterDelay={0.5}
                >
                    <Input
                        style={{width: "78%"}}
                        name="hash"
                        id="hash"
                        type="text"
                        onChange={onHashChanged}
                        value={props.preimage_hash || ""}
                        placeholder={counterpart.translate(
                            "showcases.htlc.hash"
                        )}
                        disabled={stage == 1}
                    />
                </Tooltip>
                <Tooltip
                    title={counterpart.translate(
                        "showcases.htlc.tooltip.preimage_size"
                    )}
                    mouseEnterDelay={0.5}
                >
                    <Input
                        style={{width: "53px", marginRight: "0.2rem"}}
                        name="size"
                        id="size"
                        type="text"
                        onChange={onSizeChanged}
                        value={props.preimage_size || ""}
                        placeholder={counterpart.translate(
                            "showcases.htlc.size"
                        )}
                        disabled={stage == 1}
                    />
                </Tooltip>
                <div style={{float: "right"}}>
                    <CopyButton
                        dataPlace="top"
                        text={
                            "hash: " +
                            props.preimage_hash +
                            " preimage size: " +
                            props.preimage_size
                        }
                    />
                </div>
            </Input.Group>
        </Form.Item>
    );
}

interface HtlcState {
    from_name: string;
    to_name: string;
    from_account: any;
    to_account: any;
    amount: any;
    asset_id: any;
    asset: any;
    feeAmount: any;
    maxAmount: boolean;
    period_start_time: any;
    balanceError: boolean;
    preimage: string | null;
    preimage_cipher: string | null;
    preimage_hash: string | null;
    preimage_size: number | null;
    claim_period: number;
    period: string | null;
    expirationDate: any;
}

function getInitialState(): HtlcState {
    const now = moment().add("seconds", 120);
    return {
        from_name: "",
        to_name: "",
        from_account: null,
        to_account: null,
        amount: "",
        asset_id: null,
        asset: null,
        feeAmount: getUninitializedFeeAmount(),
        maxAmount: false,
        period_start_time: now,
        balanceError: false,
        preimage: null,
        preimage_cipher: null,
        preimage_hash: null,
        preimage_size: null,
        claim_period: 86400,
        period: "one_day",
        expirationDate: moment()
            .add("seconds", 180)
            .add(1, "day")
    };
}

interface HtlcModalProps {
    isModalVisible: boolean;
    hideModal: () => void;
    fromAccount: any;
    operation?: any;
}

function HtlcModal(props: HtlcModalProps) {
    const {isModalVisible, hideModal, fromAccount, operation} = props;

    const [state, setState] = React.useState<HtlcState>(() =>
        getInitialState()
    );
    const mergeState = (patch: Partial<HtlcState>) =>
        setState(prev => ({...prev, ...patch}));
    // Mirrors the original's `this.setState(patch, callback)` calls where
    // `callback` (`_checkBalance`) needs to observe the just-set values
    // immediately, in the same synchronous handler - not just on the next
    // render. `state` (the object returned by `useState`) is mutated
    // in-place first so any function reading it later in the same handler
    // sees the update right away; `mergeState` then still schedules the
    // actual re-render.
    const setStateSync = (patch: Partial<HtlcState>) => {
        Object.assign(state, patch);
        mergeState(patch);
    };

    const getAvailableAssets = (s: HtlcState = state) => {
        const {from_account} = s;
        let asset_types: string[] = [];
        // `from_error` half of the original condition dropped - see file
        // header (always-undefined dead plumbing in the original).
        if (!(from_account && from_account.get("balances"))) {
            return {asset_types};
        }
        const account_balances = from_account.get("balances").toJS();
        asset_types = Object.keys(account_balances).sort((utils as any).sortID);
        for (const key in account_balances) {
            const balanceObject = ChainStore.getObject(account_balances[key]);
            if (balanceObject && (balanceObject as any).get("balance") === 0) {
                asset_types.splice(asset_types.indexOf(key), 1);
            }
        }
        return {asset_types};
    };

    const _checkBalance = () => {
        const {feeAmount, amount, from_account, asset} = state;
        if (!asset || !from_account) return;
        const balanceID = from_account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = from_account.getIn([
            "balances",
            feeAmount.asset_id
        ]);
        if (!asset || !from_account) return;
        if (!balanceID) {
            setStateSync({balanceError: true});
            return;
        }
        const balanceObject: any = ChainStore.getObject(balanceID);
        const feeBalanceObject: any = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
            setStateSync({feeAmount: getUninitializedFeeAmount()});
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount) {
            setStateSync({balanceError: false});
            return;
        }
        const hasBalance = (checkBalance as any)(
            amount,
            asset,
            feeAmount,
            balanceObject
        );
        if (hasBalance === null) return;
        setStateSync({balanceError: !hasBalance});
    };

    const setTotal = (asset_id: string, balance_id: string) => {
        const {feeAmount} = state;
        const balanceObject: any = ChainStore.getObject(balance_id);
        const transferAsset: any = ChainStore.getObject(asset_id);

        const balance = new Asset({
            amount: balanceObject.get("balance"),
            asset_id: transferAsset.get("id"),
            precision: transferAsset.get("precision")
        });

        if (balanceObject) {
            if (feeAmount.asset_id === balance.asset_id) {
                balance.minus(feeAmount);
            }
            setStateSync({
                maxAmount: true,
                amount: balance.getAmount({real: true})
            });
            _checkBalance();
        }
    };

    const onToAccountChanged = (to_account: any) => {
        mergeState({to_account});
    };

    const onAmountChanged = ({amount, asset}: any) => {
        if (!asset) {
            return;
        }

        if (typeof asset !== "object") {
            asset = ChainStore.getAsset(asset);
        }

        setStateSync({
            amount,
            asset,
            asset_id: asset.get("id"),
            maxAmount: false
        });
        _checkBalance();
    };

    const toChanged = (to_name: string) => {
        mergeState({to_name});
    };

    const onFeeChanged = (fee: any) => {
        if (!fee) return;
        setStateSync({feeAmount: fee});
        _checkBalance();
    };

    const onDatepickerRef = (el: any) => {
        if (el && el.picker.input) {
            el.picker.input.readOnly = false;
        }
    };

    const onExpirationDateChanged = (utcValue: any) => {
        if (utcValue) {
            const {period_start_time} = state;
            const exp = utcValue.valueOf();
            const start = period_start_time.valueOf();
            const claim_period = Math.floor((exp - start) / 1000);
            mergeState({
                claim_period,
                period: null,
                expirationDate: utcValue
            });
        } else {
            mergeState({
                claim_period: 0,
                period: null,
                expirationDate: null
            });
        }
    };

    const onPreimageChanged = ({
        preimage,
        preimage_cipher,
        preimage_hash,
        preimage_size
    }: any) => {
        const stateChange: Partial<HtlcState> = {};
        if (preimage !== undefined) {
            stateChange.preimage = preimage;
        }
        if (preimage_cipher !== undefined) {
            stateChange.preimage_cipher = preimage_cipher;
        }
        if (preimage_hash !== undefined) {
            stateChange.preimage_hash = preimage_hash;
        }
        if (preimage_size !== undefined) {
            stateChange.preimage_size = preimage_size;
        }
        mergeState(stateChange);
    };

    const setPeriod = (days: number) => {
        const estimatedExpiry = moment().add(days, "day");
        let period = "one_day";
        const claim_period = days * 60 * 60 * 24; // convert day to seconds
        switch (days) {
            case 1:
                period = "one_day";
                break;
            case 2:
                period = "two_days";
                break;
            case 7:
                period = "one_week";
                break;
        }

        mergeState({
            claim_period,
            period,
            expirationDate: estimatedExpiry
        });
    };

    const syncOperation = (op: any) => {
        if (op && op.payload && op.type !== "create") {
            const to = op.payload.transfer.to;
            const from = op.payload.transfer.from;
            const amountData = {
                amount: op.payload.transfer.amount,
                asset_id: op.payload.transfer.asset_id
            };
            const expiration = new Date(
                op.payload.conditions.time_lock.expiration
            );
            const toAccount: any = ChainStore.getAccount(to);
            const fromAcct: any = ChainStore.getAccount(from);
            if (toAccount && fromAcct && toAccount.get && fromAcct.get) {
                const assetObj = ChainStore.getAsset(
                    amountData.asset_id,
                    false
                );
                setStateSync({
                    to_account: toAccount,
                    to_name: toAccount.get("name"),
                    from_account: fromAcct,
                    from_name: fromAcct.get("name"),
                    asset: assetObj,
                    amount: (utils as any).convert_satoshi_to_typed(
                        amountData.amount,
                        assetObj
                    ),
                    asset_id: amountData.asset_id,
                    period_start_time: expiration, // no selection for that
                    preimage_hash:
                        op.payload.conditions.hash_lock.preimage_hash[1],
                    preimage_size:
                        op.payload.conditions.hash_lock.preimage_hash[0],
                    expirationDate: moment(
                        new Date(
                            (utils as any).makeISODateString(
                                op.payload.conditions.time_lock.expiration
                            )
                        )
                    ),
                    period: null
                });
            } else {
                setStateSync({
                    preimage_hash:
                        op.payload.conditions.hash_lock.preimage_hash[1],
                    preimage_size:
                        op.payload.conditions.hash_lock.preimage_hash[0],
                    expirationDate: moment(
                        new Date(
                            (utils as any).makeISODateString(
                                op.payload.conditions.time_lock.expiration
                            )
                        )
                    ),
                    period: null
                });
            }
        } else {
            // ensure it's always in-sync
            setStateSync({
                preimage_hash: null,
                preimage_size: null
            });
        }
    };

    // Mirrors componentDidMount (`_syncOperation(props.operation)` once)
    // + componentDidUpdate (the from-props account sync, and
    // `_syncOperation` again only when `operation` changed) combined - see
    // file header. Runs after every render.
    const isFirstEffectRunRef = React.useRef(true);
    const prevOperationRef = React.useRef(operation);
    const prevFromAccountRef = React.useRef(fromAccount);
    React.useEffect(() => {
        if (isFirstEffectRunRef.current) {
            isFirstEffectRunRef.current = false;
            syncOperation(operation);
        } else {
            if (
                fromAccount !== prevFromAccountRef.current ||
                state.from_account == null
            ) {
                setStateSync({
                    from_account: fromAccount,
                    from_name: fromAccount.get("name")
                });
            }
            if (prevOperationRef.current !== operation) {
                syncOperation(operation);
            }
        }
        prevOperationRef.current = operation;
        prevFromAccountRef.current = fromAccount;
    });

    const onSubmit = (e: any) => {
        e.preventDefault();
        const {
            from_account,
            to_account,
            amount,
            asset,
            asset_id,
            preimage,
            preimage_size,
            preimage_hash,
            preimage_cipher,
            claim_period,
            feeAmount
        } = state;
        const {
            operation: {type: operationType}
        } = props;

        if (operationType === "create") {
            (HtlcActions as any)
                .create({
                    from_account_id: from_account.get("id"),
                    to_account_id: to_account.get("id"),
                    asset_id,
                    amount: (utils as any).convert_typed_to_satoshi(
                        amount,
                        asset
                    ),
                    lock_time: claim_period,
                    preimage,
                    preimage_size,
                    preimage_hash,
                    preimage_cipher,
                    fee_asset: feeAmount.asset_id
                })
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        } else if (operationType === "redeem") {
            (HtlcActions as any)
                .redeem({
                    htlc_id: props.operation.payload.id,
                    user_id: to_account.get("id"),
                    preimage: preimage
                })
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        } else if (operationType === "extend") {
            (HtlcActions as any)
                .extend({
                    htlc_id: props.operation.payload.id,
                    user_id: from_account.get("id"),
                    seconds_to_add: claim_period
                })
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        }
        hideModal();
    };

    // `feeAmount` dropped from this destructure: it was only ever read via
    // the `_setTotal` binding's two dead extra bound arguments (see file
    // header - the same pattern already found/dropped in `SendModal.jsx`
    // /`WithdrawModalNew.jsx`), so it is otherwise unused in render.
    const {
        from_account,
        to_account,
        asset_id,
        amount,
        from_name,
        to_name,
        balanceError,
        preimage,
        preimage_cipher,
        claim_period,
        preimage_hash,
        preimage_size,
        period_start_time,
        expirationDate
    } = state;
    let asset = state.asset;
    const from_my_account =
        (AccountStore as any).isMyAccount(from_account) ||
        from_name === (props as any).passwordAccount;
    const from_error = from_account && !from_my_account ? true : false;

    const isExtend = operation && operation.type === "extend";
    const isRedeem = operation && operation.type === "redeem";

    const {asset_types} = getAvailableAssets();
    let balance = null;
    let _error = "";

    if (from_account && from_account.get("balances") && !from_error) {
        const account_balances = from_account.get("balances").toJS();
        _error = balanceError ? "has-error" : "";
        if (asset_types.length === 1)
            asset = ChainStore.getAsset(asset_types[0]);
        if (asset_types.length > 0) {
            const current_asset_id = asset ? asset.get("id") : asset_types[0];

            balance = (
                <span>
                    <Translate component="span" content="transfer.available" />:{" "}
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
        !((preimage_cipher && preimage) || preimage_hash) ||
        !claim_period;
    const modalTitle =
        operation && operation.type === "create"
            ? counterpart.translate("showcases.htlc.create_htlc")
            : isExtend
            ? counterpart.translate("showcases.htlc.extend_htlc")
            : counterpart.translate("showcases.htlc.redeem_htlc");
    const sendButtonText =
        operation && operation.type === "create"
            ? counterpart.translate("showcases.direct_debit.create")
            : counterpart.translate("showcases.direct_debit.update");

    const amountHeader = (
        <div className="form-input-header--label">
            {counterpart.translate("showcases.htlc.expiration_date")}
            <div className="form-input-header--right">
                <span
                    className={cnames("period-row", {
                        "is-active": state.period === "one_day"
                    })}
                    onClick={() => setPeriod(1)}
                >
                    {counterpart.translate(
                        "showcases.htlc.expiration_period.one_day"
                    )}
                </span>
                <span
                    className={cnames("period-row", {
                        "is-active": state.period === "two_days"
                    })}
                    onClick={() => setPeriod(2)}
                >
                    {counterpart.translate(
                        "showcases.htlc.expiration_period.two_days"
                    )}
                </span>
                <span
                    className={cnames("period-row", {
                        "is-active": state.period === "one_week"
                    })}
                    onClick={() => setPeriod(7)}
                >
                    {counterpart.translate(
                        "showcases.htlc.expiration_period.one_week"
                    )}
                </span>
            </div>
        </div>
    );

    return (
        <Modal
            title={modalTitle}
            visible={isModalVisible}
            overlay={true}
            onCancel={hideModal}
            footer={[
                <Button
                    key={"send"}
                    disabled={isSubmitNotValid}
                    onClick={!isSubmitNotValid ? onSubmit : undefined}
                >
                    {sendButtonText}
                </Button>,
                <Button key="Cancel" onClick={hideModal}>
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <Form className="full-width" layout="vertical">
                    {/* Sender */}
                    <AccountSelector
                        label="showcases.htlc.sender"
                        accountName={from_name}
                        account={from_account}
                        size={60}
                        typeahead={true}
                        hideImage
                        disabled={true}
                    />

                    <AccountSelector
                        label="showcases.htlc.recipient"
                        accountName={to_name}
                        account={to_account}
                        onChange={toChanged}
                        onAccountChanged={onToAccountChanged}
                        size={60}
                        typeahead={true}
                        hideImage
                        disabled={isExtend || isRedeem}
                    />

                    {!isRedeem ? (
                        <AmountSelector
                            label="showcases.htlc.amount"
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
                            display_balance={
                                isExtend || isRedeem ? undefined : balance
                            }
                            allowNaN={true}
                            disabled={isExtend || isRedeem}
                            selectDisabled={isExtend || isRedeem}
                        />
                    ) : null}

                    {/*  Preimage */}
                    {isExtend ? (
                        <Form.Item
                            label={counterpart.translate(
                                "showcases.htlc.preimage"
                            )}
                        >
                            <Input
                                type="text"
                                value={preimage_hash || ""}
                                placeholder={counterpart.translate(
                                    "showcases.htlc.hash"
                                )}
                                readOnly={true}
                                disabled={true}
                            />
                        </Form.Item>
                    ) : (
                        <Preimage
                            label="showcases.htlc.preimage"
                            onAction={onPreimageChanged}
                            preimage_hash={preimage_hash}
                            preimage_size={preimage_size}
                            preimage={preimage}
                            preimage_cipher={preimage_cipher}
                            type={
                                operation && operation.type
                                    ? operation.type
                                    : "create"
                            }
                        />
                    )}

                    {!isRedeem ? (
                        <div>
                            {/*  Expiration  */}
                            <Form.Item
                                label={amountHeader}
                                validateStatus={""}
                                className="form-input-header"
                            >
                                <DatePicker
                                    showToday={true}
                                    showTime
                                    placeholder=""
                                    onChange={onExpirationDateChanged}
                                    className="date-picker-width100"
                                    style={{width: "100%"}}
                                    ref={onDatepickerRef}
                                    disabledDate={(current: any) =>
                                        current && current < period_start_time
                                    }
                                    value={expirationDate}
                                />
                            </Form.Item>
                            <div className="content-block transfer-input">
                                <div className="no-margin no-padding">
                                    <FeeAssetSelector
                                        account={from_account}
                                        transaction={{
                                            type: "htlc_create",
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
                        </div>
                    ) : null}
                </Form>
            </div>
        </Modal>
    );
}

export default HtlcModal;
