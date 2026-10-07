// TypeScript/functional-component port of the legacy CreateModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical class-to-hooks
// translation, no logic changes.
//
// Security-sensitive per AGENTS.md: `_onSubmit`'s call to
// `CreditOfferActions.create(opData)` (a real on-chain transaction) and
// all the surrounding `opData` assembly logic (fee-rate math, collateral
// price/GCD reduction, whitelist encoding) are preserved exactly,
// unchanged apart from the mechanical class-to-function translation. The
// one `console.error(err)` in the `.catch()` handler logs the caught
// error object only (not any password/private-key/brainkey material) and
// is kept as-is, per the task's explicit note - this is not the "never
// log secrets" exception case.
//
// Structural change (not a behavior change): the original's two-layer
// `CreateModal` class + `CreateModalConnectWrapper = connect(...)` becomes
// a `CreateModal` container function component (calling `useAltStore`
// once per store, replacing `connect`'s `listenTo`/`getProps`) wrapping a
// `CreateModalCore` (the former class body) that is wrapped in
// `React.forwardRef`. Prop precedence matches alt-react's `connect`,
// which renders `<Component {...this.props} {...this.getNextProps()} />`
// (store-derived props always win over same-named caller props - see
// `Account/AccountPortfolioList.tsx`'s header comment for the general
// rule) - here only `currentLocale` (from `SettingsStore`) is actually
// read downstream, and it is passed after `{...props}`, so it wins the
// same way.
//
// `getProps()`'s `currentAccount`/`passwordAccount` (from `AccountStore`)
// are grep-confirmed never read anywhere in this file (only `this.props.id`
// and `this.props.currentLocale` are read; `state.account` is seeded once
// from `props.account` in the constructor and never touches
// `this.props.currentAccount`/`passwordAccount`). They are dropped as
// unused values, but `useAltStore(AccountStore)` is still called (its
// return value discarded) purely to preserve the `listenTo: [AccountStore,
// SettingsStore]`-driven re-render-on-`AccountStore`-change behavior,
// matching the precedent set in `Account/CreateAccount.tsx` and
// `Dashboard/Markets.tsx`'s `FeaturedMarkets` (see
// `docs/UI_MIGRATION_PLAN.md`'s `Dashboard/` batch 3 entry).
//
// Live imperative ref API (grep-verified, NOT dropped as dead): the
// original's `CreateModalConnectWrapper` renders
// `<CreateModal {...this.props} ref={this.props.refCallback} />`, and
// `Account/CreditOffer/CreditOfferList.jsx` (out of scope for this port,
// left untouched) does
// `<CreateModal id="credit_offer_create_modal" refCallback={e => { if (e)
// this.create_modal = e; }} account={...} />` and then, in
// `showCreateModal()`, calls `this.create_modal.showModal();` with no
// arguments (defaulting to the "create" modal, `showModal(1)`). No other
// call site anywhere in the app calls `.hideModal()` (or anything else)
// on that ref - only `.showModal()` is live. So `CreateModalCore` is
// wrapped in `React.forwardRef` and exposes exactly that one method via
// `useImperativeHandle`, matching this migration's established
// `React.forwardRef` + `useImperativeHandle` conversion for a genuinely
// live legacy ref API (e.g. `Modal/BorrowModal.tsx`'s
// `BorrowModalWrapper`/`BorrowModalHandle`).
//
// The class's many `this.state.X` fields are kept as one combined state
// object (not split into separate `useState` calls), updated via a
// `setState`-style shallow-merge `mergeState` helper, to preserve the
// original's atomic multi-field `this.setState({a, b})` updates exactly
// (same convention as `Utility/FeeAssetSelector.tsx`). Every
// `this.setState(update, callback)` two-argument call in the original
// (`onAmountChanged`, `onFeeChanged`, `_setTotal`, all three ending in a
// `this._checkBalance` callback; `_addWhitelistItem`, ending in
// `() => this.showModal(1)`) is replicated by calling the equivalent
// function directly, with the exact new values being merged, right after
// `mergeState` - safe because in every one of these calls the "callback"
// only reads values that are either the literal arguments just merged, or
// state fields the same call leaves untouched (so reading them from the
// pre-merge closure is equivalent to reading the freshly-committed state)
// - the same reasoning already documented in `Utility/FeeAssetSelector.tsx`'s
// header comment for its own `_calculateFee` setState-callback. No
// `stateRef` mirror was needed: every state read in this file happens
// synchronously inside an event handler (freshly re-created each render,
// so it always closes over the current render's `state`), never inside an
// `async` function or a `useEffect` with a narrower dependency array.
//
// No `componentDidMount`/`componentDidUpdate`/
// `UNSAFE_componentWillReceiveProps`/`shouldComponentUpdate` existed on
// the original class (grep-confirmed), so no lifecycle-to-`useEffect`
// translation was needed at all.
//
// Preserved verbatim, not "fixed" (bugs/quirks found while reading the
// original closely):
// - `_checkBalance` has a duplicated, dead `if (!asset || !account)
//   return;` guard (the same check already appears two lines above it).
// - `_delPawnItem`/`_delWhitelistItem` compare with `==`
//   (`v.asset_id == asset`, `v.account.get("name") == account`) rather
//   than `===`.
// - `_delPawnItem`/`_addPawnItem`/`_addWhitelistItem` mutate the
//   `pawn_assets`/`whitelist` array (or an existing `Asset` instance
//   inside it) in place via `.splice`/`.push`/`.setAmount`, then pass that
//   *same* array reference back into `mergeState` - kept exactly as-is
//   (the outer state object is still a new object each time, since
//   `mergeState` always spreads into a fresh wrapper, so React still
//   re-renders).
// - `min_loan` is never part of the initial state object (only set later,
//   from `_onMinLoanChange`) - a real quirk of the original's
//   `getInitialState`, not an oversight to "complete". Declared as an
//   optional field on `CreateModalState` for that reason, and genuinely
//   omitted from the initial state literal (not defaulted to `undefined`
//   explicitly), matching the class's `this.state.min_loan === undefined`
//   until first set.
// - `_onPwanPriceChanged` keeps its original typo'd name verbatim.
// - `state.account` is seeded once from `props.account` in
//   `getInitialState` and never re-synced on prop changes (there is no
//   `UNSAFE_componentWillReceiveProps`) - `useState(() => getInitialState
//   (props))`'s lazy initializer reproduces this exactly, since it also
//   only runs once, on mount.
// - `_renderCreateModal`'s balance `onClick` originally did
//   `_setTotal.bind(this, current_asset_id, account_balances[...],
//   feeAmount.getAmount({real: true}), feeAmount.asset_id)`, even though
//   `_setTotal(asset_id, balance_id)` only ever reads its first two
//   parameters - the 3rd/4th bound arguments were always computed (pure,
//   no side effects) and then silently discarded. Replaced with an arrow
//   function calling `_setTotal` with only the two arguments it actually
//   uses (also sidesteps `Function.prototype.bind`'s TS typing rejecting
//   more bound arguments than the target function declares) - behaviorally
//   identical, since the dropped computations were side-effect-free and
//   their results were never read. That was `feeAmount`'s only use inside
//   `_renderCreateModal` (grep-confirmed), so it is also dropped from that
//   function's destructured `state` fields (still read from `state`
//   everywhere else it matters - `onFeeChanged`/`_checkBalance`/`_onSubmit`
//   /the `<FeeAssetSelector>` fee-check flow are all unaffected).
//
// TypeScript-forced adjustments: this file relies heavily on `any` for
// Immutable.js account/asset objects and `common/MarketClasses`'s
// `Asset`/`Price` classes (both plain, untyped `.js` modules, same as
// everywhere else in this migration) - `@typescript-eslint/no-explicit-any`
// warnings are expected and left as-is per the task instructions.
// `Price` additionally needs the `Price as PriceUntyped` +
// `const Price: any = PriceUntyped` cast (see the import block below) -
// the exact same pre-existing TS/JS-inference gap already worked around
// in `Exchange/Exchange.tsx`.
import * as React from "react";
import counterpart from "counterpart";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import {ChainStore} from "bitsharesjs";
import {Alert} from "../../../design-system/Alert";
import {Tooltip} from "../../../design-system/Tooltip";
import {Table} from "../../../design-system/Table";
import {Modal} from "../../../design-system/Modal";
import {Button} from "../../../design-system/Button";
import {Select} from "../../../design-system/Select";
import {Input} from "../../../design-system/Input";
import {Form} from "../../../design-system/Form";
import {DatePicker} from "../../../design-system/DatePicker";
import {Icon as AntIcon} from "../../../design-system/Icon";
import utils from "common/utils";
import AmountSelector from "../../Utility/AmountSelectorStyleGuide";
import FeeAssetSelector from "../../Utility/FeeAssetSelector";
import BalanceComponent from "../../Utility/BalanceComponent";
import AssetSelector from "../../Utility/AssetSelector";
import AccountSelector from "../../Account/AccountSelector";

