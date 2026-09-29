// TypeScript/functional-component port of the legacy PoolStakeModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md), part of the same batch as
// PoolExchangeModal.tsx (both wrap a single required `pool:
// ChainTypes.ChainLiquidityPool.isRequired` chain prop and share the same
// `connect(BindToChainState(...), {listenTo: [AccountStore], getProps})`
// shape) - see that file's header for the shared Container/Core
// structure and async-pool-resolution recipe, replicated identically
// here.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// `liquidity_pool_deposit` transaction (via
// `ApplicationApi.liquidityPoolDeposit()`) when `currentTab === "stake"`,
// or a `liquidity_pool_withdraw` transaction (via
// `ApplicationApi.liquidityPoolWithdraw()`) when `currentTab ===
// "unstake"` - both of which (see `app/api/ApplicationApi.js`) build
// their operation and call `WalletDb.process_transaction()` -
// transcribed verbatim.
//
// Structural change: `connect(BindToChainState(PoolStakeModal), {
// listenTo: [AccountStore], getProps})` becomes
// `PoolStakeModalContainer`, reading `account` via
// `useAltStore(AccountStore)` and resolving `pool` via `await
// ChainStore.getLiquidityPoolsByShareAsset([pool])` under
// `useChainStoreTick()`, exactly as in `PoolExchangeModal.tsx` (see that
// file's header for the full reasoning behind the `[pool, tick]`
// dependency array and the `cancelled`-flag guard).
//
// Dropped as confirmed dead (grep-verified, not assumed):
// - `state.isModalVisible` and `UNSAFE_componentWillReceiveProps` (which
//   only ever re-synced it from the `isModalVisible` prop): every real
//   caller - `Poolmart/LiquidityPools.jsx`, `Explorer/LiquidityPools.tsx`,
//   `Account/AccountPools.tsx` - renders this component as
//   `{state.isStakeModalVisible && <PoolStakeModal
//   isModalVisible={state.isStakeModalVisible} .../>}`, i.e. conditionally
//   *mounts/unmounts* the whole component rather than updating an
//   already-mounted instance's `isModalVisible` prop - the same situation
//   already documented in `DeletePoolModal.tsx`/`PoolExchangeModal.tsx`.
//   This port reads the `isModalVisible` prop directly in `render()`
//   instead of mirroring it into state.
// - `getShareAssetCurrentSupply`'s two `console.log(...)` statements: each
//   immediately follows a `return` statement in the same block and is
//   therefore genuinely unreachable (not merely unused, and not the usual
//   "reachable pre-existing debug log" this migration otherwise
//   preserves verbatim - see the "Preserved verbatim" note below for
//   those).
//
// Every other method (`onChangeAssetAAmount`, `onChangeAssetBAmount`,
// `onChangeShareAssetAmount`) was checked the same variable-by-variable
// way `PoolExchangeModal.tsx`'s sibling methods were (grepping each local
// name's occurrences within its own function body) - unlike that file,
// every local variable in all three of these functions does feed at
// least one of their `setState` calls. No local dead code was found or
// removed in any of them.
//
// Preserved, not "fixed":
// - The `currentSupply !== undefined` guards in `onChangeAssetAAmount`
//   (via `getShareAssetCurrentSupply()`, which always returns a `Big`
//   instance, never `undefined`) and in `onChangeAssetAAmount`/
//   `onChangeShareAssetAmount`'s "stake" branches (via
//   `pool.getIn(["dynamic_share_asset", "current_supply"])`) are
//   tautologically always true in practice - a pre-existing always-true
//   condition, not a dead state/prop/method/import this migration's
//   dead-code policy targets, so it's kept as-is rather than simplified
//   away.
// - `onChangeAssetAAmount`'s `assetBAmount` calculation calls `Math.min`
//   with a single argument (so it's just that argument, unchanged) -
//   preserved verbatim, not "fixed" to pass a real second argument.
// - `onChangeAssetBAmount`'s trailing `console.log(assetAAmount,
//   precisionA, v.amount, precisionB);` and `onChangeShareAssetAmount`'s
//   three debug `console.log`s in its `else` branch are reachable code
//   and are kept verbatim, per this migration's established practice of
//   preserving pre-existing debug logs (see `DeletePoolModal.tsx`).
// - `assetAErr`/`assetBErr`/`shareAssetErr` are read in `render()`
//   (`validateStatus`/`help` on each `AmountSelector`) but grep-confirmed
//   to never be set to anything but `{msg: null, status: null}` anywhere
//   in the file - kept as real, permanently-inert state, matching this
//   migration's established treatment of read-but-never-toggled fields
//   (see `PoolExchangeModal.tsx`'s `state.fee`, and `ReportModal.tsx`'s
//   `loadingImage`/`logsCopySuccess`).
//
// Mechanical-only changes: the constructor's `.bind(this)` calls have no
// hooks equivalent/need and are dropped - ordinary closures inside a
// function component don't need binding. `mergeState`/`state` replace
// `this.setState`/`this.state`; no `stateRef` mirror is needed, since
// every function below is redefined fresh on each render and therefore
// always closes over that render's current `state`, the same guarantee
// `this.state` gave the original class.
//
// TS-forced casts: same as `PoolExchangeModal.tsx` - every `new big(...)`
// (bignumber.js, untyped, not in `app/types/vendor-shims.d.ts`) becomes
// `new (big as any)(...)`, matching `AccountAssetCreate.tsx`'s
// precedent, and `ApplicationApi.liquidityPoolDeposit`/
// `liquidityPoolWithdraw` are cast `(ApplicationApi as any)`, matching
// `CreateLockModal.tsx`'s `(ApplicationApi as any).createTicket`
// precedent.
import * as React from "react";
import Translate from "react-translate-component";
import big from "bignumber.js";
import counterpart from "counterpart";
import {Form, Modal, Button, Row, Col, Tabs} from "bitshares-ui-style-guide";
import ApplicationApi from "api/ApplicationApi";
import AccountStore from "stores/AccountStore";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import Icon from "../Icon/Icon";
import AccountBalance from "../Account/AccountBalance";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface PoolStakeModalErr {
    msg: any;
    status: any;
}

