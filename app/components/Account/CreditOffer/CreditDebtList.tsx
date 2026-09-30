// TypeScript/functional-component port of the legacy CreditDebtList.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Account/CreditOffer/` batch).
// Mechanical class-to-hooks translation, no logic changes.
//
// Security-sensitive per AGENTS.md: this component dispatches
// `CreditOfferActions.repay(data)` (in `onSubmit`, below) and
// `CreditOfferActions.getCreditDealsByBorrower(...)` (mount-only read, in
// the mount `useEffect`). Both calls, their argument construction, and the
// surrounding `Asset`/fee-rate math are preserved exactly as in the
// original - no rounding/precision logic was touched. Neither this file
// nor its callback paths touch `WalletDb`/wallet-unlock/key-import flows
// or any password/private-key/brainkey material (grepped); the
// `console.error(err)` in the `repay` `.catch()` just logs the caught
// error object, matching the original, and is kept as-is (not the "never
// log passwords" exception case). The commented-out
// `// console.log("data: ", data);` inside `showRepayModal` is an
// already-inert comment in the original - left as an inert comment here
// too, not uncommented or deleted.
//
// Structural change (not a behavior change): the original's
// `connect(CreditDebtList, {listenTo: [AccountStore, CreditOfferStore],
// getProps})` alt-react HOC is replaced by `useAltStore(AccountStore)` +
// `useAltStore(CreditOfferStore)` calls inside the component body, per
// this migration's established `useAltStore` pattern. Per alt-react's
// `connect` semantics (`<Component {...this.props} {...this.getNextProps()}
// />` - store-derived props always win over same-named caller-passed
// props, see `AccountPortfolioList.tsx`'s header comment for the
// original worked example), `currentAccount`/`passwordAccount`/
// `dealsByBorrower` are always taken from the stores here, matching the
// original exactly - the sole caller (`CreditOfferAccountPage.jsx`) never
// passes those props anyway, only `account`.
//
// The class's several `this.state.X` fields are kept as one combined
// state object (not split into separate `useState` calls), updated via a
// `mergeState` shallow-merge helper, to preserve the original's atomic
// multi-field `this.setState({a, b, c})` updates exactly (some call sites
// also pass a second `this.setState(update, callback)` argument - a
// callback fired after the state update commits; replicated here by
// calling `checkBalance()` right after each such `mergeState` call, same
// as `FeeAssetSelector.tsx`'s precedent for translating that pattern -
// safe here too since none of these callbacks read anything from the
// freshly-rendered DOM, only from state/refs).
//
// A `stateRef` mirror (`stateRef.current = state` every render) lets
// `setTotal`/`checkBalance`/`onSubmit` read the CURRENT state without
// needing every field as a `useCallback` dependency, matching this
// component's original methods reading `this.state` directly (always
// current, since class methods aren't memoized against stale closures the
// way a naively-written hook callback would be).
//
// No `shouldComponentUpdate`, `componentDidUpdate`,
// `UNSAFE_componentWillReceiveProps`/`UNSAFE_componentWillMount`, or
// imperative string refs exist in the original (verified by reading the
// whole file) - only `componentDidMount`, translated to a mount-only
// `useEffect(() => {...}, [])`.
//
// Preserved verbatim, not "fixed": `_renderTotalAmount`/`_renderFeeRate`'s
// `else` branches build a `<span>...</span>` JSX expression but never
// `return` it - a pre-existing dead-code bug (the function implicitly
// returns `undefined` when `asset` is falsy, rendering nothing) -
// transcribed exactly as `renderTotalAmount`/`renderFeeRate` here.
// `_renderRepayModal`'s `isSubmitNotValid` destructures `asset` from
// state (never explicitly set via `mergeState({asset: ...})` under that
// key name - the amount-changed handler actually sets it via the local
// `asset` var alongside `amount`, so it IS the same state field) -
// preserved as-is, no renaming.
//
// TypeScript props: `account`/`currentAccount`/`passwordAccount`/
// `dealsByBorrower` were read but not declared in a `propTypes` block (the
// original declares none at all) - added to the new `CreditDebtListProps`
// interface as real fields, matching this migration's established
// convention for undeclared-but-read props. All chain-object/Asset/store
// values are typed `any` (Immutable.Map-backed chain objects and the
// `Asset`/`Price` helper classes from `lib/common/MarketClasses` have no
// existing TS types in this codebase), consistent with every other port
// in this migration touching the same objects (e.g. `FeeAssetSelector.tsx`).
import * as React from "react";
import counterpart from "counterpart";
import utils from "common/utils";
import AccountStore from "../../../stores/AccountStore";
import CreditOfferStore from "../../../stores/CreditOfferStore";
import {
    Tooltip,
    Modal,
    Button,
    Form,
    Table,
    Icon as AntIcon
} from "bitshares-ui-style-guide";
import CreditOfferActions, {
    FEE_RATE_DENOM
} from "../../../actions/CreditOfferActions";
import LinkToAccountById from "../../Utility/LinkToAccountById";
import FormattedAsset from "../../Utility/FormattedAsset";
import moment from "moment";
import Translate from "react-translate-component";
import AmountSelector from "../../Utility/AmountSelectorStyleGuide";
import FeeAssetSelector from "../../Utility/FeeAssetSelector";
import {checkBalance as checkBalanceHasFunds} from "common/trxHelper";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../../next/hooks/useAltStore";