import {checkBalance} from "common/trxHelper";
import {Asset, Price as PriceUntyped} from "../../../lib/common/MarketClasses";
// `Price`'s constructor destructures `base`/`quote` without default
// values, mixed with `real` which does have one - TS's JS inference only
// picks up the defaulted property as known (the same pre-existing gap
// already worked around in `Exchange/Exchange.tsx`, see its header
// comment). `Asset`'s constructor defaults every param, so it isn't
// affected and needs no cast.
const Price: any = PriceUntyped;
import Translate from "react-translate-component";
import moment from "moment";
import localeZH from "antd/es/date-picker/locale/zh_CN";
import CreditOfferActions, {
    FEE_RATE_DENOM,
    listRepayPeriod
} from "../../../actions/CreditOfferActions";
import {useAltStore} from "../../../next/hooks/useAltStore";

const getUninitializedFeeAmount = () =>
    new Asset({amount: 0, asset_id: "1.3.0"});

interface WhitelistItem {
    account: any;
    amount: any;
}

interface CreateModalState {
    createOfferError: string | null;
    showModal: number; // 1: create modal 2: add pawn modal 3: add whitelist modal
    account: any;
    amount: any;
    asset_id: any;
    asset: any;
    error: any;
    feeAmount: any;
    maxAmount: boolean;
    balanceError: boolean;
    pawn_assets: any[];
    pawnInput: any;
    pawn_asset: any;
    pawn_price: any;
    whitelist: WhitelistItem[];
    whitelist_name: string;
    whitelist_account: any;
    whitelist_amount: any;
    rate: any;
    repay_period: any;
    validity_period: any;
    min_loan?: any;
}

