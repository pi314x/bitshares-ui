// TypeScript/functional-component port of the legacy SendModal.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: this is the real-money transfer
// modal, calling `AccountActions.transfer(...)` with the amount/asset/fee
// exactly as before, reading them from current component state at submit
// time (not from anything stale) - the careful state-timing replication
// below affects which asset/balance the UI *shows*, not what actually
// gets submitted.
//
// External callers hold an imperative ref to call `.show()` (see
// `AccountPortfolioList.jsx`'s `this.send_modal.show()` and
// `NextShellContainer.tsx`'s `sendModalRef.current.show()`, both typed as
// `{show: () => void}`) - a function component can't be given a ref to
// call instance methods, so this is `React.forwardRef` +
// `useImperativeHandle` exposing exactly that one method, matching the
// existing consumers' expectations.
//
// `shouldComponentUpdate` here is NOT a pure performance guard (unlike
// e.g. WalletUnlockModal.tsx's, which was) - it has two real side
// effects that matter: (1) when the from-account's available asset types
// are about to become exactly one (down from some other count), it
// auto-selects that asset via `onAmountChanged`; (2) when the modal is
// about to open, it runs a balance check. Both are replicated by
// comparing this render's freshly-computed values against refs holding
// the previous render's values (the same mapping shouldComponentUpdate's
// `ns`/`this.state` distinction makes, just expressed as "this render" vs
// "the ref from last render"), executed in the render body so they fire
// before paint like the original. The original's third rule - returning
// `false` to skip re-rendering while the modal stays closed - is not
// replicated: `render()` already returns `null` whenever the modal is
// closed regardless, so skipping that render produces the exact same
// visible output either way; not replicating it only means a few extra
// no-op renders, not a behavior change.
//
// Preserved verbatim (not "fixed"): `UNSAFE_componentWillReceiveProps`
// compares the incoming `np.currentAccount` against *both* the current
// `state.from_name` *and* the previous (stale) `this.props.currentAccount`
// - replicated with a ref holding the previous render's `currentAccount`
// prop. Also: `_getAvailableAssets` reads a `state.from_error` field that
// is never actually part of this component's state anywhere (`getInitialState`
// doesn't include it, and nothing ever sets it - `from_error` only exists
// as a `render()`-local variable, a different, unrelated binding) - so
// that read is always `undefined`, and `!from_error` is therefore always
// `true`. Reproduced by simply not threading a `from_error` parameter
// through at all, since the real runtime behavior never depended on it.
import * as React from "react";
import ZfApi from "common/zfApi";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import FeeAssetSelector from "../Utility/FeeAssetSelector";
import AccountStore from "stores/AccountStore";
import AccountSelector from "../Account/AccountSelector";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import {Asset} from "common/MarketClasses";
import {isNaN} from "lodash-es";
import {checkBalance} from "common/trxHelper";
import BalanceComponent from "../Utility/BalanceComponent";
import AccountActions from "actions/AccountActions";
import utils from "common/utils";
import counterpart from "counterpart";
import {getWalletName} from "branding";
import {Form, Modal, Button, Tooltip, Input} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

const EqualWidthContainer = ({children}: {children: any[]}) => (
    <div
        style={{
            display: "flex",
            justifyContent: "center"
        }}
    >
        <div
            style={{
                display: "grid",
                gridTemplateColumns: children.map(() => "1fr").join(" ")
            }}
        >
            {children}
        </div>
    </div>
);

const getUninitializedFeeAmount = () =>
    new (Asset as any)({amount: 0, asset_id: "1.3.0"});

interface SendModalState {
    isModalVisible: boolean;
    open?: boolean;
    from_name: string;
    to_name: string;
    from_account: any;
    to_account: any;
    orig_account: any;
    amount: string;
    asset_id: string | null;
    asset: any;
    memo: string;
    error: string | null;
    knownScammer: any;
    propose: boolean;
    propose_account: any;
    feeAmount: any;
    maxAmount: boolean;
    hidden: boolean;
    balanceError?: boolean;
}

