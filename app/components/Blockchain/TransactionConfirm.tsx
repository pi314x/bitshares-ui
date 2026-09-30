// TypeScript/functional-component port of the legacy TransactionConfirm.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md - this is the app's single global
// transaction-confirmation dialog (mounted once, unconditionally, in
// `App.jsx`), and touches wallet/signing/transaction-processing logic
// directly:
// - `onConfirmClick` is the function that actually submits a transaction.
//   When `props.propose` is set (the "propose to another account" toggle),
//   it resolves the `fee_paying_account` id via `ChainStore.getAccount`,
//   waits for `props.transaction.update_head_block()`, then calls
//   `WalletDb.process_transaction(props.transaction.propose(propose_options),
//   null, true)` - building and submitting a `proposal_create` wrapping the
//   original operation. Otherwise it calls
//   `TransactionConfirmActions.broadcast(props.transaction, props.resolve,
//   props.reject)` (unchanged, out-of-scope flux action - itself calls
//   `transaction.broadcast(...)`, i.e. the real network submission).
//   Both call sites transcribed verbatim, unchanged argument order/values.
// - `_showQrCode`/`_hideQrCode` call `transaction.set_expire_seconds(60)`/
//   `transaction.finalize()`/`transaction.serialize()` to render the
//   pending, *unsigned* transaction as a QR code for offline/hardware
//   signing flows - no keys, passwords or signatures are read, logged, or
//   embedded in the QR payload (`trStr` is `JSON.stringify(transaction
//   .serialize())`, the same serialized operation data already shown in
//   the `<Transaction>` preview below it). Nothing in this file logs or
//   persists a private key, password or brainkey.
//
// `connect(TransactionConfirm, {listenTo: () => [TransactionConfirmStore],
// getProps: () => TransactionConfirmStore.getState()})` becomes
// `useAltStore(TransactionConfirmStore)` (per `useAltStore.ts`'s header
// comment, the hooks replacement for this exact Alt.js `connect` pattern),
// read once in the default-exported wrapper and spread as this component's
// props - `TransactionConfirmStore`'s state shape (`transaction`, `error`,
// `error_code`, `error_data`, `broadcasting`, `broadcast`, `included`,
// `trx_id`, `trx_block_num`, `closed`, `propose`, `fee_paying_account`,
// `resolve`, `reject`) is exactly what the original class destructured off
// `this.props`, grep-verified against both `TransactionConfirmStore.js`
// and every `this.props.X` read in the original.
//
// `shouldComponentUpdate` investigated closely (this file's lifecycle
// methods needed the most care per the task brief): its early `if
// (!nextProps.transaction) return false` branch is, in practice,
// unreachable through any real emitted store update - `transaction` only
// ever becomes falsy via `TransactionConfirmStore`'s own
// `getInitialState()` (before the very first `onConfirm` dispatch, i.e.
// before this component's first *update* - `shouldComponentUpdate` never
// runs for the initial mount) or via its exported `reset()` method, which
// assigns `this.state` directly (`this.state = this.getInitialState()`)
// rather than going through Alt's `this.setState(...)`, so it never emits
// a change event `connect`/`useAltStore` would even see. Every other Alt
// action handler (`onConfirm`/`onClose`/`onBroadcast`/`onWasBroadcast`/
// `onWasIncluded`/`onError`/`onTogglePropose`/`onProposeFeePayingAccount`)
// merges partial state via `this.setState(...)` without ever touching
// `transaction` back to a falsy value once set. The rest of the method
// (the `isErrorDetailsVisible`/`showQrCode` state comparisons, and the
// final `!are_equal_shallow(nextProps, this.props)`) is a pure
// render-gating boolean with no other observable side effect. Taken
// together, this is this migration's established "pure performance guard,
// never changes final rendered output" case - dropped entirely, per the
// same precedent as every other `shouldComponentUpdate` removal in this
// migration (e.g. `BorrowModal.tsx`, Modal/ batch 8).
//
// `componentDidUpdate` (`if (!this.props.closed) this.showModal(); else
// this.hideModal();`) becomes a mount-skip `useEffect` with no dependency
// array (runs after every render but the first, matching
// `componentDidUpdate`'s own "never on mount" timing).
// `showModal`/`hideModal` set `state.isModalVisible` - grep-confirmed
// never read anywhere in `render()` (or anywhere else in the file) -
// dropped as confirmed dead, this migration's established
// "write-only state" treatment (e.g. `BorrowModal.tsx`'s `ModalWrapper
// .state.open`). `hideModal`'s other effect, resetting
// `isErrorDetailsVisible` back to `false` whenever the dialog closes, *is*
// real (that flag gates the error-details `<Alert>` in `render()`) and is
// kept.
//
// `UNSAFE_componentWillReceiveProps` (fires the "transaction confirmed"
// toast the instant `broadcast && included` first become true, comparing
// against the *previous* `this.props.included`) becomes a mount-skip
// `useEffect` keyed on `[broadcast, included, error]`, using a
// `prevIncludedRef` to carry the previous `included` value across
// renders (a plain dependency array alone can't express "the value
// *changed into* true", only "one of these changed").
//
// `_showQrCode`/`_hideQrCode` become plain closures using a local
// `mergeState` helper.
//
// Dropped as confirmed dead (grepped): both legacy string refs
// (`ref="transactionConfirm"` on the outer `<div>`, `ref="modal"` on the
// inner `<Modal>`) - neither is ever read via `this.refs.X` anywhere in
// the file; the `Input` import from `bitshares-ui-style-guide` (never
// referenced anywhere in the original); the local `confirmButtonClass`
// variable computed in `render()` (`"button"`, optionally `+ " disabled"`)
// - never applied to any element's `className` or read anywhere else.
import * as React from "react";
import Transaction from "./Transaction";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import TransactionConfirmActions from "actions/TransactionConfirmActions";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import Icon from "../Icon/Icon";
import WalletDb from "stores/WalletDb";
import AccountStore from "stores/AccountStore";
import AccountSelect from "components/Forms/AccountSelect";
import {ChainStore} from "bitsharesjs";
import Operation from "components/Blockchain/Operation";
import notify from "actions/NotificationActions";
import {
    Modal,
    Button,
    Icon as AIcon,
    Alert,
    Switch
} from "bitshares-ui-style-guide";
import QRCode from "qrcode.react";
import {useAltStore} from "../../next/hooks/useAltStore";

