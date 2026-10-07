// TypeScript/functional-component port of the legacy EditModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Account/CreditOffer/` batch).
// Mechanical class-to-hooks translation, no logic changes.
//
// Security-sensitive per AGENTS.md: `_onSubmit` (kept as `_onSubmit`, an
// inner closure) still calls the real `CreditOfferActions.update(opData)`
// with `opData` built exactly the same way (same `delta_amount`/`fee_rate`
// /`min_deal_amount`/`acceptable_collateral`/`acceptable_borrowers`/
// `fee_asset` computation, including the gcd-based price-ratio reduction
// and the "drop `delta_amount` when it is exactly 0" step), and the
// `.then(hideModal)` / `.catch(err => console.error(err))` handling is
// unchanged. Grepped this file for `WalletApi`/`WalletDb`/password/
// private-key/brainkey material - none appear; the one `console.error(err)`
// just logs the caught error object (kept as-is, not the "never log
// secrets" exception case).
//
// Two original classes:
// - `EditModal` (the class holding all state/logic/render) ->
//   `EditModalCore`, a `React.forwardRef<EditModalHandle,
//   EditModalCoreProps>` function component. External callers hold an
//   imperative ref: `CreditOfferList.jsx`'s `showEditModal(data)` does
//   `if (this.edit_modal) this.edit_modal.initModal(data);` (grepped
//   app-wide for `.initModal(`/`.showModal(`/`.hideModal(` on an
//   `edit_modal`/`EditModal` ref - only `initModal` is ever called from
//   outside this file; `showModal`/`hideModal` are only ever called on
//   `this` from inside the original class itself, e.g. from
//   `onCancel`/the submit-modal buttons). So, matching this migration's
//   established "expose exactly the imperative API existing callers rely
//   on" rule (see `SendModal.tsx`'s header comment, which this port's
//   `refCallback`/`useImperativeHandle` shape is modeled on directly -
//   `EditModal.jsx`/`SendModal.jsx` are two of the very few files in the
//   app using this exact `refCallback` + whole-instance-ref convention),
//   `EditModalHandle` below exposes only `{initModal}`.
// - `EditModalConnectWrapper` (`connect(EditModalConnectWrapper,
//   {listenTo: [AccountStore, SettingsStore], getProps})`, rendering
//   `<EditModal {...this.props} ref={this.props.refCallback} />`) ->
//   `EditModal`, a thin function component that reads only what the
//   core component actually consumes and forwards `refCallback` as a
//   real `ref`. Grepped `EditModal.jsx` for every `this.props.` read:
//   only `this.props.id` and `this.props.currentLocale` (used for the
//   `DatePicker`'s `zh_CN` locale) are ever read anywhere in the class -
//   `currentAccount`/`passwordAccount`, both produced by the original
//   `getProps` from `AccountStore.getState()`, are computed and passed
//   down but never read by `EditModal` at all. Since `connect`'s
//   `listenTo: [AccountStore]` therefore only ever affected *how often*
//   this modal re-rendered (on every `AccountStore` change) and never
//   *what* it rendered, the `AccountStore` listen is dropped entirely
//   here (documented dead data, not "fixed" behavior - matches this
//   migration's `shouldComponentUpdate`-drop precedent of only ever
//   affecting render frequency, never output; see e.g.
//   `AccountPortfolioList.tsx`'s header comment for the same class of
//   change). Only `SettingsStore` is read, via `useAltStore`, for
//   `currentLocale`.
//
// `getDataState(itemData)` (building the full "edit an existing offer"
// state from the row data `CreditOfferList.jsx` passes to `initModal`)
// and `getInitialState(props)` never read `this.state`/other instance
// methods, so both become plain module-scope functions taking their
// former `this`-free arguments directly, per this migration's convention
// for methods that are already pure of `this` (e.g.
// `AccountPortfolioList.tsx`'s `_sumCollateralBalances`/
// `_sumVestingBalances`).
//
// `setState(patch, callback)` two-arg calls (`onAmountChanged`,
// `onFeeChanged`, `_setTotal`, `_addWhitelistItem`) all pass a callback
// that reads fields the very same `setState` call is *also* just about
// to change (`_checkBalance` reads `amount`/`asset`/`feeAmount`, all of
// which the calling site just patched) - unlike this migration's usual
// "callback only touches untouched state" case (see
// `AccountPortfolioList.tsx`'s header comment), a plain `mergeState`
// then `stateRef.current` read would still see the *pre-update* values
// at call time (the update hasn't re-rendered yet). Replicated instead by
// giving `_checkBalance` an optional `overrides` argument merged over
// `stateRef.current` before it reads anything, so each call site passes
// exactly the patch it just applied - simulating precisely what
// `this.state` would look like once React's class `setState` callback
// actually ran, without waiting for an extra render. `_addWhitelistItem`'s
// callback (`() => this.showModal(1)`) has no such same-patch dependency,
// so it's translated as `mergeState(...)` followed by `showModal(1)`
// called synchronously right after, per the simpler established rule.
//
// `shouldComponentUpdate`/`componentDidUpdate`/`UNSAFE_component*`: none
// exist in the original (grepped) - nothing to translate there.
//
// Legacy string refs: none exist in this file (grepped for `ref="`) -
// only the `refCallback` prop convention described above.
//
// Confirmed-dead code dropped (grepped, not assumed):
// - `_getAvailableAssets(state = this.state)` - fully defined (builds an
//   `asset_types` list from `state.account`'s balances), but never called
//   anywhere else in the file; grepped the whole file for
//   `_getAvailableAssets` and `asset_types` and found only its own
//   definition, no call site. Dropped entirely, along with the now-unused
//   `utils` import it was the sole user of (`utils.sortID` doesn't appear
//   anywhere else in this file).
//
// Preserved verbatim (not "fixed"), found while reading the original
// closely:
// - `_onPwanPriceChanged` keeps its original misspelling ("Pwan" instead
//   of "Pawn") - purely a private method name, never read by anything
//   outside this file.
// - `_setTotal`'s call site binds two extra arguments
//   (`feeAmount.getAmount({real: true})`, `feeAmount.asset_id`) that
//   `_setTotal(asset_id, balance_id)`'s own signature never declares a
//   parameter for - JS silently drops unused extra arguments, so those
//   two values were always inert. Reproduced by simply not giving
//   `_setTotal` any parameters beyond `asset_id`/`balance_id`. Since that
//   was `state.feeAmount`'s only read anywhere inside `_renderEditModal`
//   (grepped), `feeAmount` is no longer destructured there either -
//   dropping a value that was already write-only-into-a-dead-argument,
//   not a behavior change.
// - `pawn_assets`/`whitelist` are mutated in place (`.splice`/`.push`)
//   before being handed back into `mergeState` with the same array
//   reference - matches the original class's identical
//   mutate-then-`setState`-with-the-same-reference pattern; safe here too
//   because `mergeState` always spreads into a brand-new state *object*,
//   so React's `useState` setter never bails out on reference equality
//   the way it would for a raw array (see `AccountSelector.tsx`'s header
//   comment for the case where that distinction *does* matter - not the
//   case here, since only object-level, not array-level, identity is
//   ever relied on for re-rendering).
//
// TypeScript-forced adjustments: `bitshares-ui-style-guide` and
// `alt-react` are both blanket `declare module` shims (already in
// `app/types/vendor-shims.d.ts`), so every `bitshares-ui-style-guide`
// component prop and DOM-ish event handler argument
// (`_onRateChange`/`_onMinLoanChange`/`_onPwanPriceChanged`'s `event`,
// `DatePicker`'s `disabledDate`'s `current`) is annotated `any` -
// matching this migration's established pattern for the same library
// (see e.g. `HtlcModal.tsx`/`DirectDebitModal.tsx`'s
// `disabledDate={(current: any) => ...}`). `catch (err: any)` in
// `_onSubmit` is likewise explicit, since `err.toString()` is called on
// it and `strict`'s `useUnknownInCatchVariables` would otherwise type a
// bare `catch (err)` as `unknown`.
import * as React from "react";
import counterpart from "counterpart";
import SettingsStore from "stores/SettingsStore";
import {ChainStore} from "bitsharesjs";
import {Tooltip} from "../../../design-system/Tooltip";
import {Table} from "../../../design-system/Table";
import {Modal} from "../../../design-system/Modal";
import {Button} from "../../../design-system/Button";
import {Select} from "../../../design-system/Select";
import {Input} from "../../../design-system/Input";
import {Form} from "../../../design-system/Form";
import {DatePicker} from "../../../design-system/DatePicker";
import {Alert} from "../../../design-system/Alert";
import {Icon as AntIcon} from "../../../design-system/Icon";
import AmountSelector from "../../Utility/AmountSelectorStyleGuide";
import FeeAssetSelector from "../../Utility/FeeAssetSelector";
import BalanceComponent from "../../Utility/BalanceComponent";
import AssetSelector from "../../Utility/AssetSelector";
import AccountSelector from "../../Account/AccountSelector";
import AccountName from "../../Utility/AccountName";