function getInitialState(props: {account?: any}): CreateModalState {
    return {
        createOfferError: null,
        showModal: 0, // 1: create modal 2: add pawn modal 3: add whitelist modal
        account: props.account,
        amount: "",
        asset_id: null,
        asset: null,
        error: null,
        feeAmount: getUninitializedFeeAmount(),
        maxAmount: false,
        balanceError: false,
        pawn_assets: [],
        pawnInput: null,
        pawn_asset: null,
        pawn_price: null,
        whitelist: [],
        whitelist_name: "",
        whitelist_account: null,
        whitelist_amount: "",
        rate: "",
        repay_period: null,
        validity_period: null
    };
}

export interface CreateModalHandle {
    showModal: (modal?: number) => void;
}

interface CreateModalOwnProps {
    id?: string;
    account?: any;
    refCallback?: (instance: CreateModalHandle | null) => void;
}

interface CreateModalCoreProps extends CreateModalOwnProps {
    currentLocale?: string;
}

const CreateModalCore = React.forwardRef<
    CreateModalHandle,
    CreateModalCoreProps
>((props, ref) => {
    const [state, setState] = React.useState<CreateModalState>(() =>
        getInitialState(props)
    );

    const mergeState = (patch: Partial<CreateModalState>) =>
        setState(prev => ({...prev, ...patch}));

    const showModal = (modal = 1) => {
        mergeState({showModal: modal});
    };

    const hideModal = () => {
        mergeState({showModal: 0});
    };

    React.useImperativeHandle(ref, () => ({
        showModal
    }));

    const _checkBalance = (params: {
        feeAmount: any;
        amount: any;
        account: any;
        asset: any;
    }) => {
        const {feeAmount, amount, account, asset} = params;
        if (!asset || !account) return;
        const balanceID = account.getIn(["balances", asset.get("id")]);
        const feeBalanceID = account.getIn(["balances", feeAmount.asset_id]);
        if (!asset || !account) return;
        if (!balanceID) return mergeState({balanceError: true});
        const balanceObject = ChainStore.getObject(balanceID);
        const feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || (feeBalanceObject as any).get("balance") === 0) {
            mergeState({feeAmount: getUninitializedFeeAmount()});
        }
        if (!balanceObject || !feeAmount) return;
        if (!amount) return mergeState({balanceError: false});
        const hasBalance = checkBalance(amount, asset, feeAmount, balanceObject);
        if (hasBalance === null) return;
        mergeState({balanceError: !hasBalance});
    };

    const onAmountChanged = ({amount, asset}: {amount: any; asset: any}) => {
        if (!asset) return;

        if (typeof asset !== "object") {
            asset = ChainStore.getAsset(asset);
        }

        mergeState({
            amount,
            asset,
            asset_id: asset.get("id"),
            error: null,
            maxAmount: false
        });
        _checkBalance({
            feeAmount: state.feeAmount,
            amount,
            account: state.account,
            asset
        });
    };

    const onFeeChanged = (fee: any) => {
        if (!fee) return;

        mergeState({
            feeAmount: fee,
            error: null
        });
        _checkBalance({
            feeAmount: fee,
            amount: state.amount,
            account: state.account,
            asset: state.asset
        });
    };

    const _setTotal = (asset_id: any, balance_id: any) => {
        const {feeAmount} = state;
        const balanceObject: any = ChainStore.getObject(balance_id);
        const transferAsset: any = ChainStore.getObject(asset_id);

        if (balanceObject) {
            const balance = new Asset({
                amount: balanceObject.get("balance"),
                asset_id: transferAsset.get("id"),
                precision: transferAsset.get("precision")
            });
            if (feeAmount.asset_id === balance.asset_id) {
                balance.minus(feeAmount);
            }
            const newAmount = balance.getAmount({real: true});
            mergeState({maxAmount: true, amount: newAmount});
            _checkBalance({
                feeAmount,
                amount: newAmount,
                account: state.account,
                asset: state.asset
            });
        }
    };

    const _getAvailableAssets = (s: CreateModalState = state) => {
        const {account} = s;
        let asset_types: string[] = [];
        if (!(account && account.get("balances"))) {
            return {asset_types};
        }
        const account_balances = account.get("balances").toJS();
        asset_types = Object.keys(account_balances).sort(utils.sortID);
        for (const key in account_balances) {
            const balanceObject: any = ChainStore.getObject(account_balances[key]);
            if (balanceObject && balanceObject.get("balance") === 0) {
                asset_types.splice(asset_types.indexOf(key), 1);
            }
        }
        return {asset_types};
    };

    const _delPawnItem = (asset: any) => {
        const {pawn_assets} = state;
        const index = pawn_assets.findIndex(v => v.asset_id == asset);
        pawn_assets.splice(index, 1);
        if (index > -1) mergeState({pawn_assets: pawn_assets});
    };

    const _addPawnItem = () => {
        // `pawn_asset` is reassigned below when it's not yet an object.
        let {pawn_asset} = state;
        const {pawn_price, pawn_assets} = state;
        if (!!pawn_asset && !!pawn_price) {
            if (typeof pawn_asset !== "object") {
                pawn_asset = ChainStore.getAsset(pawn_asset);
            }
            const found = pawn_assets.find(asset => {
                return asset.asset_id === pawn_asset.get("id");
            });
            if (found) {
                found.setAmount({real: pawn_price});
            } else {
                pawn_assets.push(
                    new Asset({
                        real: pawn_price,
                        asset_id: pawn_asset.get("id"),
                        precision: pawn_asset.get("precision")
                    })
                );
            }
            mergeState({pawn_assets: pawn_assets, showModal: 1});
        } else {
            mergeState({showModal: 1});
        }
    };

    const _getPawnColumns = () => {
        return [
            {
                title: counterpart.translate("credit_offer.accepted_pawn"),
                dataIndex: "pawn_asset",
                key: "pawn_asset",
                render: (text: any) => text
            },
            {
                title: counterpart.translate("credit_offer.price"),
                dataIndex: "price",
                key: "price",
                render: (text: any) => text
            },
            {
                title: counterpart.translate("credit_offer.operate"),
                dataIndex: "pawn_asset_id",
                key: "operate",
                render: (asset: any) => (
                    <AntIcon
                        type="close-circle"
                        onClick={() => _delPawnItem(asset)}
                        style={{cursor: "pointer", color: "#00a9e9"}}
                    />
                )
            }
        ];
    };

    const _getWhitelistColumns = () => {
        return [
            {
                title: counterpart.translate("credit_offer.whitelist_account"),
                dataIndex: "account",
                key: "account",
                render: (text: any) => text
            },
            {
                title: counterpart.translate("credit_offer.loan_amount"),
                dataIndex: "amount",
                key: "amount",
                render: (text: any) => text
            },
            {
                title: counterpart.translate("credit_offer.operate"),
                dataIndex: "account",
                key: "operate",
                render: (account: any) => (
                    <AntIcon
                        type="close-circle"
                        onClick={() => _delWhitelistItem(account)}
                        style={{cursor: "pointer", color: "#00a9e9"}}
                    />
                )
            }
        ];
    };

    const _getPawnData = () => {
        const {pawn_assets} = state;
        return pawn_assets.map(a => {
            const asset: any = ChainStore.getAsset(a.asset_id);
            const symbol = asset.get("symbol");
            return {
                key: symbol,
                pawn_asset: symbol,
                price: a.getAmount({real: true}),
                pawn_asset_id: a.asset_id
            };
        });
    };

    const _getWhitelistData = () => {
        const {whitelist} = state;
        return whitelist.map(v => {
            return {
                key: v.account.get("name"),
                account: v.account.get("name"),
                amount: v.amount
            };
        });
    };

    const _getAddPawnBtn = () => {
        return (
            <Button onClick={() => showModal(2)}>
                <AntIcon type="plus-circle" />{" "}
                <Translate component="span" content="credit_offer.add_pawn" />
            </Button>
        );
    };

    const _getAddWhitelistBtn = () => {
        return (
            <Button onClick={() => showModal(3)}>
                <AntIcon type="plus-circle" />{" "}
                <Translate
                    component="span"
                    content="credit_offer.add_whitelist"
                />
            </Button>
        );
    };

    const _onRateChange = (event: any) => {
        mergeState({rate: event.target.value});
    };

    const _onMinLoanChange = (event: any) => {
        mergeState({min_loan: event.target.value});
    };

    const _onRepayPeriodChange = (value: any) => {
        mergeState({repay_period: value});
    };

    const _onValidityPeriodChange = (value: any) => {
        mergeState({validity_period: value});
    };

    const _onSubmit = () => {
        mergeState({
            createOfferError: null
        });
        const {
            account,
            asset_id,
            amount,
            rate,
            repay_period,
            min_loan,
            validity_period,
            pawn_assets,
            whitelist,
            feeAmount
        } = state;
        const asset: any = ChainStore.getAsset(asset_id);
        let opData: any;

        try {
            if (parseInt(min_loan) > parseInt(amount)) {
                throw new Error(
                    counterpart.translate(
                        "credit_offer.min_loan_bigger_than_balance",
                        {
                            min: min_loan,
                            balance: amount
                        }
                    )
                );
            }

            opData = {
                owner_account: account.get("id"),
                asset_type: asset_id,
                balance: new Asset({
                    real: amount,
                    asset_id,
                    precision: asset.get("precision")
                }).getAmount(),
                fee_rate: (parseFloat(rate) * FEE_RATE_DENOM) / 100,
                max_duration_seconds: repay_period,
                min_deal_amount: new Asset({
                    real: min_loan,
                    asset_id,
                    precision: asset.get("precision")
                }).getAmount(),
                auto_disable_time: validity_period,
                acceptable_collateral: pawn_assets.map(v => {
                    const va: any = ChainStore.getAsset(v.asset_id);
                    const p = new Price({
                        base: new Asset({
                            asset_id,
                            precision: asset.get("precision")
                        }),
                        quote: new Asset({
                            asset_id: v.asset_id,
                            precision: va.get("precision")
                        })
                    });
                    const rateSat = v.getAmount();
                    const oneDebtSat = Math.pow(10, asset.get("precision"));
                    const g: any = (function gcd(a: any, b: any): any {
                        return b ? gcd(b, a % b) : a;
                    })(rateSat, oneDebtSat);
                    p.base.setAmount({sats: oneDebtSat / g});
                    p.quote.setAmount({sats: rateSat / g});
                    return [v.asset_id, p.toObject()];
                }),
                acceptable_borrowers: whitelist.map(v => {
                    return [
                        v.account.get("id"),
                        new Asset({
                            real: v.amount,
                            asset_id,
                            precision: asset.get("precision")
                        }).getAmount()
                    ];
                }),
                fee_asset: feeAmount
            };
            CreditOfferActions.create(opData)
                .then(() => {
                    hideModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                    mergeState({
                        createOfferError: err.toString()
                    });
                });
        } catch (err) {
            if ((err as any).toString().indexOf("overflow") >= 0) {
                mergeState({
                    createOfferError: counterpart.translate(
                        "credit_offer.number_is_to_big"
                    )
                });
            } else {
                mergeState({
                    createOfferError: (err as any).toString()
                });
            }
            return;
        }
    };

    const _renderCreateModal = () => {
        // `asset` is reassigned below (`asset = ChainStore.getAsset(...)`),
        // so it is split into its own `let` destructure; the rest are
        // never reassigned in this function.
        let {asset} = state;
        const {
            asset_id,
            amount,
            account,
            balanceError,
            pawn_assets,
            whitelist,
            rate,
            min_loan,
            repay_period,
            validity_period
        } = state;
        const {asset_types} = _getAvailableAssets();
        let tabIndex = 0;
        let balance = null;
        const isSubmitNotValid =
            pawn_assets.length == 0 ||
            !amount ||
            !asset ||
            !rate ||
            !min_loan ||
            !repay_period ||
            !validity_period ||
            balanceError;
        if (account && account.get("balances")) {
            const account_balances = account.get("balances").toJS();
            const _error = balanceError ? "has-error" : "";
            if (asset_types.length === 1)
                asset = ChainStore.getAsset(asset_types[0]);
            if (asset_types.length > 0) {
                const current_asset_id = asset ? asset.get("id") : asset_types[0];
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
                                _setTotal(
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
        return (
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={counterpart.translate("credit_offer.create")}
                visible={state.showModal === 1}
                onCancel={hideModal}
                footer={[
                    <Button
                        key={"send"}
                        disabled={isSubmitNotValid}
                        onClick={_onSubmit}
                    >
                        <Translate content="wallet.submit" />
                    </Button>,
                    <Button key="Cancel" onClick={hideModal}>
                        <Translate content="wallet.cancel" />
                    </Button>
                ]}
            >
                <div className="grid-block vertical no-overflow">
                    <Form className="full-width" layout="vertical">
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
                        <div
                            className="content-block"
                            style={{marginBottom: 0}}
                        >
                            <div
                                className="grid-wrapper"
                                style={{marginBottom: 0}}
                            >
                                <Table
                                    columns={_getPawnColumns()}
                                    dataSource={_getPawnData()}
                                    pagination={false}
                                    locale={{emptyText: _getAddPawnBtn()}}
                                    className="modal-table"
                                />
                            </div>
                        </div>
                        {pawn_assets.length > 0 ? (
                            <div
                                className="content-block"
                                style={{textAlign: "center"}}
                            >
                                {_getAddPawnBtn()}
                            </div>
                        ) : null}

                        <div className="grid-block no-overflow wrap shrink">
                            <div
                                className="small-12 medium-6 withdraw-fee-selector"
                                style={{paddingRight: 5}}
                            >
                                <label className="left-label">
                                    <Translate content="credit_offer.fee_rate" />
                                </label>
                                <div className="inline-label input-wrapper">
                                    <Tooltip
                                        placement="top"
                                        title={counterpart.translate(
                                            "credit_offer.tip_fee_rate"
                                        )}
                                    >
                                        <Input
                                            type="number"
                                            value={rate}
                                            onChange={_onRateChange}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="small-12 medium-6 ant-form-item-label withdraw-fee-selector">
                                <label
                                    className="amount-selector-field--label"
                                    style={{marginBottom: "13px"}}
                                >
                                    <Translate content="credit_offer.repay_period" />
                                </label>
                                <div className="grid-block no-overflow wrap shrink">
                                    <Select
                                        value={repay_period}
                                        onChange={_onRepayPeriodChange}
                                    >
                                        {listRepayPeriod.map(
                                            (v: any, i: number) => (
                                                <Select.Option key={v} value={v}>
                                                    {counterpart.translate(
                                                        "credit_offer.list_repay_period.period_" +
                                                            i
                                                    )}
                                                </Select.Option>
                                            )
                                        )}
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid-block no-overflow wrap shrink">
                            <div
                                className="small-12 medium-6 withdraw-fee-selector"
                                style={{paddingRight: 5}}
                            >
                                <label className="left-label">
                                    <Translate content="credit_offer.min_borrow" />
                                </label>
                                <div className="inline-label input-wrapper">
                                    <Input
                                        type="number"
                                        value={min_loan}
                                        onChange={_onMinLoanChange}
                                    />
                                </div>
                            </div>
                            <div className="small-12 medium-6 ant-form-item-label withdraw-fee-selector">
                                <label
                                    className="amount-selector-field--label"
                                    style={{marginBottom: "13px"}}
                                >
                                    <Translate content="credit_offer.validity_period" />
                                </label>
                                <div className="grid-block no-overflow wrap shrink">
                                    <DatePicker
                                        className="text-cursor"
                                        placeholder={counterpart.translate(
                                            "credit_offer.plh_select_validity_period"
                                        )}
                                        locale={
                                            props.currentLocale == "zh"
                                                ? localeZH
                                                : null
                                        }
                                        style={{width: "100%"}}
                                        showTime={true}
                                        value={validity_period}
                                        onChange={_onValidityPeriodChange}
                                        disabledDate={(current: any) =>
                                            current <
                                                moment().add(-1, "days") ||
                                            current > moment().add(380, "days")
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        <div
                            className="content-block"
                            style={{marginBottom: 0}}
                        >
                            <div
                                className="grid-wrapper"
                                style={{marginBottom: 0}}
                            >
                                <Table
                                    columns={_getWhitelistColumns()}
                                    dataSource={_getWhitelistData()}
                                    pagination={false}
                                    locale={{
                                        emptyText: _getAddWhitelistBtn()
                                    }}
                                    className="modal-table"
                                />
                            </div>
                        </div>
                        {whitelist.length > 0 ? (
                            <div
                                className="content-block"
                                style={{textAlign: "center"}}
                            >
                                {_getAddWhitelistBtn()}
                            </div>
                        ) : null}
                        <FeeAssetSelector
                            account={account}
                            transaction={{
                                type: "credit_offer_create",
                                options: ["price_per_kbyte"],
                                data: {
                                    type: "memo",
                                    content: null
                                }
                            }}
                            onChange={onFeeChanged}
                            tabIndex={tabIndex++}
                        />
                        {state.createOfferError && (
                            <Alert
                                message={state.createOfferError}
                                type="warning"
                            />
                        )}
                    </Form>
                </div>
            </Modal>
        );
    };

    const _onInputPawn = (asset: any) => {
        mergeState({pawnInput: asset});
    };

    const _onFoundPawnAsset = (asset: any) => {
        if (asset) {
            mergeState({pawn_asset: asset});
        }
    };

    const _onPwanPriceChanged = (event: any) => {
        mergeState({pawn_price: event.target.value});
    };

    const _onHideAddPawnModal = () => {
        showModal(1);
    };

    const _renderAddPawnModal = () => {
        const {pawn_price, showModal: showModalState, pawnInput} = state;
        return (
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={counterpart.translate("credit_offer.title_add_pawn")}
                visible={showModalState === 2}
                onCancel={_onHideAddPawnModal}
                footer={[
                    <Button
                        key={"send"}
                        disabled={!pawn_price || pawn_price <= 0 || !pawnInput}
                        onClick={_addPawnItem}
                    >
                        <Translate content="wallet.submit" />
                    </Button>,
                    <Button key="Cancel" onClick={_onHideAddPawnModal}>
                        <Translate content="wallet.cancel" />
                    </Button>
                ]}
            >
                <Form className="full-width" layout="vertical">
                    <AssetSelector
                        inputClass="ant-input"
                        label="account.user_issued_assets.name"
                        onChange={_onInputPawn}
                        asset={pawnInput}
                        assetInput={pawnInput}
                        style={{width: "100%"}}
                        onFound={_onFoundPawnAsset}
                    />
                    <Form.Item
                        label={counterpart.translate(
                            "credit_offer.pawn_amount"
                        )}
                        style={{marginTop: "40px"}}
                    >
                        <Tooltip
                            placement="top"
                            title={counterpart.translate(
                                "credit_offer.tip_pawn_amount"
                            )}
                        >
                            <Input
                                style={{marginBottom: 0}}
                                value={pawn_price}
                                type="number"
                                onChange={_onPwanPriceChanged}
                            />
                        </Tooltip>
                    </Form.Item>
                </Form>
            </Modal>
        );
    };

    const _onHideWhitelistModal = () => {
        showModal(1);
    };

    const _addWhitelistItem = () => {
        const {whitelist, whitelist_account, whitelist_amount} = state;
        if (!whitelist_account || !whitelist_amount) {
            showModal(1);
            return;
        }
        const item = {
            account: whitelist_account,
            amount: whitelist_amount
        };
        whitelist.push(item);
        mergeState({whitelist, showModal: 1});
    };

    function _delWhitelistItem(account: any) {
        const {whitelist} = state;
        const index = whitelist.findIndex(v => v.account.get("name") == account);
        whitelist.splice(index, 1);
        if (index > -1) mergeState({whitelist});
    }

    const _whitelistChanged = (name: string) => {
        mergeState({whitelist_name: name});
    };

    const _onWhitelistAccountChanged = (account: any) => {
        mergeState({whitelist_account: account});
    };

    const _onWhitelistAmountChanged = ({
        amount,
        asset
    }: {
        amount: any;
        asset: any;
    }) => {
        if (!asset) return;

        if (typeof asset !== "object") {
            asset = ChainStore.getAsset(asset);
        }
        mergeState({whitelist_amount: amount});
    };

    const _renderAddWhitelistModal = () => {
        const {
            showModal: showModalState,
            whitelist_name,
            whitelist_account,
            whitelist_amount,
            asset_id
        } = state;
        return (
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={counterpart.translate(
                    "credit_offer.title_add_whitelist"
                )}
                visible={showModalState === 3}
                onCancel={_onHideWhitelistModal}
                footer={[
                    <Button key={"send"} onClick={_addWhitelistItem}>
                        <Translate content="wallet.submit" />
                    </Button>,
                    <Button key="Cancel" onClick={_onHideWhitelistModal}>
                        <Translate content="wallet.cancel" />
                    </Button>
                ]}
            >
                <Form className="full-width" layout="vertical">
                    <AccountSelector
                        label="credit_offer.account"
                        accountName={whitelist_name}
                        account={whitelist_account}
                        onChange={_whitelistChanged}
                        onAccountChanged={_onWhitelistAccountChanged}
                        typeahead={true}
                        includeMyActiveAccounts={false}
                        noForm={true}
                    />
                    <AmountSelector
                        label="credit_offer.loan_amount"
                        amount={whitelist_amount}
                        onChange={_onWhitelistAmountChanged}
                        asset={asset_id}
                    />
                </Form>
            </Modal>
        );
    };

    switch (state.showModal) {
        case 1:
            return _renderCreateModal();
        case 2:
            return _renderAddPawnModal();
        case 3:
            return _renderAddWhitelistModal();
        default:
            return null;
    }
});

CreateModalCore.displayName = "CreateModalCore";

function CreateModal(props: CreateModalOwnProps) {
    // Preserves `listenTo: [AccountStore, SettingsStore]`'s re-render
    // cadence - `currentAccount`/`passwordAccount` (AccountStore) are
    // grep-confirmed unused downstream, see header comment.
    useAltStore(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const currentLocale = settingsState.settings.get("locale");

    return (
        <CreateModalCore
            {...props}
            currentLocale={currentLocale}
            ref={props.refCallback}
        />
    );
}

export default CreateModal;