interface PoolStakeModalState {
    assetAAmount: any;
    assetBAmount: any;
    shareAssetAmount: any;
    assetAErr: PoolStakeModalErr;
    assetBErr: PoolStakeModalErr;
    shareAssetErr: PoolStakeModalErr;
    currentTab: string;
}

interface PoolStakeModalCoreProps {
    pool: any;
    account: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolStakeModalCore({
    pool,
    account,
    isModalVisible,
    onHideModal
}: PoolStakeModalCoreProps) {
    const [state, setState] = React.useState<PoolStakeModalState>({
        assetAAmount: null,
        assetBAmount: null,
        shareAssetAmount: null,
        assetAErr: {
            msg: null,
            status: null
        },
        assetBErr: {
            msg: null,
            status: null
        },
        shareAssetErr: {
            msg: null,
            status: null
        },
        currentTab: "stake"
    });

    const mergeState = (patch: Partial<PoolStakeModalState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const hideModal = () => {
        onHideModal();
    };

    const onSubmit = () => {
        const {
            assetAAmount,
            assetBAmount,
            shareAssetAmount,
            currentTab
        } = state;

        const assetAPrecision = new (big as any)(10).toPower(
            new (big as any)(pool.getIn(["asset_a", "precision"]))
        );

        const assetBPrecision = new (big as any)(10).toPower(
            new (big as any)(pool.getIn(["asset_b", "precision"]))
        );

        const sharedAssetPrecision = new (big as any)(10).toPower(
            pool.getIn(["share_asset", "precision"])
        );

        if (currentTab === "stake") {
            (ApplicationApi as any)
                .liquidityPoolDeposit(
                    account,
                    pool.get("id"),
                    pool.getIn(["asset_a", "symbol"]),
                    pool.getIn(["asset_b", "symbol"]),
                    Math.floor(Number(assetAAmount) * Number(assetAPrecision)),
                    Math.floor(Number(assetBAmount) * Number(assetBPrecision))
                )
                .then((res: any) => {
                    console.log("exchange:", res);
                    hideModal();
                })
                .catch((e: any) => {
                    console.error("exchange:", e);
                });
        } else if (currentTab === "unstake") {
            (ApplicationApi as any)
                .liquidityPoolWithdraw(
                    account,
                    pool.get("id"),
                    pool.getIn(["share_asset", "symbol"]),
                    Math.floor(
                        Number(shareAssetAmount) * Number(sharedAssetPrecision)
                    )
                )
                .then((res: any) => {
                    console.log("exchange:", res);
                    hideModal();
                })
                .catch((e: any) => {
                    console.error("exchange:", e);
                });
        }
    };

    const onTabChange = (tabVal: string) => {
        mergeState({
            currentTab: tabVal
        });
        resetErr();
    };

    const resetErr = () => {
        mergeState({
            assetAAmount: null,
            assetBAmount: null,
            shareAssetAmount: null,
            assetAErr: {
                msg: null,
                status: null
            },
            assetBErr: {
                msg: null,
                status: null
            },
            shareAssetErr: {
                msg: null,
                status: null
            }
        });
    };

    const getShareAssetCurrentSupply = () => {
        const shareAsset = pool.get("share_asset");
        const precision = shareAsset.get("precision");

        const accountObj = (ChainStore as any).getAccount(account);

        const balances = accountObj.getIn(["balances", shareAsset.get("id")]);

        if (balances) {
            const balObj = (ChainStore as any).getObject(balances);
            const balance = balObj.get("balance");
            return new (big as any)(balance).dividedBy(
                new (big as any)(10).toPower(precision)
            );
        }

        return new (big as any)(0);
    };

    const getBalanceA = () => {
        const assetA = pool.get("asset_a");

        const precision = assetA.get("precision");

        const accountObj = (ChainStore as any).getAccount(account);

        const balances = accountObj.getIn(["balances", assetA.get("id")]);

        if (balances) {
            const balObj = (ChainStore as any).getObject(balances);
            return new (big as any)(balObj.get("balance")).dividedBy(
                new (big as any)(10).toPower(precision)
            );
        }

        return new (big as any)(0);
    };

    const getBalanceB = () => {
        const assetB = pool.get("asset_b");

        const precision = assetB.get("precision");

        const accountObj = (ChainStore as any).getAccount(account);

        const balances = accountObj.getIn(["balances", assetB.get("id")]);

        if (balances) {
            const balObj = (ChainStore as any).getObject(balances);
            return new (big as any)(balObj.get("balance")).dividedBy(
                new (big as any)(10).toPower(precision)
            );
        }

        return new (big as any)(0);
    };

    const onChangeAssetAAmount = (v: any) => {
        const {currentTab} = state;
        const currentSupply = getShareAssetCurrentSupply();
        if (currentSupply !== undefined) {
            mergeState({
                assetAAmount: v.amount
            });
        }
        if (currentTab === "stake") {
            const {assetBAmount} = state;

            const assetA = pool.get("asset_a");

            const precisionA = assetA.get("precision");

            const assetB = pool.get("asset_b");

            const precisionB = assetB.get("precision");

            const shareAssetPP = pool.get("share_asset");
            const precisionPP = shareAssetPP.get("precision");
            const poolamounta = pool.get("balance_a");
            const poolamountap = new (big as any)(10).toPower(
                pool.get("asset_a").get("precision")
            );
            const poolamountb = pool.get("balance_b");
            const poolamountbp = new (big as any)(10).toPower(
                pool.get("asset_b").get("precision")
            );

            const poolsupply =
                Number(pool.getIn(["dynamic_share_asset", "current_supply"])) /
                Number(new (big as any)(10).toPower(precisionPP));

            if (Number(v.amount) > 0 && poolamounta > 0) {
                mergeState({
                    assetBAmount: Math.min(
                        (Number(v.amount) *
                            (Number(poolamountb) / Number(poolamountbp))) /
                            (Number(poolamounta) / Number(poolamountap))
                    ),
                    shareAssetAmount: Math.min(
                        (Number(poolsupply) *
                            Number(v.amount) *
                            Number(new (big as any)(10).toPower(precisionA))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP)),
                        (Number(poolsupply) *
                            assetBAmount *
                            Number(new (big as any)(10).toPower(precisionB))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP))
                    )
                });
            }
            if (!v.amount) {
                mergeState({
                    assetBAmount: 0
                });
            }

            if (v.amount > 0 && assetBAmount > 0) {
                mergeState({
                    shareAssetAmount: Math.min(
                        (Number(poolsupply) *
                            Number(v.amount) *
                            Number(new (big as any)(10).toPower(precisionA))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP)),
                        (Number(poolsupply) *
                            assetBAmount *
                            Number(new (big as any)(10).toPower(precisionB))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP))
                    )
                });
            }
        }
    };

    const onChangeAssetBAmount = (v: any) => {
        const {currentTab} = state;
        const currentSupply = pool.getIn([
            "dynamic_share_asset",
            "current_supply"
        ]);
        if (currentSupply !== undefined) {
            mergeState({
                assetBAmount: v.amount
            });
        }

        if (currentTab === "stake") {
            const {assetAAmount} = state;

            const assetA = pool.get("asset_a");

            const precisionA = assetA.get("precision");

            const assetB = pool.get("asset_b");

            const precisionB = assetB.get("precision");
            const shareAssetPP = pool.get("share_asset");
            const precisionPP = shareAssetPP.get("precision");
            const poolamounta = pool.get("balance_a");
            const poolamountap = new (big as any)(10).toPower(
                pool.get("asset_a").get("precision")
            );
            const poolamountb = pool.get("balance_b");
            const poolamountbp = new (big as any)(10).toPower(
                pool.get("asset_b").get("precision")
            );

            const poolsupply =
                Number(pool.getIn(["dynamic_share_asset", "current_supply"])) /
                Number(new (big as any)(10).toPower(precisionPP));
            if (Number(v.amount) > 0 && poolamountb > 0) {
                mergeState({
                    assetAAmount: Math.min(
                        (Number(v.amount) *
                            (Number(poolamounta) / Number(poolamountap))) /
                            (Number(poolamountb) / Number(poolamountbp))
                    ),
                    shareAssetAmount: Math.min(
                        (Number(poolsupply) *
                            Number(v.amount) *
                            Number(new (big as any)(10).toPower(precisionB))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP)),
                        (Number(poolsupply) *
                            assetAAmount *
                            Number(new (big as any)(10).toPower(precisionA))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP))
                    )
                });
            }
            if (!v.amount) {
                mergeState({
                    assetAAmount: 0
                });
            }

            if (v.amount > 0 && assetAAmount > 0) {
                mergeState({
                    shareAssetAmount: Math.min(
                        (Number(poolsupply) *
                            Number(v.amount) *
                            Number(new (big as any)(10).toPower(precisionB))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP)),
                        (Number(poolsupply) *
                            assetAAmount *
                            Number(new (big as any)(10).toPower(precisionA))) /
                            (Number(poolamounta) /
                                Number(new (big as any)(10).toPower(precisionA))) /
                            Number(new (big as any)(10).toPower(precisionPP))
                    )
                });
                console.log(assetAAmount, precisionA, v.amount, precisionB);
            }
        }
    };

    const onChangeShareAssetAmount = (v: any) => {
        const {currentTab} = state;
        const currentSupply = pool.getIn([
            "dynamic_share_asset",
            "current_supply"
        ]);
        if (currentTab === "stake") {
            if (currentSupply !== undefined) {
                mergeState({
                    shareAssetAmount: v.amount
                });
            }
        } else if (currentTab === "unstake") {
            if (currentSupply !== undefined) {
                mergeState({
                    shareAssetAmount: v.amount
                });
            }
            const bigSharedAssets = getShareAssetCurrentSupply();
            const bigAssetA = getBalanceA();
            const bigAssetB = getBalanceB();

            let amountA = bigAssetA.toNumber();
            let amountB = bigAssetB.toNumber();

            const withDrawalPercentFee = pool.get("withdrawal_fee_percent") / 100;
            const poolamounta = pool.get("balance_a");
            const poolamountap = new (big as any)(10).toPower(
                pool.get("asset_a").get("precision")
            );
            const poolamountb = pool.get("balance_b");
            const poolamountbp = new (big as any)(10).toPower(
                pool.get("asset_b").get("precision")
            );
            const shareAssetPP = pool.get("share_asset");
            const precisionPP = shareAssetPP.get("precision");

            const poolsupply =
                Number(pool.getIn(["dynamic_share_asset", "current_supply"])) /
                Number(new (big as any)(10).toPower(precisionPP));

            if (bigSharedAssets.toNumber() == 0) {
                amountA = 0;
                amountB = 0;
            } else {
                amountA =
                    ((Number(poolamounta) / Number(poolamountap)) *
                        Number(v.amount)) /
                        Number(poolsupply) -
                    (((Number(poolamounta) / Number(poolamountap)) *
                        Number(v.amount)) /
                        Number(poolsupply)) *
                        Number(withDrawalPercentFee / 100);
                amountB =
                    ((Number(poolamountb) / Number(poolamountbp)) *
                        Number(v.amount)) /
                        Number(poolsupply) -
                    (((Number(poolamountb) / Number(poolamountbp)) *
                        Number(v.amount)) /
                        Number(poolsupply)) *
                        Number(withDrawalPercentFee / 100);

                console.log(
                    "PoolS:",
                    poolsupply,
                    "AmountA:",
                    Number(poolamounta) / Number(poolamountap),
                    "AmountB:",
                    Number(poolamountb) / Number(poolamountbp),
                    Number(bigSharedAssets.toNumber())
                );
                console.log(
                    ((Number(poolamounta) / Number(poolamountap)) *
                        Number(v.amount)) /
                        Number(bigSharedAssets.toNumber()),
                    Number(withDrawalPercentFee)
                );
                console.log(
                    ((Number(poolamountb) / Number(poolamountbp)) *
                        Number(v.amount)) /
                        Number(bigSharedAssets.toNumber()),
                    Number(withDrawalPercentFee)
                );
            }

            mergeState({
                assetAAmount: amountA,
                assetBAmount: amountB
            });
        }
    };

    const {TabPane} = Tabs as any;
    const {
        assetAAmount,
        assetBAmount,
        shareAssetAmount,
        assetAErr,
        assetBErr,
        shareAssetErr,
        currentTab
    } = state;
    const assetA = pool.get("asset_a");
    const assetB = pool.get("asset_b");
    const shareAsset = pool.get("share_asset");
    return (
        <Modal
            visible={isModalVisible}
            id="pool_stake_modal"
            overlay={true}
            onCancel={hideModal}
            footer={[
                <Button
                    key={"send"}
                    disabled={!account}
                    onClick={account ? onSubmit : undefined}
                >
                    {counterpart.translate("wallet.submit")}
                </Button>,
                <Button
                    key={"Cancel"}
                    onClick={hideModal}
                    style={{marginLeft: "20px"}}
                >
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            <Tabs defaultActiveKey={currentTab} onChange={onTabChange}>
                <TabPane
                    tab={counterpart.translate(
                        "poolmart.liquidity_pools.stake"
                    )}
                    key="stake"
                >
                    <Form>
                        <Row>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.asset_a"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[assetA.get("symbol")]}
                                    asset={assetA.get("symbol")}
                                    validateStatus={assetAErr.status}
                                    help={assetAErr.msg}
                                    amount={assetAAmount}
                                    onChange={onChangeAssetAAmount}
                                />
                                {account && (
                                    <div style={{textAlign: "right"}}>
                                        <span>
                                            {counterpart.translate(
                                                "transfer.available"
                                            )}
                                            :{" "}
                                        </span>
                                        <a
                                            onClick={e => {
                                                e.preventDefault();
                                                console.log(
                                                    "poolstakeModal: "
                                                );

                                                onChangeAssetAAmount({
                                                    amount: getBalanceA().toNumber(),
                                                    asset: null
                                                });
                                            }}
                                        >
                                            <AccountBalance
                                                account={account}
                                                asset={assetA.get("symbol")}
                                            />
                                        </a>
                                    </div>
                                )}
                            </Col>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.asset_b"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[assetB.get("symbol")]}
                                    asset={assetB.get("symbol")}
                                    validateStatus={assetBErr.status}
                                    help={assetBErr.msg}
                                    amount={assetBAmount}
                                    onChange={onChangeAssetBAmount}
                                />
                                {account && (
                                    <div
                                        style={{textAlign: "right"}}
                                    >
                                        <span>
                                            {counterpart.translate(
                                                "transfer.available"
                                            )}
                                            :{" "}
                                        </span>
                                        <a
                                            onClick={e => {
                                                e.preventDefault();

                                                onChangeAssetBAmount({
                                                    amount: getBalanceB().toNumber(),
                                                    asset: null
                                                });
                                            }}
                                        >
                                            <AccountBalance
                                                account={account}
                                                asset={assetB.get("symbol")}
                                            />
                                        </a>
                                    </div>
                                )}
                            </Col>
                            <Col
                                span={24}
                                className="mt-16"
                                style={{textAlign: "center"}}
                            >
                                <Icon name="arrow-down-1" size="2x" />
                            </Col>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.share_asset"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[shareAsset.get("symbol")]}
                                    asset={shareAsset.get("symbol")}
                                    validateStatus={shareAssetErr.status}
                                    help={shareAssetErr.msg}
                                    amount={shareAssetAmount}
                                />
                            </Col>
                        </Row>
                    </Form>
                </TabPane>
                <TabPane
                    tab={counterpart.translate(
                        "poolmart.liquidity_pools.unstake"
                    )}
                    key="unstake"
                >
                    <Form>
                        <Row>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.share_asset"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[shareAsset.get("symbol")]}
                                    asset={shareAsset.get("symbol")}
                                    validateStatus={shareAssetErr.status}
                                    help={shareAssetErr.msg}
                                    amount={shareAssetAmount}
                                    onChange={onChangeShareAssetAmount}
                                />
                                {account && (
                                    <div style={{textAlign: "right"}}>
                                        <span>
                                            {counterpart.translate(
                                                "transfer.available"
                                            )}
                                            :{" "}
                                        </span>
                                        <a
                                            onClick={e => {
                                                e.preventDefault();
                                                const precision = pool
                                                    .get("share_asset")
                                                    .get("precision");

                                                const accountObj = (ChainStore as any).getAccount(
                                                    account
                                                );

                                                const balances = accountObj.getIn(
                                                    [
                                                        "balances",
                                                        shareAsset.get("id")
                                                    ]
                                                );
                                                let amount = new (big as any)(0);
                                                if (balances) {
                                                    const balObj = (ChainStore as any).getObject(
                                                        balances
                                                    );
                                                    const balance = balObj.get(
                                                        "balance"
                                                    );
                                                    amount = new (big as any)(
                                                        balance
                                                    ).dividedBy(
                                                        new (big as any)(10).toPower(
                                                            precision
                                                        )
                                                    );
                                                }

                                                onChangeShareAssetAmount({
                                                    amount: amount.toNumber(),
                                                    asset: null
                                                });
                                            }}
                                        >
                                            <AccountBalance
                                                account={account}
                                                asset={shareAsset.get(
                                                    "symbol"
                                                )}
                                            />
                                        </a>
                                    </div>
                                )}
                            </Col>
                            <Col
                                span={24}
                                className="mt-16"
                                style={{textAlign: "center"}}
                            >
                                <Icon name="arrow-down-1" size="2x" />
                            </Col>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.asset_a"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[assetA.get("symbol")]}
                                    asset={assetA.get("symbol")}
                                    validateStatus={assetAErr.status}
                                    help={assetAErr.msg}
                                    amount={assetAAmount}
                                />
                            </Col>
                            <Col span={24} className="mt-16">
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.asset_b"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[assetB.get("symbol")]}
                                    asset={assetB.get("symbol")}
                                    validateStatus={assetBErr.status}
                                    help={assetBErr.msg}
                                    amount={assetBAmount}
                                />
                            </Col>
                        </Row>
                    </Form>
                </TabPane>
            </Tabs>
        </Modal>
    );
}

interface PoolStakeModalContainerProps {
    pool: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolStakeModalContainer({
    pool,
    isModalVisible,
    onHideModal
}: PoolStakeModalContainerProps) {
    const accountState = useAltStore<any>(AccountStore);
    const tick = useChainStoreTick();
    const [resolvedPool, setResolvedPool] = React.useState<any>(undefined);

    React.useEffect(() => {
        let cancelled = false;
        if (pool) {
            (ChainStore as any)
                .getLiquidityPoolsByShareAsset([pool])
                .then((pools: any) => {
                    if (cancelled) return;
                    setResolvedPool(pools.size > 0 ? pools.first() : null);
                });
        } else {
            setResolvedPool(null);
        }
        return () => {
            cancelled = true;
        };
    }, [pool, tick]);

    if (resolvedPool === undefined) {
        return <span />;
    }

    return (
        <PoolStakeModalCore
            pool={resolvedPool}
            account={accountState.currentAccount}
            isModalVisible={isModalVisible}
            onHideModal={onHideModal}
        />
    );
}

export default PoolStakeModalContainer;
