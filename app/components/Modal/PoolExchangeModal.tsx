// TypeScript/functional-component port of the legacy PoolExchangeModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md), part of the same batch as
// PoolStakeModal.tsx (both wrap a single required `pool:
// ChainTypes.ChainLiquidityPool.isRequired` chain prop and share the same
// `connect(BindToChainState(...), {listenTo: [AccountStore], getProps})`
// shape).
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// `liquidity_pool_exchange` transaction via
// `ApplicationApi.liquidityPoolExchange()`, which (see
// `app/api/ApplicationApi.js`) builds the operation and calls
// `WalletDb.process_transaction()` - transcribed verbatim.
//
// Structural change: `connect(BindToChainState(PoolExchangeModal), {
// listenTo: [AccountStore], getProps})` becomes a single
// `PoolExchangeModalContainer` that (a) reads `account` via
// `useAltStore(AccountStore)` (see `useAltStore.ts`) and (b) resolves
// `pool` the way `BindToChainState.jsx`'s `chain_liquidity_pools` block
// does - `await ChainStore.getLiquidityPoolsByShareAsset([pool])`, taking
// `pools.first()` if any were returned, else `null` - the one
// asynchronous ChainTypes resolution in this codebase (every other
// ChainTypes.* resolution is a synchronous cache read). The effect's
// dependency array is `[pool, tick]` (`tick` from `useChainStoreTick()`)
// so the fetch re-runs both when the `pool` id prop changes AND on every
// chain-store tick, matching the original's continuous per-update
// re-resolution (`Wrapper.update()` runs from both
// `ChainStore.subscribe` and `UNSAFE_componentWillReceiveProps`), not
// just a prop-change trigger. The `cancelled` flag is a defensive
// addition against a stale response landing after a newer request
// started; it changes nothing observable here, since the original's
// `await` ran synchronously per class-instance update cycle in the same
// single-threaded execution model. While `resolvedPool === undefined`
// (still resolving), the Container renders a blank `<span />`, matching
// `BindToChainState.jsx`'s `render()` gating (only `undefined` blocks; a
// resolved `null` renders through) for a required prop with no
// `tempComponent`/`show_loader` configured (neither applies to this
// file).
//
// Dropped as confirmed dead (grep-verified, not assumed):
// - The `Immutable` import: appears only on its own `import` line,
//   nowhere else in the file.
// - `state.isModalVisible` and `componentWillReceiveProps` (which only
//   ever re-synced it from the `isModalVisible` prop): every real caller
//   - `Poolmart/LiquidityPools.jsx`, `Explorer/LiquidityPools.tsx`,
//   `Account/AccountPools.tsx` - renders this component as
//   `{state.isExchangeModalVisible && <PoolExchangeModal
//   isModalVisible={state.isExchangeModalVisible} .../>}`, i.e.
//   conditionally *mounts/unmounts* the whole component rather than
//   updating an already-mounted instance's `isModalVisible` prop - the
//   exact same situation already documented in `DeletePoolModal.tsx`.
//   `isModalVisible` is therefore always `true` for this component's
//   entire mounted lifetime, so this port reads the `isModalVisible`
//   prop directly in `render()` instead of mirroring it into state.
// - `switchAsset`'s entire tail (everything after its one `setState`
//   call - the `ChainStore.getAccount` lookup, the asset/balance
//   computation, and the `{amountToSell, minToReceive}` object it
//   built): `switchAsset` is used only as `<Button
//   onClick={this.switchAsset}>`, whose return value React discards, so
//   nothing ever reads what that tail computed. (`getPairs()`, which has
//   the identical body, is kept - it's actually called for its return
//   value, both in `render()` and in the two "use available balance"
//   click handlers.)
// - In `onChangeAmountToSell`/`onChangeMinToReceive`: the `account` prop
//   destructure and the `accountObj = ChainStore.getAccount(account)`
//   lookup it fed - never read afterward in either function (the
//   equivalent lookup already happens live in `getPairs()`, called on
//   every render, so dropping this redundant one changes nothing
//   observable); and the shadowing `const {amountToSellTag,
//   minToReceiveTag} = this.state;` destructure placed right after the
//   reset `setState` in both functions - every later reference in both
//   functions uses the earlier `tmp1`/`tmp2` locals instead, never these
//   two names.
// - Within `onChangeAmountToSell`'s AMM fee-percentage math, traced
//   variable-by-variable to see what actually reaches the final
//   `setState({amountToSell, minToReceive})`: `maker_fee_a`,
//   `maker_fee_b`, `taker_fee_percenta`, the `flagsb()` helper (only fed
//   `tmp_delta_a`), `taker_market_fee_percenta()`/
//   `taker_market_fee_percent_a` (only used for the never-referenced-
//   again `tmp_delta_a`/`tmp_a` chain), `tmp_delta_a`, `tmp_a`, and
//   `tmp_delta_b_floor`/`tmp_b_ceil`/`max_mar`/`tmp_b_taker_ceil`/`total`
//   (all of which only fed `total`, which is itself never read again) -
//   none of these reach the `setState` call. The kept half (`flagsa()`,
//   `taker_market_fee_percentb()`, `tmp_delta_b`, `tmp_b`,
//   `taker_market_fee_percent_b`, `max_market_feeb`, `poolamountbp`) is
//   exactly what the final `setState` computes from, preserved verbatim,
//   including a pre-existing bug: `flagsa()` has no final `else` branch
//   (only three `if`s, all guarded), so it can return `undefined` when
//   none match, and `Number(undefined)` (`NaN`) then silently propagates
//   into `tmp_delta_b`.
// - `onChangeMinToReceive` is more extreme: its final `setState` is just
//   `{minToReceive: Number(e.amount)}` - tracing every one of the ~150
//   lines of AMM math between its two `setState` calls shows NONE of it
//   (not `tmp1`/`tmp2`, not `asset_a`/`asset_b`, not any of the
//   `maker_`/`taker_`/`flags`/`tmp_delta_`/`tmp_` values) is read by that
//   final call or anywhere else in the function - it is entirely dead
//   computation with no side effects (pure `Immutable.Map`/`Big` reads
//   and arithmetic). This port keeps only the two `setState` calls that
//   are the function's sole observable effect.
//
// Preserved, not "fixed": `state.fee` is read in `render()`
// (`{this.state.fee && (...)}`) but is grep-confirmed to never be set to
// anything but `null` anywhere in the file - so that block never
// actually renders. Kept as real (permanently-`null`) state, matching
// this migration's established treatment of read-but-never-toggled
// fields (see `ReportModal.tsx`'s `loadingImage`/`logsCopySuccess`, also
// cited in `DirectDebitClaimModal.tsx`).
//
// Mechanical-only changes: the redundant constructor `.bind(this)` calls
// (plus the separate `onSubmit = () => {...}` class-property idiom they
// partly duplicate) have no hooks equivalent/need and are dropped -
// ordinary closures inside a function component don't need binding.
// `mergeState`/`state` replace `this.setState`/`this.state` per this
// migration's established pattern; no `stateRef` mirror is needed here,
// since every function below is redefined fresh on each render and
// therefore always closes over that render's current `state` (the same
// guarantee `this.state` gave the original class).
//
// TS-forced casts: `bignumber.js` ships no type declarations and isn't
// among the ambient `declare module` shims in
// `app/types/vendor-shims.d.ts`, so every `new big(...)` becomes `new
// (big as any)(...)`, matching the established precedent in
// `AccountAssetCreate.tsx`. `ApplicationApi.liquidityPoolExchange` is
// likewise cast `(ApplicationApi as any)`, matching
// `CreateLockModal.tsx`'s `(ApplicationApi as any).createTicket`
// precedent (this file's untyped `.js` module's inferred call signature
// otherwise doesn't line up with how it's actually invoked here).
import * as React from "react";
import Translate from "react-translate-component";
import big from "bignumber.js";
import counterpart from "counterpart";
import {Form} from "../../design-system/Form";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";
import {Alert} from "../../design-system/Alert";
import ApplicationApi from "api/ApplicationApi";
import AccountStore from "stores/AccountStore";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import Icon from "../Icon/Icon";
import AccountBalance from "../Account/AccountBalance";
import AssetName from "../Utility/AssetName";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface PoolExchangeModalState {
    amountToSellTag: string;
    minToReceiveTag: string;
    amountToSell: any;
    minToReceive: any;
    fee: any;
    err: any;
}