import {Asset} from "../../../lib/common/MarketClasses";
import BalanceComponent from "../../Utility/BalanceComponent";

const getUninitializedFeeAmount = () =>
    new Asset({amount: 0, asset_id: "1.3.0"});

interface CreditDebtListProps {
    account: any;

    // store-derived (see header comment: always win over same-named
    // caller-passed props, though no caller currently passes these)
    currentAccount?: any;
    passwordAccount?: any;
    dealsByBorrower?: any;
}

interface CreditDebtListState {
    dealId: any;
    showModal: boolean;
    debtAsset: any;
    debtAmount: any;
    amount: any;
    feeAmount: any;
    maxAmount: boolean;
    balanceError: boolean;
    collateralAmount: any;
    collateralAsset: any;
    feeRate: any;
    asset?: any;
    error?: any;
}

function CreditDebtList(props: CreditDebtListProps) {
    const accountState = useAltStore<any>(AccountStore);
    const creditOfferState = useAltStore<any>(CreditOfferStore);

    const currentAccount = accountState.currentAccount;
    // `passwordAccount` was read from `AccountStore` in the original's
    // `getProps()` but never referenced anywhere in the class body either
    // - not read here for the same reason (would be an unused-variable
    // lint error), kept documented in `CreditDebtListProps` only.
    const dealsByBorrower = creditOfferState.dealsByBorrower;

    const {account} = props;

    const [state, setState] = React.useState<CreditDebtListState>({
        dealId: null,
        showModal: false,
        debtAsset: null,
        debtAmount: null,
        amount: null,
        feeAmount: getUninitializedFeeAmount(),
        maxAmount: false,
        balanceError: false,
        collateralAmount: 0,
        collateralAsset: null,
        feeRate: null
    });

    const mergeState = (patch: Partial<CreditDebtListState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    React.useEffect(() => {
        CreditOfferActions.getCreditDealsByBorrower({
            name_or_id: account.get("id"),
            flag: "first"
        });
    }, []);

    const checkBalance = () => {
        const {feeAmount, amount, debtAsset} = stateRef.current;
        if (!debtAsset || !account) return;
        const balanceID = account.getIn(["balances", debtAsset]);
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
        if (!amount) {
            mergeState({balanceError: false});
            return;
        }
        const asset = ChainStore.getAsset(debtAsset);
        const hasBalance = checkBalanceHasFunds(
            amount,
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

        mergeState({
            amount,
            asset,
            error: null,
            maxAmount: false
        });
        checkBalance();
    };

    const setTotal = (asset_id: any, balance_id: any) => {
        const {feeAmount, debtAmount} = stateRef.current;
        const balanceObject = ChainStore.getObject(balance_id);
        const transferAsset = ChainStore.getObject(asset_id);

        if (balanceObject) {
            const balance = new Asset({
                amount: balanceObject.get("balance"),
                asset_id: transferAsset.get("id"),
                precision: transferAsset.get("precision")
            });
            if (feeAmount.asset_id === balance.asset_id) {
                balance.minus(feeAmount);
            }
            const amount =
                balance.getAmount() > debtAmount
                    ? new Asset({
                          amount: debtAmount,
                          asset_id,
                          precision: transferAsset.get("precision")
                      })
                    : balance;
            mergeState({
                maxAmount: true,
                amount: amount.getAmount({real: true})
            });
            checkBalance();
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

    const hideRepayModal = () => {
        mergeState({showModal: false});
    };

    const showRepayModal = (data: any) => {
        // console.log("data: ", data);
        mergeState({
            showModal: true,
            debtAmount: data.debt_amount,
            debtAsset: data.debt_asset,
            collateralAmount: data.collateral_amount,
            collateralAsset: data.collateral_asset,
            feeRate: data.fee_rate,
            dealId: data.id
        });
    };

    const onSubmit = () => {
        const {
            feeRate,
            amount,
            asset,
            dealId,
            feeAmount
        } = stateRef.current;
        const cAsset = new Asset({
            asset_id: asset.get("id"),
            real: amount,
            precision: asset.get("precision")
        });
        const cAmount = cAsset.getAmount();
        const cfAmount = Math.floor(
            (parseInt(feeRate, 10) * cAmount + FEE_RATE_DENOM - 1) /
                FEE_RATE_DENOM
        );

        const data = {
            account,
            deal_id: dealId,
            repay_amount: new Asset({
                amount: cAmount,
                asset_id: cAsset.asset_id,
                precision: asset.get("precision")
            }),
            credit_fee: new Asset({
                amount: cfAmount,
                asset_id: cAsset.asset_id,
                precision: asset.get("precision")
            }),
            fee_asset: feeAmount
        };
        CreditOfferActions.repay(data)
            .then(() => {
                hideRepayModal();
            })
            .catch((err: any) => {
                // todo: visualize error somewhere
                console.error(err);
            });
    };

    const renderCollateral = () => {
        const {
            debtAmount,
            collateralAmount,
            collateralAsset,
            asset,
            amount
        } = state;
        if (asset) {
            const cAsset = new Asset({
                asset_id: asset.get("id"),
                real: amount,
                precision: asset.get("precision")
            });
            let currentAmount = 0;
            if (cAsset.getAmount() > debtAmount) {
                currentAmount = collateralAmount;
            } else if (amount <= 0) {
                currentAmount = 0;
            } else {
                currentAmount = parseInt(
                    String(
                        (parseFloat(String(cAsset.getAmount())) /
                            parseFloat(debtAmount)) *
                            collateralAmount
                    )
                );
            }
            return (
                <FormattedAsset
                    amount={currentAmount}
                    asset={collateralAsset}
                    trimZero
                />
            );
        } else {
            return (
                <FormattedAsset amount={0} asset={collateralAsset} trimZero />
            );
        }
    };

    const renderTotalAmount = () => {
        const {feeRate, debtAsset, debtAmount, amount, asset} = state;
        const fRate = parseFloat(feeRate) / FEE_RATE_DENOM;
        if (asset) {
            const cAsset = new Asset({
                asset_id: asset.get("id"),
                real: amount,
                precision: asset.get("precision")
            });
            const rate = parseFloat(String(cAsset.getAmount())) / debtAmount;
            const cAmount = fRate * debtAmount * rate;
            const realFee =
                cAmount / utils.get_asset_precision(asset.get("precision"));
            const realRepay = cAsset.getAmount({real: true});
            const realTotal = realFee + realRepay;
            return (
                <span>
                    <FormattedAsset
                        exact_amount={true}
                        amount={realTotal}
                        asset={debtAsset}
                        trimZero
                    />
                </span>
            );
        } else {
            // Preserved verbatim: the original built this JSX but never
            // returned it, so this branch implicitly returns `undefined`.
            <span>
                <FormattedAsset amount={0} asset={debtAsset} trimZero />{" "}
            </span>;
        }
    };

    const renderFeeRate = () => {
        const {feeRate, debtAsset, debtAmount, amount, asset} = state;
        const fRate = parseFloat(feeRate) / FEE_RATE_DENOM;
        if (asset) {
            const cAsset = new Asset({
                asset_id: asset.get("id"),
                real: amount,
                precision: asset.get("precision")
            });
            const rate = parseFloat(String(cAsset.getAmount())) / debtAmount;
            const cAmount = fRate * debtAmount * rate;
            return (
                <span>
                    <FormattedAsset
                        amount={cAmount}
                        asset={debtAsset}
                        trimZero
                    />{" "}
                    {`(${fRate * 100}%)`}
                </span>
            );
        } else {
            // Preserved verbatim: same missing-`return` quirk as above.
            <span>
                <FormattedAsset amount={0} asset={debtAsset} trimZero />{" "}
                {`(${fRate * 100}%)`}
            </span>;
        }
    };

    const renderRepayModal = () => {
        const {
            debtAmount,
            debtAsset,
            amount,
            balanceError,
            asset
        } = state;
        // `feeAmount` isn't read here: the original's `onClick` bound two
        // extra args (`feeAmount.getAmount({real: true})`,
        // `feeAmount.asset_id`) that `_setTotal(asset_id, balance_id)`
        // never actually accepted as parameters - always-inert extra
        // arguments even in the original, so `setTotal`'s call below
        // simply doesn't pass them through either.
        let balance = null;
        const isSubmitNotValid = !amount || !asset || balanceError;
        if (account && account.get("balances")) {
            const account_balances = account.get("balances").toJS();
            const _error = balanceError ? "has-error" : "";
            if (account_balances[debtAsset]) {
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
                                    debtAsset,
                                    account_balances[debtAsset]
                                )
                            }
                        >
                            <BalanceComponent
                                balance={account_balances[debtAsset]}
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
        }
        return (
            <Modal
                wrapClassName="modal--transaction-confirm"
                title={counterpart.translate("credit_offer.repay")}
                visible={state.showModal}
                id="modal-repay"
                overlay={true}
                onCancel={hideRepayModal}
                footer={[
                    <Button
                        key={"send"}
                        disabled={isSubmitNotValid}
                        onClick={onSubmit}
                    >
                        <Translate content="wallet.submit" />
                    </Button>,
                    <Button key="Cancel" onClick={hideRepayModal}>
                        <Translate content="wallet.cancel" />
                    </Button>
                ]}
            >
                <div className="grid-block vertical no-overflow">
                    <Form className="full-width" layout="vertical">
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.my_debt"
                            )}
                            labelCol={{span: 8}}
                            wrapperCol={{span: 16}}
                            colon={false}
                        >
                            <div
                                style={{
                                    textAlign: "right",
                                    width: "100%",
                                    color: "#e3745b"
                                }}
                            >
                                <FormattedAsset
                                    amount={debtAmount}
                                    asset={debtAsset}
                                    trimZero
                                />
                            </div>
                        </Form.Item>
                        <AmountSelector
                            label="transfer.amount"
                            amount={amount}
                            asset={debtAsset}
                            display_balance={balance}
                            onChange={onAmountChanged}
                            allowNaN={true}
                        />
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.redemption_collateral"
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
                                {renderCollateral()}
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
                                {renderFeeRate()}
                            </div>
                        </Form.Item>
                        <Form.Item
                            label={counterpart.translate(
                                "credit_offer.total_to_repay"
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
                                {renderTotalAmount()}
                            </div>
                        </Form.Item>
                        <FeeAssetSelector
                            account={account}
                            transaction={{type: "credit_deal_repay"}}
                            onChange={onFeeChanged}
                        />
                    </Form>
                </div>
            </Modal>
        );
    };

    const getColumns = () => {
        const header: any[] = [
            {
                title: "ID",
                dataIndex: "id"
            },
            {
                title: counterpart.translate(
                    "credit_offer.credit_right_account"
                ),
                dataIndex: "offer_owner",
                render: (account: any) => (
                    <LinkToAccountById account={account} />
                )
            },
            {
                title: counterpart.translate("credit_offer.debt"),
                align: "right",
                dataIndex: "debt_asset",
                render: (text: any, row: any) => (
                    <FormattedAsset
                        asset={text}
                        amount={row.debt_amount}
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.fee_rate"),
                align: "right",
                render: (text: any, row: any) => (
                    <FormattedAsset
                        asset={row.debt_asset}
                        amount={
                            (parseFloat(row.fee_rate) / FEE_RATE_DENOM) *
                            row.debt_amount
                        }
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.mortgage_assets"),
                align: "right",
                render: (text: any, row: any) => (
                    <FormattedAsset
                        asset={row.collateral_asset}
                        amount={row.collateral_amount}
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.repay_period"),
                dataIndex: "latest_repay_time",
                render: (time: any) =>
                    moment
                        .utc(time)
                        .local()
                        .format("YYYY-MM-DD HH:mm:ss")
            }
        ];
        if (account.get("name") == currentAccount) {
            header.push({
                title: counterpart.translate("credit_offer.repay"),
                render: (_: any, row: any) => (
                    <span style={{fontSize: 20}}>
                        <Tooltip
                            title={counterpart.translate("credit_offer.repay")}
                        >
                            <AntIcon
                                type="dollar"
                                style={{cursor: "pointer"}}
                                onClick={() => {
                                    showRepayModal(row);
                                }}
                            />
                        </Tooltip>
                    </span>
                )
            });
        }
        return header;
    };

    return (
        <div className="grid-content no-overflow no-padding">
            <div className="generic-bordered-box">
                <div className="grid-wrapper">
                    <Table
                        rowKey="id"
                        columns={getColumns()}
                        dataSource={dealsByBorrower}
                        pagination={{
                            hideOnSinglePage: true,
                            pageSize: 10
                        }}
                    />
                    {renderRepayModal()}
                </div>
            </div>
        </div>
    );
}

export default CreditDebtList;