function getInitialState(): SendModalState {
    return {
        isModalVisible: false,
        from_name: "",
        to_name: "",
        from_account: null,
        to_account: null,
        orig_account: null,
        amount: "",
        asset_id: null,
        asset: null,
        memo: "",
        error: null,
        knownScammer: null,
        propose: false,
        propose_account: "",
        feeAmount: getUninitializedFeeAmount(),
        maxAmount: false,
        hidden: false
    };
}

function getAvailableAssets(from_account: any): {asset_types: string[]} {
    let asset_types: string[] = [];
    if (!(from_account && from_account.get("balances"))) {
        return {asset_types};
    }
    const account_balances = from_account.get("balances").toJS();
    asset_types = Object.keys(account_balances).sort((utils as any).sortID);
    for (const key in account_balances) {
        const balanceObject = (ChainStore as any).getObject(
            account_balances[key]
        );
        if (balanceObject && balanceObject.get("balance") === 0) {
            asset_types.splice(asset_types.indexOf(key), 1);
        }
    }

    return {asset_types};
}

interface SendModalProps {
    id?: string;
    from_name?: string | null;
    to_name?: string;
    asset_id?: string;
    tabIndex?: number;
}

const SendModal = React.forwardRef<{show: () => void}, SendModalProps>(
    (props, ref) => {
        const {
            id,
            to_name: propToName,
            from_name: propFromName,
            asset_id: propAssetId,
            tabIndex: tabIndexProp = 0
        } = props;

        const accountState = useAltStore<any>(AccountStore as any);
        const currentAccount = accountState.currentAccount;
        const passwordAccount = accountState.passwordAccount;

        const [state, setState] = React.useState<SendModalState>(() =>
            getInitialState()
        );
        const mergeState = (patch: Partial<SendModalState>) =>
            setState(prev => ({...prev, ...patch}));

        const showModal = () => mergeState({isModalVisible: true});
        const hideModal = () => mergeState({isModalVisible: false});

        const _checkBalance = () => {
            const {feeAmount, amount, from_account, asset} = state;
            if (!asset || !from_account) return;
            const balanceID = from_account.getIn(["balances", asset.get("id")]);
            const feeBalanceID = from_account.getIn([
                "balances",
                feeAmount.asset_id
            ]);
            if (!asset || !from_account) return;
            if (!balanceID) return mergeState({balanceError: true});
            const balanceObject = (ChainStore as any).getObject(balanceID);
            const feeBalanceObject = feeBalanceID
                ? (ChainStore as any).getObject(feeBalanceID)
                : null;
            if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
                mergeState({feeAmount: getUninitializedFeeAmount()});
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

        const onAmountChanged = ({
            amount,
            asset
        }: {
            amount?: any;
            asset: any;
        }) => {
            if (!asset) return;

            if (typeof asset !== "object") {
                asset = (ChainStore as any).getAsset(asset);
            }

            mergeState({
                amount,
                asset,
                asset_id: asset.get("id"),
                error: null,
                maxAmount: false
            });
        };

        // Mirrors shouldComponentUpdate's two real side effects - see the
        // file header. Runs in the render body (before paint), comparing
        // this render's freshly-computed values against refs holding the
        // previous render's.
        const {asset_types: current_render_asset_types} = getAvailableAssets(
            state.from_account
        );
        const prevAssetTypesCountRef = React.useRef<number | null>(null);
        const prevOpenRef = React.useRef<boolean | undefined>(undefined);
        const isFirstRenderRef = React.useRef(true);
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
        } else {
            if (
                current_render_asset_types.length === 1 &&
                prevAssetTypesCountRef.current !== 1
            ) {
                const autoAsset = (ChainStore as any).getAsset(
                    current_render_asset_types[0]
                );
                onAmountChanged({amount: state.amount, asset: autoAsset});
            }
            if (state.open && !prevOpenRef.current) {
                _checkBalance();
            }
        }
        prevAssetTypesCountRef.current = current_render_asset_types.length;
        prevOpenRef.current = state.open;

        const _initForm = () => {
            if (propToName != propFromName) {
                mergeState({
                    to_name: propToName || "",
                    to_account: propToName
                        ? (ChainStore as any).getAccount(propToName)
                        : null
                });
            }

            if (propFromName) {
                mergeState({
                    from_name: propFromName,
                    from_account: (ChainStore as any).getAccount(propFromName)
                });
            }

            if (!state.from_name) {
                mergeState({from_name: currentAccount});
            }

            if (propAssetId && state.asset_id !== propAssetId) {
                const asset = (ChainStore as any).getAsset(propAssetId);
                if (asset) {
                    mergeState({
                        asset_id: propAssetId,
                        asset
                    });
                }
            }
        };

        const onTrxIncluded = React.useCallback((confirm_store_state: any) => {
            if (
                confirm_store_state.included &&
                confirm_store_state.broadcasted_transaction
            ) {
                (TransactionConfirmStore as any).unlisten(onTrxIncluded);
                (TransactionConfirmStore as any).reset();
            } else if (confirm_store_state.closed) {
                (TransactionConfirmStore as any).unlisten(onTrxIncluded);
                (TransactionConfirmStore as any).reset();
            }
            // eslint-disable-next-line
        }, []);

        const onClose = (publishClose = true) => {
            (ZfApi as any).unsubscribe("transaction_confirm_actions");
            setState(getInitialState());
            if (publishClose) hideModal();
        };

        const show = () => {
            mergeState({open: true, hidden: false} as any);
            showModal();
            _initForm();
        };

        // Exposes exactly the imperative API existing callers rely on.
        React.useImperativeHandle(ref, () => ({show}));

        // Mount-only: matches the constructor's one-time ZfApi.subscribe.
        React.useEffect(() => {
            (ZfApi as any).subscribe(
                "transaction_confirm_actions",
                (name: string, msg: string) => {
                    if (msg == "close") {
                        mergeState({hidden: false});
                        hideModal();
                    }
                }
            );
            // eslint-disable-next-line
        }, []);

        // Mirrors UNSAFE_componentWillReceiveProps, comparing against the
        // *previous* render's currentAccount prop (see file header).
        const prevCurrentAccountPropRef = React.useRef(currentAccount);
        const isFirstPropsRenderRef = React.useRef(true);
        if (isFirstPropsRenderRef.current) {
            isFirstPropsRenderRef.current = false;
        } else if (
            currentAccount !== state.from_name &&
            currentAccount !== prevCurrentAccountPropRef.current
        ) {
            mergeState({
                from_name: propFromName || "",
                from_account: (ChainStore as any).getAccount(propFromName),
                to_name: propToName ? propToName : "",
                to_account: propToName
                    ? (ChainStore as any).getAccount(propToName)
                    : null,
                feeAmount: getUninitializedFeeAmount()
            });
        }
        prevCurrentAccountPropRef.current = currentAccount;

        const setTotal = (asset_id: string, balance_id: string) => {
            const {feeAmount} = state;
            const balanceObject = (ChainStore as any).getObject(balance_id);
            const transferAsset = (ChainStore as any).getObject(asset_id);

            if (balanceObject) {
                const balance = new (Asset as any)({
                    amount: balanceObject.get("balance"),
                    asset_id: transferAsset.get("id"),
                    precision: transferAsset.get("precision")
                });
                if (feeAmount.asset_id === balance.asset_id) {
                    balance.minus(feeAmount);
                }
                mergeState({
                    maxAmount: true,
                    amount: balance.getAmount({real: true})
                });
                _checkBalance();
            }
        };

        const toChanged = (to_name: string) => {
            mergeState({to_name, error: null});
        };

        const fromChanged = (from_name: string) => {
            mergeState({from_name});
        };

        const onFromAccountChanged = (from_account: any) => {
            mergeState({from_account});
        };

        const onToAccountChanged = (to_account: any) => {
            mergeState({to_account, error: null});
        };

        const onFeeChanged = (fee: any) => {
            if (!fee) return;

            mergeState({
                feeAmount: fee,
                error: null
            });
            _checkBalance();
        };

        const onMemoChanged = (e: any) => {
            const {asset_types} = getAvailableAssets(state.from_account);
            const {from_account, maxAmount} = state;
            if (from_account && from_account.get("balances") && maxAmount) {
                const account_balances = from_account.get("balances").toJS();
                const current_asset_id = asset_types[0];
                setTotal(current_asset_id, account_balances[current_asset_id]);
            }
            mergeState({memo: e.target.value});
            _checkBalance();
        };

        const onPropose = () => {
            // `to_account`/`to_name` are destructured (matching the
            // original) but never used here either - harmless. `let` is
            // required for the whole destructure since `propose`/
            // `from_account`/`from_name` are reassigned below.
            /* eslint-disable prefer-const, @typescript-eslint/no-unused-vars */
            let {
                propose,
                orig_account,
                to_account,
                to_name,
                from_account,
                from_name
            } = state;
            /* eslint-enable prefer-const, @typescript-eslint/no-unused-vars */

            // Store Original Account
            if (!propose) {
                mergeState({orig_account: from_account});
            }

            // ReStore Original Account
            if (propose) {
                from_account = orig_account;
                from_name = orig_account.get("name");
            }

            // toggle switch
            propose = propose ? false : true;

            mergeState({
                propose,
                propose_account: propose ? from_account : null,
                from_account: propose ? null : from_account,
                from_name: propose ? "" : from_name
            });
        };

        const onSubmit = (e: any) => {
            e.preventDefault();
            mergeState({error: null});

            const {asset} = state;
            const {amount} = state;
            const sendAmount = new (Asset as any)({
                real: amount,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });

            mergeState({hidden: true});

            (AccountActions as any)
                .transfer(
                    state.from_account.get("id"),
                    state.to_account.get("id"),
                    sendAmount.getAmount(),
                    asset.get("id"),
                    state.memo ? new Buffer(state.memo, "utf-8") : state.memo,
                    state.propose ? state.propose_account : null,
                    state.feeAmount.asset_id
                )
                .then(() => {
                    onClose();
                    (TransactionConfirmStore as any).unlisten(onTrxIncluded);
                    (TransactionConfirmStore as any).listen(onTrxIncluded);
                })
                .catch((e: any) => {
                    const msg = e.message
                        ? e.message.split("\n")[1] || e.message
                        : null;
                    console.log("error: ", e, msg);
                    mergeState({error: msg});
                });
        };

        // `feeAmount` is not destructured here (unlike the original) since
        // it's no longer referenced in this render body: the original's
        // only use of it here was inside `_setTotal.bind(this, ...,
        // feeAmount.getAmount({real: true}), feeAmount.asset_id)` - two
        // extra bound arguments `_setTotal(asset_id, balance_id)` never
        // actually reads (see `setTotal`'s definition above), so dropping
        // them (and this now-unused destructure) changes nothing observable.
        // `let` is required for the whole destructure since `asset` is
        // reassigned below (when there's exactly one available asset type).
        /* eslint-disable prefer-const */
        let {
            propose,
            from_account,
            to_account,
            asset,
            asset_id,
            propose_account,
            amount,
            to_name,
            from_name,
            memo,
            balanceError,
            hidden
        } = state;
        /* eslint-enable prefer-const */
        const from_my_account =
            (AccountStore as any).isMyAccount(from_account) ||
            from_name === passwordAccount;
        const from_error =
            from_account && !from_my_account && !propose ? true : false;

        const {asset_types} = getAvailableAssets(from_account);
        let balance = null;

        if (from_account && from_account.get("balances") && !from_error) {
            const account_balances = from_account.get("balances").toJS();
            const _error = state.balanceError ? "has-error" : "";
            if (asset_types.length === 1)
                asset = (ChainStore as any).getAsset(asset_types[0]);
            if (asset_types.length > 0) {
                const current_asset_id = asset
                    ? asset.get("id")
                    : asset_types[0];

                balance = (
                    <span>
                        <Translate
                            component="span"
                            content="transfer.available"
                        />
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

        const propose_incomplete = propose && !propose_account;
        const amountValue = parseFloat(
            (String.prototype.replace as any).call(amount, /,/g, "")
        );
        const isAmountValid = amountValue && !(isNaN as any)(amountValue);
        const isSubmitNotValid =
            !from_account ||
            !to_account ||
            !isAmountValid ||
            !asset ||
            from_error ||
            propose_incomplete ||
            balanceError ||
            from_account.get("id") == to_account.get("id");

        let tabIndex = tabIndexProp;

        return !state.open ? null : (
            <div
                id="send_modal_wrapper"
                className={hidden || !state.open ? "hide" : ""}
            >
                <Modal
                    visible={state.isModalVisible}
                    id={id}
                    overlay={true}
                    onCancel={hideModal}
                    footer={[
                        <Button
                            key={"send"}
                            disabled={isSubmitNotValid}
                            onClick={!isSubmitNotValid ? onSubmit : undefined}
                        >
                            {propose
                                ? counterpart.translate("propose")
                                : counterpart.translate("transfer.send")}
                        </Button>,
                        <Button
                            key="Cancel"
                            tabIndex={tabIndex++}
                            onClick={() => onClose()}
                        >
                            <Translate
                                component="span"
                                content="transfer.cancel"
                            />
                        </Button>
                    ]}
                >
                    <div className="grid-block vertical no-overflow">
                        <div className="content-block">
                            <EqualWidthContainer>
                                <Button
                                    type={propose ? "ghost" : "primary"}
                                    onClick={onPropose}
                                >
                                    <Translate content="transfer.send" />
                                </Button>
                                <Button
                                    type={propose ? "primary" : "ghost"}
                                    onClick={onPropose}
                                >
                                    <Translate content="propose" />
                                </Button>
                            </EqualWidthContainer>
                        </div>
                        <div
                            className="content-block"
                            style={{textAlign: "center"}}
                        >
                            <Translate
                                content={
                                    propose
                                        ? "transfer.header_subheader_propose"
                                        : "transfer.header_subheader"
                                }
                                wallet_name={getWalletName()}
                            />
                        </div>
                        {state.open ? (
                            <Form className="full-width" layout="vertical">
                                {!!propose && (
                                    <React.Fragment>
                                        <AccountSelector
                                            label="transfer.by"
                                            accountName={currentAccount}
                                            account={currentAccount}
                                            typeahead={true}
                                            tabIndex={tabIndex++}
                                            locked={true}
                                        />
                                        <div className="modal-separator" />
                                    </React.Fragment>
                                )}

                                <AccountSelector
                                    label="transfer.from"
                                    accountName={from_name}
                                    account={from_account}
                                    onChange={fromChanged}
                                    onAccountChanged={onFromAccountChanged}
                                    typeahead={true}
                                    tabIndex={tabIndex++}
                                    locked={!!propose ? undefined : true}
                                />

                                <AccountSelector
                                    label="transfer.to"
                                    accountName={to_name}
                                    account={to_account}
                                    onChange={toChanged}
                                    onAccountChanged={onToAccountChanged}
                                    typeahead={true}
                                    includeMyActiveAccounts={false}
                                    tabIndex={tabIndex++}
                                />

                                <AmountSelector
                                    label="transfer.amount"
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
                                    tabIndex={tabIndex++}
                                    allowNaN={true}
                                />
                                {memo && memo.length ? (
                                    <label className="right-label">
                                        {memo.length}
                                    </label>
                                ) : null}
                                <Form.Item
                                    label={counterpart.translate(
                                        "transfer.memo"
                                    )}
                                    validateStatus={
                                        memo && propose ? "warning" : ""
                                    }
                                    help={
                                        memo && propose
                                            ? counterpart.translate(
                                                  "transfer.warn_name_unable_read_memo"
                                              )
                                            : ""
                                    }
                                >
                                    <Tooltip
                                        placement="top"
                                        title={counterpart.translate(
                                            "tooltip.memo_tip"
                                        )}
                                    >
                                        <Input.TextArea
                                            style={{marginBottom: 0}}
                                            rows={3}
                                            value={memo}
                                            tabIndex={tabIndex++}
                                            onChange={onMemoChanged}
                                        />
                                    </Tooltip>
                                </Form.Item>

                                <FeeAssetSelector
                                    account={from_account}
                                    transaction={{
                                        type: "transfer",
                                        options: ["price_per_kbyte"],
                                        data: {
                                            type: "memo",
                                            content: memo
                                        }
                                    }}
                                    onChange={onFeeChanged}
                                    tabIndex={tabIndex++}
                                />
                            </Form>
                        ) : null}
                    </div>
                </Modal>
            </div>
        );
    }
);

SendModal.displayName = "SendModal";

export default function SendModalRefBridge({
    refCallback,
    ...props
}: SendModalProps & {refCallback?: (ref: {show: () => void} | null) => void}) {
    return <SendModal {...props} ref={refCallback as any} />;
}
