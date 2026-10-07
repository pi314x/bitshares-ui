// TypeScript/functional-component port of the legacy CreditOfferPage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Account/CreditOffer/` batch).
// Mechanical class-to-hooks translation, no logic changes. This is a
// route-level component: `App.jsx` lazy-loads it directly
// (`webpackChunkName: "explorer"`, `component={CreditOfferPage}`), so it
// receives no props of its own beyond react-router's implicit
// `match`/`location`/`history` - none of which the original ever read, so
// none are declared here, matching `PredictionMarkets/PMAssetsContainer.tsx`
// / `Dashboard/DashboardPage.tsx`'s precedent for unread route props.
//
// Security-sensitive per AGENTS.md: this component dispatches
// `CreditOfferActions.accept(data)` (in `onSubmit`, below) and
// `CreditOfferActions.getAll({flag: "first"})` (a read, mount-only
// `useEffect`). Both calls, their argument construction, and the
// surrounding `Asset`/`Price`/fee-rate math (`onAmountChanged`,
// `setTotal`, `checkBalance`) are preserved exactly as in the original -
// no rounding/precision logic was touched. Neither this file nor its
// callback paths touch `WalletDb`/wallet-unlock/key-import flows or any
// password/private-key/brainkey material (grepped); the
// `console.error(err)` in the `accept` `.catch()` just logs the caught
// error object, matching the original, and is kept as-is (not the "never
// log passwords" exception case). The commented-out
// `// console.log("data: ", data);` right before the `accept` call, and
// the commented-out `// let currentAmount = price.toReal() *
// mortgageAsset.getAmount();` inside `onAmountChanged`, are
// already-inert comments in the original - left as inert comments here
// too, not uncommented or deleted.
//
// Structural change (not a behavior change): the original's
// `connect(CreditOfferPage, {listenTo: [AccountStore, CreditOfferStore,
// IntlStore], getProps})` alt-react HOC is replaced by
// `useAltStore(AccountStore)` + `useAltStore(CreditOfferStore)` +
// `useAltStore(IntlStore)` calls inside the component body, per this
// migration's established `useAltStore` pattern (e.g.
// `Dashboard/DashboardPage.tsx`).
//
// The class's several `this.state.X` fields are kept as one combined
// state object (not split into separate `useState` calls), updated via a
// `mergeState` shallow-merge helper, to preserve the original's atomic
// multi-field `this.setState({a, b, c})` updates exactly. Several call
// sites also pass a second `this.setState(update, callback)` argument (a
// callback fired after the state update commits) - replicated by calling
// `checkBalance()` right after the corresponding `mergeState` call, same
// as `CreditDebtList.tsx`'s / `FeeAssetSelector.tsx`'s precedent for
// translating that pattern (safe here too: none of these callbacks read
// anything from the freshly-rendered DOM, only from state/refs).
//
// A `stateRef` mirror (`stateRef.current = state` every render) lets
// `checkBalance`/`onSubmit`/`onAmountChanged`/`setTotal` read the CURRENT
// state without needing every field as a dependency, matching the
// original methods' `this.state` always reading the current value.
//
// No `shouldComponentUpdate`, `componentDidUpdate`,
// `UNSAFE_componentWillReceiveProps`/`UNSAFE_componentWillMount`, or
// imperative string refs exist in the original (verified by reading the
// whole file) - only `componentDidMount`, translated to a mount-only
// `useEffect(() => {...}, [])`.
//
// Preserved verbatim, not "fixed" (pre-existing bugs/quirks in the
// original, transcribed exactly):
// - `_renderAcceptModal`'s `if ((!selectAsset, !debtAsset)) return null;`
//   uses the JS comma operator: `!selectAsset` is evaluated and its
//   result discarded, and the `if` only actually tests `!debtAsset`. Kept
//   exactly as `if ((!selectAsset, !debtAsset)) return null;` here too
//   (an eslint `no-sequences`-style rule would normally flag this, but
//   changing it would change which case triggers the early return).
// - The footer's `info.owner_account === info.owner_account && (...)`
//   is a tautology (always `true`) - transcribed exactly; the intent was
//   very likely `account.get("id") === info.owner_account` (the borrower
//   being the offer's own owner), matching the adjacent
//   `isSubmitNotValid`'s real `account.get("id") == info.owner_account`
//   check just above it, but "fixing" it would change when
//   `credit_offer.info_borrow_err` renders, so it is left as-is.
// - `_sortByAsset`'s `assetName.includes(...)` call is unguarded against
//   `ChainStore.getAsset(v.asset_type)?.get("symbol")` returning
//   `undefined` (optional-chained) - a latent possible-crash path in the
//   original, transcribed exactly rather than guarded.
//
// TypeScript props: `currentAccount`/`passwordAccount`/`allList`/`locale`
// were read but not declared in a `propTypes` block (the original
// declares none at all) - documented in a comment above instead, since
// as a route component this file's own default export takes no props at
// all (see above). All chain-object/Asset/Price/
// store values are typed `any` (Immutable.Map-backed chain objects and
// the `Asset`/`Price` helper classes from `lib/common/MarketClasses` have
// no existing TS types in this codebase), consistent with every other
// port in this migration touching the same objects (e.g.
// `FeeAssetSelector.tsx`, `CreditDebtList.tsx`).
import * as React from "react";
import counterpart from "counterpart";
import {Tooltip} from "../../../design-system/Tooltip";
import {Modal} from "../../../design-system/Modal";
import {Button} from "../../../design-system/Button";
import {Table} from "../../../design-system/Table";
import {Form} from "../../../design-system/Form";
import {Icon as AntIcon} from "../../../design-system/Icon";
import {Alert} from "../../../design-system/Alert";
import assetUtils from "common/asset_utils";
import SearchInput from "../../Utility/SearchInput";
import LinkToAssetById from "../../Utility/LinkToAssetById";
import FormattedAsset from "../../Utility/FormattedAsset";
import LinkToAccountById from "../../Utility/LinkToAccountById";
import moment from "moment";
import utils from "../../../lib/common/utils";
import CreditOfferActions, {
    FEE_RATE_DENOM,
    parsingTime
} from "../../../actions/CreditOfferActions";