interface TransactionConfirmCoreProps {
    transaction: any;
    error: any;
    error_code?: any;
    error_data?: any;
    broadcasting: boolean;
    broadcast: boolean;
    included: boolean;
    trx_id: any;
    trx_block_num: any;
    closed: boolean;
    propose: boolean;
    fee_paying_account: any;
    resolve?: (...args: any[]) => void;
    reject?: (...args: any[]) => void;
}

interface TransactionConfirmState {
    isErrorDetailsVisible: boolean;
    showQrCode: boolean;
    trStr?: string;
}

function TransactionConfirmCore(props: TransactionConfirmCoreProps) {
    const {broadcast, broadcasting} = props;

    const [state, setState] = React.useState<TransactionConfirmState>({
        isErrorDetailsVisible: false,
        showQrCode: false
    });

    const mergeState = (patch: Partial<TransactionConfirmState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const isMountRef = React.useRef(true);

    // componentDidUpdate: unconditional (no gating beyond the
    // open/closed branch itself), so - per this migration's established
    // translation - a dependency-less mount-skip effect, running after
    // every update exactly like componentDidUpdate does.
    React.useEffect(() => {
        if (isMountRef.current) {
            return;
        }
        if (!props.closed) {
            // showModal(): originally set state.isModalVisible, grep-
            // confirmed never read anywhere - no-op left here on purpose.
        } else {
            mergeState({isErrorDetailsVisible: false});
        }
    });

    const prevIncludedRef = React.useRef(props.included);

    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevIncludedRef.current = props.included;
            return;
        }
        if (
            props.broadcast &&
            props.included &&
            !prevIncludedRef.current &&
            !props.error
        ) {
            (notify as any).addNotification.defer({
                children: (
                    <div>
                        <p>
                            <Translate content="transaction.transaction_confirmed" />
                            &nbsp;&nbsp;
                            <span>
                                <Icon
                                    name="checkmark-circle"
                                    title="icons.checkmark_circle.operation_succeed"
                                    size="1x"
                                    className="success"
                                />
                            </span>
                        </p>
                        <table>
                            <Operation
                                op={
                                    props.transaction.serialize().operations[0]
                                }
                                block={1}
                                current={"1.2.0"}
                                hideFee
                                inverted={false}
                                hideOpLabel={true}
                                hideDate={true}
                            />
                        </table>
                    </div>
                ),
                level: "success",
                autoDismiss: 3
            });
        }
        prevIncludedRef.current = props.included;
    }, [props.broadcast, props.included, props.error]);

    const onKeyUp = (e: any) => {
        if (e.keyCode === 13) onConfirmClick(e);
        else e.preventDefault();
    };

    const onConfirmClick = (e: any) => {
        e.preventDefault();
        if (props.propose) {
            const propose_options = {
                fee_paying_account: (ChainStore as any)
                    .getAccount(props.fee_paying_account)
                    .get("id")
            };
            props.transaction.update_head_block().then(() => {
                (WalletDb as any).process_transaction(
                    props.transaction.propose(propose_options),
                    null,
                    true
                );
            });
        } else {
            (TransactionConfirmActions as any).broadcast(
                props.transaction,
                props.resolve,
                props.reject
            );
        }
    };

    const onCloseClick = (e: any) => {
        e.preventDefault();
        (TransactionConfirmActions as any).close(props.reject);
    };

    const onShowDetailsClick = () => {
        setState(prev => ({
            ...prev,
            isErrorDetailsVisible: !prev.isErrorDetailsVisible
        }));
    };

    const onProposeClick = () => {
        (TransactionConfirmActions as any).togglePropose();
    };

    const onProposeAccount = (fee_paying_account: any) => {
        (ChainStore as any).getAccount(fee_paying_account);
        (TransactionConfirmActions as any).proposeFeePayingAccount(
            fee_paying_account
        );
    };

    const _showQrCode = () => {
        const {transaction} = props;
        let trStr = "";
        if (transaction.tr_buffer) {
            trStr = JSON.stringify(transaction.serialize());
            mergeState({showQrCode: true, trStr});
        } else {
            transaction.set_expire_seconds(60);
            transaction.finalize().then(() => {
                trStr = JSON.stringify(transaction.serialize());
                mergeState({showQrCode: true, trStr});
            });
        }
    };

    const _hideQrCode = () => {
        props.transaction.tr_buffer = null;
        mergeState({showQrCode: false, trStr: ""});
    };

    const {isErrorDetailsVisible, showQrCode, trStr} = state;
    if (!props.transaction || props.closed) {
        return null;
    }
    let footer: any, header: any, error_code: any, error_data: any, error_message: any;

    if (props.error || props.included) {
        header = props.error
            ? counterpart.translate("transaction.broadcast_fail", {
                  message: ""
              })
            : counterpart.translate("transaction.transaction_confirmed");

        error_message = props.error;
        error_code = props.error_code;
        error_data = props.error_data;

        if (error_code) {
            error_message = error_code + " - " + error_message;
        }
        if (error_data instanceof Object) {
            error_data = JSON.stringify(error_data, null, 4);
        }
        error_data = (
            <div>
                <pre>{error_data}</pre>
            </div>
        );
        if (error_data) {
            error_message = (
                <div>
                    {error_message}
                    <br />
                    <a>
                        <Translate
                            onClick={onShowDetailsClick}
                            content={
                                isErrorDetailsVisible
                                    ? "transaction.hide"
                                    : "transaction.show_more"
                            }
                        />
                    </a>
                </div>
            );
        }

        footer = [
            <Button key={"cancel"} onClick={onCloseClick}>
                {counterpart.translate("transfer.close")}
            </Button>
        ];
    } else if (broadcast) {
        header = `${counterpart.translate(
            "transaction.broadcast_success"
        )}. ${counterpart.translate("transaction.waiting")}`;

        footer = [
            <Button key={"cancel"} onClick={onCloseClick}>
                {counterpart.translate("transfer.close")}
            </Button>
        ];
    } else if (broadcasting) {
        header = (
            <div>
                {counterpart.translate("transaction.broadcasting")}
                <AIcon type="loading" />
            </div>
        );
        footer = [];
    } else {
        header = counterpart.translate("transaction.confirm");

        footer = [
            <div
                style={{
                    float: "left",
                    cursor: "pointer",
                    marginTop: "4px"
                }}
                key="scan-qr"
                onClick={_showQrCode}
            >
                <Translate
                    style={{
                        marginTop: "3px",
                        marginLeft: "5px"
                    }}
                    content="transaction.view_qr"
                />
                <Icon name="qr-scan" size={"1_5x" as any} />
            </div>,
            <Button key={"confirm"} type="primary" onClick={onConfirmClick}>
                {props.propose
                    ? counterpart.translate("propose")
                    : counterpart.translate("transfer.confirm")}
            </Button>,
            <Button key={"cancel"} onClick={onCloseClick}>
                {counterpart.translate("account.perm.cancel")}
            </Button>
        ];
    }
    return (
        <div onKeyUp={onKeyUp}>
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={header}
                visible={!props.closed}
                id="transaction_confirm_modal"
                footer={footer}
                overlay={true}
                onCancel={onCloseClick}
                overlayClose={!broadcasting}
                noCloseBtn={true}
            >
                <div className="grid-block vertical no-padding no-margin">
                    {props.error ? (
                        <Alert type="error" message={error_message} />
                    ) : null}

                    {props.included ? (
                        <Alert
                            type="success"
                            message={counterpart.translate(
                                "transaction.transaction_confirmed"
                            )}
                            description={`#${props.trx_id}@${props.trx_block_num}`}
                        />
                    ) : null}

                    {isErrorDetailsVisible ? (
                        <Alert
                            type="error"
                            style={{fontSize: "0.7rem"}}
                            message={error_data}
                        />
                    ) : null}

                    <div
                        className="shrink"
                        style={{
                            maxHeight: "60vh",
                            overflowY: "auto",
                            overflowX: "hidden"
                        }}
                    >
                        <Transaction
                            key={Date.now()}
                            trx={props.transaction.serialize()}
                            index={0}
                            no_links={true}
                        />
                        {trStr ? (
                            <Modal
                                visible={showQrCode}
                                onCancel={_hideQrCode}
                                footer={
                                    <Button key="cancel" onClick={_hideQrCode}>
                                        {counterpart.translate("cancel")}
                                    </Button>
                                }
                            >
                                <div className="text-center">
                                    <div style={{margin: "1.5rem 0"}}>
                                        <Translate
                                            component="h4"
                                            content="transaction.title_qrcode"
                                        />
                                    </div>
                                    <div className="full-width">
                                        <span
                                            style={{
                                                background: "#fff",
                                                padding: ".75rem",
                                                display: "inline-block"
                                            }}
                                        >
                                            <QRCode size={256} value={trStr} />
                                        </span>
                                    </div>
                                </div>
                            </Modal>
                        ) : null}
                    </div>

                    {/* P R O P O S E   F R O M */}
                    {props.propose ? (
                        <div className="full-width-content form-group">
                            <label>
                                <Translate content="account.propose_from" />
                            </label>
                            <AccountSelect
                                className="full-width"
                                account_names={(AccountStore as any).getMyAccounts()}
                                onChange={onProposeAccount}
                            />
                        </div>
                    ) : null}

                    <div
                        className="grid-block shrink"
                        style={{paddingTop: "1rem"}}
                    >
                        {/* P R O P O S E   T O G G L E */}
                        {!props.transaction.has_proposed_operation() &&
                        !(broadcast || broadcasting || props.error) ? (
                            <div className="align-right grid-block">
                                <label
                                    style={{
                                        paddingRight: "0.5rem"
                                    }}
                                >
                                    <Translate content="propose" />:
                                </label>
                                <Switch
                                    checked={props.propose}
                                    onChange={onProposeClick}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function TransactionConfirm() {
    const storeState = useAltStore<any>(TransactionConfirmStore as any);
    return <TransactionConfirmCore {...storeState} />;
}

export default TransactionConfirm;