import {checkBalance} from "common/trxHelper";
import {Asset, Price} from "../../../lib/common/MarketClasses";
import Translate from "react-translate-component";
import moment from "moment";
import localeZH from "antd/es/date-picker/locale/zh_CN";
import CreditOfferActions, {
    FEE_RATE_DENOM,
    listRepayPeriod
} from "../../../actions/CreditOfferActions";
import {useAltStore} from "../../../next/hooks/useAltStore";

const getUninitializedFeeAmount = () =>
    new (Asset as any)({amount: 0, asset_id: "1.3.0"});

interface EditModalState {
    submitErr: string | null;
    showModal: number; // 0: hidden, 1: edit modal, 2: add pawn modal, 3: add whitelist modal
    account: any;
    amount: any;
    asset_id: string | null;
    asset: any;
    error: any;
    feeAmount: any;
    maxAmount: boolean;
    balanceError: boolean;
    pawn_assets: any[];
    pawnInput: any;
    pawn_asset: any;
    pawn_price: any;
    whitelist: any[];
    whitelist_name: string;
    whitelist_account: any;
    whitelist_amount: any;
    rate: any;
    repay_period: any;
    validity_period: any;
    offer_id?: any;
    balanceAmount?: any;
    totalBalanceAmount?: any;
    min_loan?: any;
}