interface PoolExchangeModalCoreProps {
    pool: any;
    account: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolExchangeModalCore({
    pool,
    account,
    isModalVisible,
    onHideModal
}: PoolExchangeModalCoreProps) {
    const [state, setState] = React.useState<PoolExchangeModalState>({
        amountToSellTag: "a",
        minToReceiveTag: "b",
        amountToSell: null,
        minToReceive: null,
        fee: null,
        err: null
    });

    const mergeState = (patch: Partial<PoolExchangeModalState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const hideModal = () => {
        onHideModal();
    };

    const onSubmit = () => {
        const {
            amountToSellTag,
            minToReceiveTag,
            amountToSell,
            minToReceive
        } = state;
        if (!amountToSell || !minToReceive) {
            mergeState({
                err: counterpart.translate("exchange.no_data")
            });
            return;
        }
        mergeState({
            err: null
        });
        const amountToSellPrecision = new (big as any)(10).toPower(
            new (big as any)(pool.getIn([`asset_${amountToSellTag}`, "precision"]))
        );
        const minToReceivePrecision = new (big as any)(10).toPower(
            new (big as any)(pool.getIn([`asset_${minToReceiveTag}`, "precision"]))
        );

        (ApplicationApi as any)
            .liquidityPoolExchange(
                account,
                pool.get("id"),
                pool.getIn([`asset_${amountToSellTag}`, "symbol"]),
                Math.round(parseFloat(amountToSell) * amountToSellPrecision),
                pool.getIn([`asset_${minToReceiveTag}`, "symbol"]),
                Math.round(parseFloat(minToReceive) * minToReceivePrecision)
            )
            .then(() => {
                console.log("exchange:");
                hideModal();
            })
            .catch((e: any) => {
                console.error("exchange:", e);
            });
    };

    const switchAsset = () => {
        const tmp1 = state.amountToSellTag;
        const tmp2 = state.minToReceiveTag;
        mergeState({
            amountToSellTag: tmp2,
            minToReceiveTag: tmp1,
            amountToSell: null,
            minToReceive: null,
            fee: null
        });
    };

    const getPairs = () => {
        const {amountToSellTag, minToReceiveTag} = state;
        const accountObj = (ChainStore as any).getAccount(account);

        const asset_a = pool.get(`asset_${amountToSellTag}`);
        const asset_b = pool.get(`asset_${minToReceiveTag}`);
        const precision_a = asset_a.get("precision");
        const precision_b = asset_b.get("precision");

        const balances_a = accountObj.getIn(["balances", asset_a.get("id")]);
        const balances_b = accountObj.getIn(["balances", asset_b.get("id")]);

        let balance_a = new (big as any)(0);
        let balance_b = new (big as any)(0);

        if (balances_a) {
            const balObj_A = (ChainStore as any).getObject(balances_a);
            balance_a = new (big as any)(balObj_A.get("balance")).dividedBy(
                new (big as any)(10).toPower(precision_a)
            );
        }

        if (balances_b) {
            const balObj_B = (ChainStore as any).getObject(balances_b);
            balance_b = new (big as any)(balObj_B.get("balance")).dividedBy(
                new (big as any)(10).toPower(precision_b)
            );
        }

        if (pool === null || pool === undefined) return null;
        return {
            amountToSell: {
                id: pool.getIn([`asset_${amountToSellTag}`, "id"]),
                balance: balance_a,
                name: pool.getIn([`asset_${amountToSellTag}`, "symbol"]),
                precision: precision_a
            },
            minToReceive: {
                id: pool.getIn([`asset_${minToReceiveTag}`, "id"]),
                balance: balance_b,
                name: pool.getIn([`asset_${minToReceiveTag}`, "symbol"]),
                precision: precision_b
            }
        };
    };

    const onChangeAmountToSell = (e: any) => {
        const tmp1 = state.amountToSellTag;
        const tmp2 = state.minToReceiveTag;
        mergeState({
            amountToSellTag: tmp1,
            minToReceiveTag: tmp2,
            amountToSell: null,
            minToReceive: null,
            fee: null
        });

        const asset_a = pool.get(`asset_${tmp1}`);
        const asset_b = pool.get(`asset_${tmp2}`);

        const poolamounta = Number(pool.get(`balance_${tmp1}`));
        const poolamountap = Number(
            new (big as any)(10).toPower(pool.get(`asset_${tmp1}`).get("precision"))
        );
        const poolamountb = Number(pool.get(`balance_${tmp2}`));
        const poolamountbp = Number(
            new (big as any)(10).toPower(pool.get(`asset_${tmp2}`).get("precision"))
        );

        const maker_market_fee_percenta = asset_a.getIn([
            "options",
            "market_fee_percent"
        ]);
        const maker_market_fee_percentb = asset_b.getIn([
            "options",
            "market_fee_percent"
        ]);

        const assetaflags = asset_a.getIn(["options", "flags"]);
        const assetbflags = asset_b.getIn(["options", "flags"]);

        const max_market_feea = asset_a.getIn(["options", "max_market_fee"]);
        const max_market_feeb = asset_b.getIn(["options", "max_market_fee"]);

        const taker_fee_percentb = asset_b.getIn([
            "options",
            "extensions",
            "taker_fee_percent"
        ]);

        function flagsa() {
            if (assetaflags % 2 == 0) {
                return 0;
            }
            if (maker_market_fee_percenta === 0) {
                return 0;
            }
            if (maker_market_fee_percenta > 0) {
                return Math.min(
                    Number(max_market_feea),
                    Math.ceil(
                        Number(e.amount) *
                            Number(poolamountap) *
                            (Number(maker_market_fee_percenta) / 10000)
                    )
                );
            }
        }

        function taker_market_fee_percentb() {
            if (assetbflags % 2 == 0) {
                return 0;
            }
            if (
                typeof taker_fee_percentb == "undefined" &&
                maker_market_fee_percentb > 0
            ) {
                return Number(maker_market_fee_percentb) / 10000;
            }
            if (
                typeof taker_fee_percentb == "undefined" &&
                maker_market_fee_percentb === 0
            ) {
                return 0;
            } else {
                return Number(taker_fee_percentb) / 10000;
            }
        }

        const tmp_delta_b =
            Number(poolamountb) -
            Math.ceil(
                (Number(poolamountb) * Number(poolamounta)) /
                    (Number(poolamounta) +
                        (Number(e.amount) * Number(poolamountap) -
                            Number(flagsa())))
            );

        const tmp_b =
            (Number(tmp_delta_b) * Number(pool.get("taker_fee_percent"))) /
            10000;

        const taker_market_fee_percent_b = Number(taker_market_fee_percentb());

        mergeState({
            amountToSell: Number(e.amount),
            minToReceive:
                (Number(tmp_delta_b) -
                    Math.floor(Number(tmp_b)) -
                    Math.ceil(
                        Math.min(
                            Number(max_market_feeb),
                            Math.ceil(
                                Math.ceil(
                                    Number(tmp_delta_b) *
                                        Number(taker_market_fee_percent_b)
                                )
                            )
                        )
                    )) /
                Number(poolamountbp)
        });
    };

    const onChangeMinToReceive = (e: any) => {
        mergeState({
            minToReceive: null,
            fee: null
        });

        mergeState({
            minToReceive: Number(e.amount)
        });
    };

    if (!pool || pool.size === 0) return null;
    const {amountToSell, minToReceive} = state;
    const pairs = getPairs();

    return (
        <Modal
            visible={isModalVisible}
            onCancel={hideModal}
            footer={[
                <Button
                    key={"submit"}
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
            {pool.get("virtual_value") > 0 && (
                <Form>
                    {pairs !== null && (
                        <Row className="mt-10 mb-10">
                            <Col span={24}>
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.amount_to_sell"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[pairs.amountToSell.name]}
                                    asset={pairs.amountToSell.name}
                                    onChange={onChangeAmountToSell}
                                    amount={amountToSell}
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
                                                const pairs = getPairs();

                                                onChangeAmountToSell({
                                                    amount: pairs!.amountToSell.balance.toNumber(),
                                                    asset: null
                                                });
                                            }}
                                        >
                                            <AccountBalance
                                                account={account}
                                                asset={
                                                    pairs.amountToSell.name
                                                }
                                            />
                                        </a>
                                    </div>
                                )}
                            </Col>
                            <Col
                                span={24}
                                className="mt-10 mb-10"
                                style={{textAlign: "center"}}
                            >
                                <Button onClick={switchAsset}>
                                    <Icon
                                        name="arrow-up-down"
                                        size="1_5x"
                                    />
                                </Button>
                            </Col>
                            <Col span={24}>
                                <h4>
                                    {counterpart.translate(
                                        "poolmart.liquidity_pools.min_to_receive"
                                    )}
                                </h4>
                                <AmountSelector
                                    assets={[pairs.minToReceive.name]}
                                    asset={pairs.minToReceive.name}
                                    amount={minToReceive}
                                    onChange={onChangeMinToReceive}
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
                                                const pairs = getPairs();
                                                onChangeMinToReceive({
                                                    amount: pairs!.minToReceive.balance.toNumber(),
                                                    asset: null
                                                });
                                            }}
                                        >
                                            <AccountBalance
                                                account={account}
                                                asset={
                                                    pairs.minToReceive.name
                                                }
                                            />
                                        </a>
                                    </div>
                                )}
                            </Col>
                            {state.fee && (
                                <Col span={24} style={{textAlign: "right"}}>
                                    <span>
                                        {counterpart.translate(
                                            "poolmart.liquidity_pools.taker_fee_percent"
                                        )}
                                        :{" "}
                                    </span>
                                    {`${state.fee} `}
                                    <AssetName
                                        noTip
                                        name={pairs.minToReceive.name}
                                    />
                                </Col>
                            )}
                            {state.err && (
                                <Col span={24} className="mt-10 mb-10">
                                    <Alert
                                        message={state.err}
                                        type="error"
                                    />
                                </Col>
                            )}
                        </Row>
                    )}
                </Form>
            )}
            {pool.get("virtual_value") == 0 && (
                <div>
                    <Row>
                        <Col span={24}>
                            {counterpart.translate(
                                "poolmart.liquidity_pools.need_stake_first"
                            )}
                        </Col>
                    </Row>
                </div>
            )}
        </Modal>
    );
}

interface PoolExchangeModalContainerProps {
    pool: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolExchangeModalContainer({
    pool,
    isModalVisible,
    onHideModal
}: PoolExchangeModalContainerProps) {
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
        <PoolExchangeModalCore
            pool={resolvedPool}
            account={accountState.currentAccount}
            isModalVisible={isModalVisible}
            onHideModal={onHideModal}
        />
    );
}

export default PoolExchangeModalContainer;