import AccountStore from "stores/AccountStore";
import CreditOfferStore from "stores/CreditOfferStore";
import {Asset, Price as PriceUntyped} from "../../../lib/common/MarketClasses";
import {ChainStore} from "bitsharesjs";

// `Price`'s constructor destructures some params without default values
// (`base`/`quote`) mixed with one that does have a default (`real`) - TS's
// JS inference only picks up the defaulted one as a known property, the
// same pre-existing gap already worked around for `Price`/
// `LimitOrderCreate` in `Exchange.tsx`. `Asset`'s constructor defaults
// every param, so it isn't affected and needs no cast.
const Price: any = PriceUntyped;
import AmountSelector from "../../Utility/AmountSelectorStyleGuide";
import AssetSelect from "../../Utility/AssetSelect";
import Translate from "react-translate-component";
import FeeAssetSelector from "../../Utility/FeeAssetSelector";
import {checkBalance as checkBalanceHasFunds} from "common/trxHelper";
import IntlStore from "stores/IntlStore";
import {useAltStore} from "../../../next/hooks/useAltStore";

const getUninitializedFeeAmount = () =>
    new Asset({amount: 0, asset_id: "1.3.0"});

// Note (see header comment): this is a route-level component rendered
// with no props of its own - `currentAccount`/`passwordAccount`/
// `allList`/`locale` are all resolved below via `useAltStore`, not
// received as props, so no props interface is declared.

interface CreditOfferPageState {
    info: any;
    filterValue: any;
    showModal: boolean;
    amount: any;
    balanceError: boolean;
    maxAmount: boolean;
    feeAmount: any;
    mortgageAmount: any;
    rateAmount: any;
    assetList?: any;
    selectAsset?: any;
    debtAsset?: any;
    currentBalance?: any;
    error?: any;
}