function getInitialState(props: {account?: any}): EditModalState {
    return {
        submitErr: null,
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

function getDataState(itemData: any): EditModalState {
    const asset_type_precision = ChainStore.getAsset(itemData.asset_type).get(
        "precision"
    );
    const asset = new (Asset as any)({
        amount: itemData.current_balance,
        asset_id: itemData.asset_type,
        precision: asset_type_precision
    });
    const totalBalanceAsset = new (Asset as any)({
        amount: itemData.total_balance,
        asset_id: itemData.asset_type,
        precision: asset_type_precision
    });
    const pawn_assets = itemData.acceptable_collateral.map((v: any) => {
        const bp = ChainStore.getAsset(v[1].base.asset_id).get("precision");
        const qp = ChainStore.getAsset(v[1].quote.asset_id).get("precision");
        const price = new (Price as any)({
            base: new (Asset as any)({
                asset_id: v[1].base.asset_id,
                amount: v[1].base.amount,
                precision: bp
            }),
            quote: new (Asset as any)({
                asset_id: v[1].quote.asset_id,
                amount: v[1].quote.amount,
                precision: qp
            })
        });
        return new (Asset as any)({
            // real: price.toReal(),
            real: 1 / price.toReal(), //Keeping it consistent with the App, this may violate Graphene's price representation convention.
            asset_id: v[0],
            precision: ChainStore.getAsset(v[0]).get("precision")
        });
    });

    const whitelist = itemData.acceptable_borrowers.map((v: any) => {
        return {
            account: v[0],
            amount: new (Asset as any)({
                amount: v[1],
                asset_id: itemData.asset_type,
                precision: asset_type_precision
            }).getAmount({real: true})
        };
    });
    return {
        submitErr: null,
        showModal: 0, // 1: create modal 2: add pawn modal 3: add whitelist modal
        offer_id: itemData.id,
        account: ChainStore.getAccount(itemData.owner_account, false),
        amount: asset.getAmount({real: true}),
        balanceAmount: asset.getAmount({real: true}),
        totalBalanceAmount: totalBalanceAsset.getAmount({real: true}),
        asset_id: itemData.asset_type,
        asset: null,
        error: null,
        feeAmount: getUninitializedFeeAmount(),
        maxAmount: false,
        balanceError: false,
        pawnInput: null,
        pawn_asset: null,
        pawn_price: null,
        pawn_assets: pawn_assets,
        whitelist: whitelist,
        whitelist_name: "",
        whitelist_account: null,
        whitelist_amount: "",
        rate: (parseFloat(itemData.fee_rate) / FEE_RATE_DENOM) * 100,
        repay_period: itemData.max_duration_seconds,
        validity_period: moment(itemData.auto_disable_time),
        min_loan: new (Asset as any)({
            amount: itemData.min_deal_amount,
            asset_id: itemData.asset_type,
            precision: asset_type_precision
        }).getAmount({real: true})
    };
}

export interface EditModalHandle {
    initModal: (data: any, modal?: number) => void;
}

interface EditModalCoreProps {
    id?: string;
    account?: any;
    currentLocale?: string;
}

const EditModalCore = React.forwardRef<EditModalHandle, EditModalCoreProps>(
    (props, ref) => {
        const [state, setState] = React.useState<EditModalState>(() =>
            getInitialState(props)
        );
        const stateRef = React.useRef(state);
        stateRef.current = state;

        const mergeState = (patch: Partial<EditModalState>) =>
            setState(prev => ({...prev, ...patch}));

        const showModal = (modal = 1) => {
            mergeState({showModal: modal});
        };

        const initModal = (data: any, modal = 1) => {
            const newState = getDataState(data);
            newState.showModal = modal;
            mergeState(newState);
        };

        const hideModal = () => {
            mergeState({showModal: 0});
        };

        React.useImperativeHandle(ref, () => ({initModal}));

        const _checkBalance = (overrides: Partial<EditModalState> = {}) => {
            const s = {...stateRef.current, ...overrides};
            const {feeAmount, amount, account, asset} = s;
            if (!asset || !account) return;
            const balanceID = account.getIn(["balances", asset.get("id")]);
            const feeBalanceID = account.getIn(["balances", feeAmount.asset_id]);
            if (!asset || !account) return;
            if (!balanceID) return mergeState({balanceError: true});
            const balanceObject = ChainStore.getObject(balanceID);
            const feeBalanceObject = feeBalanceID
                ? ChainStore.getObject(feeBalanceID)
                : null;
            if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
                mergeState({feeAmount: getUninitializedFeeAmount()});
            }
            if (!balanceObject || !feeAmount) return;
            if (!amount) return mergeState({balanceError: false});
            const hasBalance = checkBalance(
                amount - s.balanceAmount,
                asset,
                feeAmount,
                balanceObject
            );
            if (hasBalance === null) return;
            mergeState({balanceError: !hasBalance});
        };

        const onAmountChanged = ({amount, asset}: {amount: any; asset: any}) => {
            if (!asset) return;

            if (typeof asset !== "object") {
                asset = ChainStore.getAsset(asset);
            }

            const patch = {
                amount,
                asset,
                asset_id: asset.get("id"),
                error: null,
                maxAmount: false
            };
            mergeState(patch);
            _checkBalance(patch);
        };

        const onFeeChanged = (fee: any) => {
            if (!fee) return;

            const patch = {
                feeAmount: fee,
                error: null
            };
            mergeState(patch);
            _checkBalance(patch);
        };

        const _setTotal = (asset_id: any, balance_id: any) => {
            const {feeAmount} = stateRef.current;
            const balanceObject = ChainStore.getObject(balance_id);
            const transferAsset = ChainStore.getObject(asset_id);

            if (balanceObject) {
                const balance = new (Asset as any)({
                    amount: balanceObject.get("balance"),
                    asset_id: transferAsset.get("id"),
                    precision: transferAsset.get("precision")
                });
                if (feeAmount.asset_id === balance.asset_id) {
                    balance.minus(feeAmount);
                }
                const patch = {maxAmount: true, amount: balance.getAmount({real: true})};
                mergeState(patch);
                _checkBalance(patch);
            }
        };

        const _delPawnItem = (asset: any) => {
            const {pawn_assets} = stateRef.current;
            const index = pawn_assets.findIndex(v => v.asset_id == asset);
            pawn_assets.splice(index, 1);
            if (index > -1) mergeState({pawn_assets: pawn_assets});
        };

        const _addPawnItem = () => {
            let pawn_asset = stateRef.current.pawn_asset;
            const {pawn_price, pawn_assets} = stateRef.current;
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
                        new (Asset as any)({
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
                    render: (text: any) => <AccountName account={text} />
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
            const {pawn_assets} = stateRef.current;
            return pawn_assets.map(a => {
                const asset = ChainStore.getAsset(a.asset_id);
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
            const {whitelist} = stateRef.current;
            return whitelist.map(v => {
                return {
                    key: v.account,
                    account: v.account,
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
                feeAmount,
                offer_id,
                balanceAmount,
                totalBalanceAmount
            } = stateRef.current;

            mergeState({
                submitErr: null
            });

            let opData: any;

            try {
                const updatedBalance =
                    totalBalanceAmount +
                    (parseInt(amount) - parseInt(balanceAmount));

                if (parseInt(min_loan) > updatedBalance) {
                    throw new Error(
                        counterpart.translate(
                            "credit_offer.min_loan_bigger_than_balance",
                            {
                                min: min_loan,
                                balance: updatedBalance.toFixed(4)
                            }
                        )
                    );
                }

                const asset_precision = ChainStore.getAsset(asset_id).get(
                    "precision"
                );
                opData = {
                    owner_account: account.get("id"),
                    offer_id,
                    delta_amount: new (Asset as any)({
                        real: parseInt(amount) - parseInt(balanceAmount),
                        asset_id,
                        precision: asset_precision
                    }),
                    fee_rate: (parseFloat(rate) * FEE_RATE_DENOM) / 100,
                    max_duration_seconds: repay_period,
                    min_deal_amount: new (Asset as any)({
                        real: min_loan,
                        asset_id,
                        precision: asset_precision
                    }).getAmount(),
                    enabled: true,
                    auto_disable_time: validity_period,
                    acceptable_collateral: pawn_assets.map((v: any) => {
                        const v_precision = ChainStore.getAsset(v.asset_id).get(
                            "precision"
                        );
                        const p = new (Price as any)({
                            base: new (Asset as any)({asset_id, precision: asset_precision}),
                            quote: new (Asset as any)({
                                asset_id: v.asset_id,
                                precision: v_precision
                            })
                        });
                        const rateSat = v.getAmount();
                        const oneDebtSat = Math.pow(10, asset_precision);
                        const g = (function gcd(a: number, b: number): number {
                            return b ? gcd(b, a % b) : a;
                        })(rateSat, oneDebtSat);
                        p.base.setAmount({sats: oneDebtSat / g});
                        p.quote.setAmount({sats: rateSat / g});
                        return [v.asset_id, p.toObject()];
                    }),
                    acceptable_borrowers: whitelist.map((v: any) => {
                        return [
                            v.account.get ? v.account.get("id") : v.account,
                            new (Asset as any)({
                                real: v.amount,
                                asset_id,
                                precision: asset_precision
                            }).getAmount()
                        ];
                    }),
                    fee_asset: feeAmount
                };

                if (opData.delta_amount.getAmount({real: true}) === 0) {
                    delete opData.delta_amount;
                }
                CreditOfferActions.update(opData)
                    .then(() => {
                        hideModal();
                    })
                    .catch((err: any) => {
                        console.error(err);
                    });
            } catch (err: any) {
                if (err.toString().indexOf("overflow") >= 0) {
                    mergeState({
                        submitErr: counterpart.translate(
                            "credit_offer.number_is_to_big"
                        )
                    });
                } else {
                    mergeState({
                        submitErr: err.toString()
                    });
                }
            }
        };

        const _renderEditModal = () => {
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
                if (asset_id && !asset) asset = ChainStore.getAsset(asset_id);
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
                                _setTotal(
                                    asset_id,
                                    account_balances[asset_id as any]
                                )
                            }
                        >
                            <BalanceComponent
                                balance={account_balances[asset_id as any]}
                            />
                        </span>
                    </span>
                );
            }
            return (
                <Modal
                    wrapClassName="modal--transaction-confirm"
                    title={counterpart.translate("credit_offer.edit")}
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
                                label="credit_offer.current_available_balance"
                                amount={amount}
                                onChange={onAmountChanged}
                                asset={asset_id}
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
                                            {listRepayPeriod.map((v: any, i: number) => (
                                                <Select.Option key={v} value={v}>
                                                    {counterpart.translate(
                                                        "credit_offer.list_repay_period.period_" +
                                                            i
                                                    )}
                                                </Select.Option>
                                            ))}
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
                        </Form>
                    </div>
                    {state.submitErr && (
                        <Alert message={state.submitErr} type="warning" />
                    )}
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
            const {whitelist, whitelist_account, whitelist_amount} = stateRef.current;
            if (!whitelist_account || !whitelist_amount) {
                showModal(1);
                return;
            }
            const item = {
                account: whitelist_account.get("id"),
                amount: whitelist_amount
            };
            whitelist.push(item);
            mergeState({whitelist});
            showModal(1);
        };

        const _delWhitelistItem = (account: any) => {
            const {whitelist} = stateRef.current;
            const index = whitelist.findIndex(v => v.account == account);
            whitelist.splice(index, 1);
            if (index > -1) mergeState({whitelist});
        };

        const _whitelistChanged = (name: any) => {
            mergeState({whitelist_name: name});
        };

        const _onWhitelistAccountChanged = (account: any) => {
            mergeState({whitelist_account: account});
        };

        const _onWhitelistAmountChanged = ({amount, asset}: {amount: any; asset: any}) => {
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
                return _renderEditModal();
            case 2:
                return _renderAddPawnModal();
            case 3:
                return _renderAddWhitelistModal();
            default:
                return null;
        }
    }
);

EditModalCore.displayName = "EditModalCore";

interface EditModalProps {
    id?: string;
    account?: any;
    refCallback?: (ref: EditModalHandle | null) => void;
}

export default function EditModal({refCallback, ...rest}: EditModalProps) {
    const settingsState = useAltStore<any>(SettingsStore as any);
    const currentLocale = settingsState.settings.get("locale");

    return (
        <EditModalCore
            {...rest}
            currentLocale={currentLocale}
            ref={refCallback as any}
        />
    );
}