function CreditOfferPage() {
    const accountState = useAltStore<any>(AccountStore);
    const creditOfferState = useAltStore<any>(CreditOfferStore);
    const intlState = useAltStore<any>(IntlStore);

    const currentAccount = accountState.currentAccount;
    // `passwordAccount` was read from `AccountStore` in the original's
    // `getProps()` but never referenced anywhere in the class body either
    // - not read here for the same reason (would be an unused-variable
    // lint error).
    const allList = creditOfferState.allList;
    const locale = intlState.currentLocale;

    const [state, setState] = React.useState<CreditOfferPageState>({
        info: null,
        filterValue: null,
        showModal: false,
        amount: null,
        balanceError: false,
        maxAmount: false,
        feeAmount: getUninitializedFeeAmount(),
        mortgageAmount: 0,
        rateAmount: 0
    });

    const mergeState = (patch: Partial<CreditOfferPageState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    React.useEffect(() => {
        CreditOfferActions.getAll({flag: "first"});
    }, []);

    const checkBalance = () => {
        const account = ChainStore.getAccount(currentAccount);
        const {feeAmount, mortgageAmount, selectAsset} = stateRef.current;
        if (!selectAsset || !account) return;
        const balanceID = account.getIn(["balances", selectAsset.get("id")]);
        const feeBalanceID = account.getIn(["balances", feeAmount.asset_id]);
        if (!balanceID) {
            mergeState({balanceError: true});
            return;
        }
        const balanceObject = ChainStore.getObject(balanceID);
        const feeBalanceObject = feeBalanceID
            ? ChainStore.getObject(feeBalanceID)
            : null;
        if (!feeBalanceObject || feeBalanceObject.get("balance") === 0) {
            mergeState({feeAmount: getUninitializedFeeAmount()});
        }
        if (!balanceObject || !feeAmount) return;
        if (!mortgageAmount) {
            mergeState({balanceError: false});
            return;
        }
        const mortgageReal = new Asset({
            asset_id: selectAsset.get("id"),
            amount: mortgageAmount,
            precision: selectAsset.get("precision")
        }).getAmount({real: true});
        const hasBalance = checkBalanceHasFunds(
            mortgageReal,
            selectAsset,
            feeAmount,
            balanceObject
        );
        if (hasBalance === null) return;
        mergeState({balanceError: !hasBalance});
    };

    const showAcceptModal = (data: any) => {
        const assetList = data.acceptable_collateral.map((v: any) => v[0]);
        let debtAsset = data.asset_type;
        let selectAsset = assetList[0];
        if (typeof selectAsset == "string") {
            selectAsset = ChainStore.getAsset(selectAsset);
        }
        if (typeof debtAsset == "string") {
            debtAsset = ChainStore.getAsset(debtAsset);
        }
        mergeState({
            showModal: true,
            assetList,
            selectAsset,
            debtAsset,
            currentBalance: data.current_balance,
            info: data
        });
    };

    const hideAcceptModal = () => {
        mergeState({showModal: false});
    };

    const handleFilterInput = (e: any) => {
        mergeState({
            filterValue: e.target.value.toUpperCase()
        });
    };

    const sortByAmount = (
        aAmount: any,
        aAssetId: any,
        bAmount: any,
        bAssetId: any
    ) => {
        const aAsset = utils.convert_satoshi_to_typed(
            aAmount,
            ChainStore.getAsset(aAssetId)
        );
        const bAsset = utils.convert_satoshi_to_typed(
            bAmount,
            ChainStore.getAsset(bAssetId)
        );
        return (aAsset as any) - (bAsset as any);
    };

    const getColumns = () => {
        const loc = locale === "zh" ? "zh_CN" : locale;
        return [
            {
                key: "id",
                title: "ID",
                dataIndex: "id"
            },
            {
                key: "asset_type",
                title: counterpart.translate("credit_offer.asset"),
                dataIndex: "asset_type",
                render: (text: any) => <LinkToAssetById asset={text} />
            },
            {
                key: "owner_account",
                title: counterpart.translate("credit_offer.account"),
                dataIndex: "owner_account",
                render: (accountId: any) => (
                    <LinkToAccountById account={accountId} />
                )
            },
            {
                key: "total_balance",
                title: counterpart.translate("credit_offer.total_amount"),
                dataIndex: "total_balance",
                align: "right",
                sorter: (a: any, b: any) =>
                    sortByAmount(
                        a.total_balance,
                        a.asset_type,
                        b.total_balance,
                        b.asset_type
                    ),
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                key: "current_balance",
                title: counterpart.translate("credit_offer.available_amount"),
                align: "right",
                dataIndex: "current_balance",
                sorter: (a: any, b: any) =>
                    sortByAmount(
                        a.current_balance,
                        a.asset_type,
                        b.current_balance,
                        b.asset_type
                    ),
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                key: "min_deal_amount",
                title: counterpart.translate("credit_offer.min_borrow"),
                align: "right",
                dataIndex: "min_deal_amount",
                sorter: (a: any, b: any) =>
                    sortByAmount(
                        a.min_deal_amount,
                        a.asset_type,
                        b.min_deal_amount,
                        b.asset_type
                    ),
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                key: "fee_rate",
                title: counterpart.translate("credit_offer.fee_rate"),
                align: "right",
                dataIndex: "fee_rate",
                sorter: (a: any, b: any) => a.fee_rate - b.fee_rate,
                render: (item: any) =>
                    `${utils.format_number(
                        (parseFloat(item) / parseFloat(String(FEE_RATE_DENOM))) *
                            100,
                        2,
                        false
                    )}%`
            },
            {
                key: "max_duration_seconds",
                title: counterpart.translate("credit_offer.repay_period"),
                dataIndex: "max_duration_seconds",
                align: "right",
                sorter: (a: any, b: any) =>
                    a.max_duration_seconds - b.max_duration_seconds,
                render: (item: any) => {
                    return parsingTime(item, loc);
                }
            },
            {
                key: "auto_disable_time",
                title: counterpart.translate("credit_offer.validity_period"),
                dataIndex: "auto_disable_time",
                render: (text: any) =>
                    moment
                        .utc(text)
                        .local()
                        .format("YYYY-MM-DD HH:mm:ss")
            },
            {
                key: "acceptable_collateral",
                title: counterpart.translate("credit_offer.mortgage_assets"),
                dataIndex: "acceptable_collateral",
                render: (item: any) => {
                    return item.map((v: any) => (
                        <div key={v[0]}>
                            <LinkToAssetById asset={v[0]} />
                        </div>
                    ));
                }
            },
            {
                title: counterpart.translate("credit_offer.borrow"),
                key: "action",
                render: (_: any, row: any) => {
                    return (
                        <span style={{fontSize: 20}}>
                            <Tooltip
                                title={counterpart.translate(
                                    "credit_offer.borrow"
                                )}
                            >
                                <AntIcon
                                    type="dollar"
                                    style={{
                                        cursor: "pointer",
                                        marginRight: "20px"
                                    }}
                                    onClick={() => {
                                        showAcceptModal(row);
                                    }}
                                />
                            </Tooltip>
                        </span>
                    );
                }
            }
        ];
    };

    const sortByAsset = () => {
        const {filterValue} = state;
        if (filterValue) {
            return (allList || []).filter((v: any) => {
                const assetName = ChainStore.getAsset(v.asset_type)?.get(
                    "symbol"
                );
                return assetName.includes(filterValue.toUpperCase());
            });
        } else {
            return allList;
        }
    };

    const onSubmit = () => {
        const {
            selectAsset,
            mortgageAmount,
            info,
            debtAsset,
            amount
        } = stateRef.current;
        const account = ChainStore.getAccount(currentAccount);
        if (info.owner_account !== account.get("id")) {
            const data = {
                borrower: account.get("id"),
                offer_id: info.id,
                borrow_amount: new Asset({
                    asset_id: debtAsset.get("id"),
                    real: amount,
                    precision: debtAsset.get("precision")
                }),
                collateral: new Asset({
                    asset_id: selectAsset.get("id"),
                    amount: mortgageAmount,
                    precision: selectAsset.get("precision")
                }),
                max_fee_rate: info.fee_rate,
                min_duration_seconds: info.max_duration_seconds
            };
            // console.log("data: ", data);
            CreditOfferActions.accept(data)
                .then(() => {
                    hideAcceptModal();
                })
                .catch((err: any) => {
                    // todo: visualize error somewhere
                    console.error(err);
                });
        }
    };

    const onAssetChange = (selected_asset: any) => {
        mergeState({selectAsset: ChainStore.getAsset(selected_asset)});
        checkBalance();
    };

    const onAmountChanged = ({amount, asset}: {amount: any; asset: any}) => {
        if (!asset) return;
        if (typeof asset !== "object") {
            asset = ChainStore.getAsset(asset);
        }
        const {info, selectAsset} = stateRef.current;
        if (asset && info && selectAsset) {
            const index = info.acceptable_collateral.findIndex(
                (v: any) => v[0] == selectAsset.get("id")
            );
            if (index < 0) return;
            const base = info.acceptable_collateral[index][1].base;
            const quote = info.acceptable_collateral[index][1].quote;
            const baseAsset = new Asset({
                asset_id: base.asset_id,
                amount: base.amount,
                precision: ChainStore.getAsset(base.asset_id).get(
                    "precision"
                )
            });
            const quoteAsset = new Asset({
                asset_id: quote.asset_id,
                amount: quote.amount,
                precision: ChainStore.getAsset(quote.asset_id).get(
                    "precision"
                )
            });

            const price = new Price({base: baseAsset, quote: quoteAsset});
            // let currentAmount = price.toReal() * mortgageAsset.getAmount();
            let mortgageAmount = parseFloat(amount) * price.toReal(true); // Keeping it consistent with the App, this may violate Graphene's price representation convention.
            if (Number.isNaN(mortgageAmount)) {
                mortgageAmount = 0;
            } else {
                mortgageAmount = Math.ceil(
                    mortgageAmount * 10 ** selectAsset.get("precision")
                );
            }
            const rateAsset = new Asset({
                asset_id: asset.get("id"),
                real: amount,
                precision: asset.get("precision")
            });
            const rate =
                parseFloat(String(rateAsset.getAmount())) /
                info.total_balance;
            const rateAmount =
                (parseFloat(info.fee_rate) / FEE_RATE_DENOM) *
                info.total_balance *
                rate;
            mergeState({
                amount,
                error: null,
                maxAmount: false,
                mortgageAmount: mortgageAmount,
                rateAmount
            });
            checkBalance();
        }
    };

    const setTotal = (asset: any) => {
        const {currentBalance} = stateRef.current;
        if (asset) {
            const balance = new Asset({
                amount: currentBalance,
                asset_id: asset.get("id"),
                precision: asset.get("precision")
            });
            mergeState({maxAmount: true});

            onAmountChanged({
                amount: balance.getAmount({real: true}),
                asset: asset.get("id")
            });
        }
    };

    const onFeeChanged = (fee: any) => {
        if (!fee) return;
        mergeState({
            feeAmount: fee,
            error: null
        });
        checkBalance();
    };

    const renderAcceptModal = () => {
        const {
            selectAsset,
            assetList,
            debtAsset,
            amount,
            currentBalance,
            balanceError,
            info,
            mortgageAmount,
            rateAmount
        } = state;
        // `feeAmount` isn't read here: the original's `onClick` bound two
        // extra args (`feeAmount.getAmount({real: true})`,
        // `feeAmount.asset_id`) that `_setTotal(asset)` never actually
        // accepted as parameters - always-inert extra arguments even in
        // the original, so `setTotal`'s call below simply doesn't pass
        // them through either.
        // Preserved verbatim: comma-operator bug in the original - only
        // `!debtAsset` is actually tested. See header comment. `void`
        // wraps the discarded left operand purely so `tsc` (TS2695:
        // "left side of comma operator is unused") accepts the same
        // comma expression - behaviorally identical to the original.
        if ((void selectAsset, !debtAsset)) return null;
        const account = ChainStore.getAccount(currentAccount);
        let balance = null;
        const minAssetAmount = new Asset({
            amount: info.min_deal_amount,
            asset_id: debtAsset.get("id"),
            precision: debtAsset.get("precision")
        });
        const maxAssetAmount = minAssetAmount.clone(currentBalance);
        const minError = amount < minAssetAmount.getAmount({real: true});
        const maxReal = maxAssetAmount.getAmount({real: true});
        const maxError = amount > maxReal || maxReal <= 0;
        const isSubmitNotValid =
            !amount ||
            minError ||
            maxError ||
            !selectAsset ||
            balanceError ||
            account.get("id") == info.owner_account;
        const _error = maxError ? "has-error" : "";
        if (currentBalance && currentBalance > 0) {
            balance = (
                <span>
                    <Translate
                        component="span"
                        content="credit_offer.current_balance"
                    />
                    :{" "}
                    <span
                        className={_error}
                        style={{
                            borderBottom: "#A09F9F 1px dotted",
                            cursor: "pointer"
                        }}
                        onClick={() => setTotal(debtAsset)}
                    >
                        <FormattedAsset
                            amount={currentBalance}
                            asset={debtAsset.get("id")}
                            trimZero
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

        const borrowingAsset = selectAsset.toJS();
        const borrowingAssetPermissions = assetUtils.getFlagBooleans(
            borrowingAsset.options.flags,
            !!borrowingAsset.bitasset_data_id
        );

        const issuer = ChainStore.getObject(
            borrowingAsset.issuer,
            false,
            false
        );
        const issuerName = issuer ? issuer.get("name") : "";

        const overrideAuthorityMessage = [
            counterpart.translate(
                "credit_offer.override_authority_warning_p1",
                {symbol: borrowingAsset.symbol}
            ),
            " ",
            <a
                key="issuer-link"
                target="_blank"
                href={`/account/${issuerName}`}
                rel="noreferrer"
            >
                {issuerName}
            </a>,
            <br key="break" />,
            counterpart.translate(
                "credit_offer.override_authority_warning_p2"
            ),
            " ",
            <a
                key="asset-link"
                target="_blank"
                href={`/asset/${borrowingAsset.symbol}`}
                rel="noreferrer"
            >
                {borrowingAsset.symbol}
            </a>
        ];

        return (
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={counterpart.translate("credit_offer.borrow")}
                visible={state.showModal}
                onCancel={hideAcceptModal}
                footer={[
                    // Preserved verbatim: `info.owner_account ===
                    // info.owner_account` is a tautology (always true) in
                    // the original. See header comment.
                    (info.owner_account === info.owner_account && (
                        <Translate
                            component="span"
                            content="credit_offer.info_borrow_err"
                        />
                    )) ||
                        null,
                    <Button
                        key={"send"}
                        disabled={isSubmitNotValid}
                        onClick={onSubmit}
                    >
                        <Translate content="wallet.submit" />
                    </Button>,
                    <Button key="Cancel" onClick={hideAcceptModal}>
                        <Translate content="wallet.cancel" />
                    </Button>
                ]}
            >
                {borrowingAssetPermissions.override_authority && (
                    <div style={{marginBottom: 12}}>
                        <Alert message={overrideAuthorityMessage}></Alert>
                    </div>
                )}
                <div className="grid-block vertical no-overflow">
                    <Form className="full-width" layout="vertical">
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.mortgage_assets"
                            )}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%"
                                }}
                            >
                                <AssetSelect
                                    selectStyle={{width: "100%"}}
                                    value={selectAsset.get("symbol")}
                                    assets={assetList}
                                    onChange={onAssetChange}
                                />
                            </div>
                        </Form.Item>
                        <AmountSelector
                            label="credit_offer.borrow_amount"
                            amount={amount}
                            asset={debtAsset.get("id")}
                            display_balance={balance}
                            onChange={onAmountChanged}
                            allowNaN={true}
                        />
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.repay_period"
                            )}
                            labelCol={{span: 8}}
                            wrapperCol={{span: 16}}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%"
                                }}
                            >
                                {parsingTime(
                                    info.max_duration_seconds,
                                    locale
                                )}
                            </div>
                        </Form.Item>
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.min_borrow"
                            )}
                            labelCol={{span: 8}}
                            wrapperCol={{span: 16}}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%",
                                    color: minError ? "red" : "#7ed321"
                                }}
                            >
                                <FormattedAsset
                                    amount={info.min_deal_amount}
                                    asset={info.asset_type}
                                    trimZero
                                />
                            </div>
                        </Form.Item>
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.mortgage_assets"
                            )}
                            labelCol={{span: 8}}
                            wrapperCol={{span: 16}}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%",
                                    color: balanceError ? "red" : "#7ed321"
                                }}
                            >
                                <FormattedAsset
                                    amount={mortgageAmount}
                                    asset={selectAsset.get("id")}
                                    trimZero
                                />
                            </div>
                        </Form.Item>
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.estimated_fee"
                            )}
                            labelCol={{span: 8}}
                            wrapperCol={{span: 16}}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%",
                                    color: "#7ed321"
                                }}
                            >
                                <span>
                                    <FormattedAsset
                                        amount={rateAmount}
                                        asset={debtAsset.get("id")}
                                        trimZero
                                    />
                                    {` (${(parseFloat(info.fee_rate) * 100) /
                                        FEE_RATE_DENOM}%)`}
                                </span>
                            </div>
                        </Form.Item>
                        <FeeAssetSelector
                            account={account}
                            transaction={{
                                type: "credit_offer_accept",
                                data: {
                                    type: "memo",
                                    content: null
                                }
                            }}
                            onChange={onFeeChanged}
                        />
                    </Form>
                </div>
            </Modal>
        );
    };

    const {filterValue} = state;
    const allListSorted = sortByAsset();
    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div
                    className="generic-bordered-box"
                    style={{margin: "20px"}}
                >
                    <div className="header-selector">
                        <div className="filter inline-block">
                            <SearchInput
                                value={filterValue}
                                placeholder={counterpart.translate(
                                    "credit_offer.plh_input_asset_name"
                                )}
                                onChange={handleFilterInput}
                            />
                        </div>
                    </div>
                </div>
                <div
                    className="generic-bordered-box"
                    style={{marginBottom: "40px"}}
                >
                    <div className="grid-wrapper">
                        <Table
                            rowKey="id"
                            columns={getColumns() as any}
                            dataSource={allListSorted}
                            pagination={{
                                hideOnSinglePage: true,
                                pageSize: 10
                            }}
                        />
                    </div>
                </div>
                {renderAcceptModal()}
            </div>
        </div>
    );
}

export default CreditOfferPage;
