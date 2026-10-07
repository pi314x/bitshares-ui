// TypeScript/functional-component port of the legacy CreateMarketModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `createAsset` builds and submits the
// on-chain `AssetActions.createAsset(...)` call that creates the new
// prediction-market asset - argument order/values transcribed verbatim
// (`accountId, marketOptions, flags, permissions, core_exchange_rate,
// IS_BITASSET, true, bitasset_opts, description`), including the
// `_getPermissionsAndFlags`/flag-boolean computation feeding it. Nothing
// sensitive is logged: the pre-existing `console.log(...)` in the
// `.then()` handler only prints the account id and the same asset
// parameters already visible in the form (no keys/passwords/brainkeys
// anywhere in this file), kept as-is.
//
// `class CreateMarketModal extends Modal` extended antd's `Modal` class
// component directly - `bitshares-ui-style-guide`'s `Modal` export is a
// bare re-export of `antd`'s `Modal` (verified via
// `node_modules/bitshares-ui-style-guide/app/bitshares-ui-style-guide
// /Modal/index.js`: `export default Modal` from `"antd"`). Reading antd's
// own `Modal.js` confirms it defines no lifecycle method besides
// `render()` (its constructor only binds a few click handlers this file
// never references, and its static `propTypes`/`defaultProps` are fully
// shadowed by this subclass's own static assignments). Since this file's
// `render()` unconditionally overrides antd's, `extends Modal` here is
// behaviorally identical to `extends React.Component` - ported as a
// plain function component that renders `<Modal>` as a child element,
// matching every other Modal-rendering file in this migration
// (`SettleModal.tsx`, `BorrowModal.tsx`, `DirectDebitModal.tsx`).
//
// `PropTypes` replaced by the `CreateMarketModalProps` interface below.
// The one real caller (`PredictionMarkets.jsx`, out of scope for this
// batch) always passes `currentAccount` (`this.props.currentAccount.get
// ("id")`, a string) and `symbols` (an array); neither was marked
// `.isRequired` in the original `propTypes` even though the code uses
// both without a null guard (`symbols.includes(...)`,
// `ChainStore.getAccount(currentAccount)`) - kept optional in the
// interface to match the original's actual (unguarded) prop types, with
// an `as any` cast where TS would otherwise refuse the possibly-
// undefined access, preserving the original's latent-crash-if-omitted
// behavior rather than adding a defensive check that wasn't there.
//
// No `componentDidMount`/`componentDidUpdate`/`shouldComponentUpdate` in
// the original. State is plain `useState` plus a `mergeState` helper; no
// `stateRef` mirror is needed since every handler below is only ever
// invoked from a freshly-rendered closure in direct response to user
// interaction (typing, a button click), so it always sees state as of
// the latest render - same reasoning already used for `SettleModal.tsx`
// (no `stateRef` there either).
//
// Preserved verbatim, not "fixed" - a real bug in the original: `onSubmit`
// called `this._createAsset().call(this)`, i.e. it *invoked*
// `_createAsset()` first (dispatching the actual `AssetActions
// .createAsset(...)` call synchronously, exactly as intended), and only
// *then* tried to call `.call(this)` on whatever `_createAsset()`
// returned. `_createAsset()` has no `return` statement, so this is always
// `undefined.call(this)`, which throws `TypeError: Cannot read
// properties of undefined (reading 'call')` immediately afterwards. The
// throw has no other user-visible effect: the asset-creation request has
// already been dispatched by that point, and a synchronous throw from a
// React onClick handler just stops there (logged by the browser as an
// uncaught error) - it doesn't crash the rendered tree or block the
// in-flight request. TypeScript can't compile a literal `.call()` on the
// `void` return of `createAsset()` ("Property 'call' does not exist on
// type 'void'"), so it's reproduced via an explicit `as any` cast on the
// call expression - preserving the exact same runtime throw. There's no
// class instance/`this` in a function component, so `undefined` is
// passed as the call context; it's never actually read, since the throw
// happens on the `.call` property access itself, before its argument
// would matter.
//
// TS-forced casts: `handleChange`'s dynamic `marketOptions[event.target
// .name] = ...` / `marketOptions.description[event.target.name] = ...`
// writes (the field name comes from the DOM event, not a literal) need
// `as any` on the indexed object - TypeScript can't otherwise verify an
// arbitrary string indexes `MarketOptions`/`MarketOptionsDescription`. No
// behavior change.
import * as React from "react";
import {Modal} from "../../design-system/Modal";
import {Input} from "../../design-system/Input";
import {Form} from "../../design-system/Form";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import {Icon} from "../../design-system/Icon";
import {DatePicker} from "../../design-system/DatePicker";
import Translate from "react-translate-component";
import AssetSelect from "../Utility/AssetSelect";
import counterpart from "counterpart";
import AssetActions from "actions/AssetActions";
import assetUtils from "common/asset_utils";
import assetConstants from "chain/asset_constants";
import {ChainStore} from "bitsharesjs";
import moment from "moment";

const IS_BITASSET = true;

interface MarketOptionsDescription {
    main: any;
    condition?: any;
    expiry?: any;
}

interface MarketOptions {
    precision: any;
    max_supply: number;
    max_market_fee: number;
    market_fee_percent: any;
    description: MarketOptionsDescription;
    reward_percent: number;
    taker_fee_percent: number;
    symbol: string;
}

interface CoreExchangeRate {
    quote: {asset_id: any; amount: number};
    base: {asset_id: any; amount: number};
}

interface BitassetOpts {
    feed_lifetime_sec: number;
    minimum_feeds: number;
    force_settlement_delay_sec: number;
    force_settlement_offset_percent: number;
    maximum_force_settlement_volume: number;
    short_backing_asset: any;
}

interface CreateMarketModalState {
    marketOptions: MarketOptions;
    showWarning: boolean;
    wrongSymbol: boolean;
    wrongDate: boolean;
    core_exchange_rate: CoreExchangeRate;
    bitasset_opts: BitassetOpts;
    inProgress: boolean;
}

interface CreateMarketModalProps {
    visible?: boolean;
    onClose?: () => void;
    currentAccount?: string;
    symbols?: string[];
    onMarketCreated?: (symbol: string) => void;
}

function CreateMarketModal({
    visible = false,
    onClose,
    currentAccount,
    symbols,
    onMarketCreated
}: CreateMarketModalProps) {
    const getInitialState = (): CreateMarketModalState => ({
        marketOptions: {
            precision: "5",
            max_supply: 100000,
            max_market_fee: 0,
            market_fee_percent: 0,
            description: {main: ""},
            reward_percent: 0,
            taker_fee_percent: 0,
            symbol: ""
        },
        showWarning: false,
        wrongSymbol: false,
        wrongDate: false,
        core_exchange_rate: {
            quote: {
                asset_id: null,
                amount: 1
            },
            base: {
                asset_id: "1.3.0",
                amount: 1
            }
        },
        bitasset_opts: {
            feed_lifetime_sec: 60 * 60 * 24,
            minimum_feeds: 7,
            force_settlement_delay_sec: 60 * 60 * 24,
            force_settlement_offset_percent:
                1 * (assetConstants as any).GRAPHENE_1_PERCENT,
            maximum_force_settlement_volume:
                20 * (assetConstants as any).GRAPHENE_1_PERCENT,
            short_backing_asset: "1.3.0"
        },
        inProgress: false
    });

    const [state, setState] = React.useState<CreateMarketModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<CreateMarketModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const getPermissionsAndFlags = () => {
        const flagBooleans = (assetUtils as any).getFlagBooleans(
            0,
            IS_BITASSET
        );
        const permissionBooleans = (assetUtils as any).getFlagBooleans(
            "all",
            IS_BITASSET
        );

        flagBooleans["charge_market_fee"] = true;
        const flags = (assetUtils as any).getFlags(flagBooleans, IS_BITASSET);
        return {
            flags,
            permissions: (assetUtils as any).getPermissions(
                permissionBooleans,
                IS_BITASSET
            )
        };
    };

    const createAsset = (): void => {
        const {marketOptions, core_exchange_rate, bitasset_opts} = state;

        const {permissions, flags} = getPermissionsAndFlags();
        const description = JSON.stringify(state.marketOptions.description);

        mergeState({inProgress: true});
        const accountId = (ChainStore as any)
            .getAccount(currentAccount)
            .get("id");
        (AssetActions as any)
            .createAsset(
                accountId,
                marketOptions,
                flags,
                permissions,
                core_exchange_rate,
                IS_BITASSET,
                true,
                bitasset_opts,
                description
            )
            .then(() => {
                mergeState({inProgress: false});
                console.log(
                    "... AssetActions.createAsset(account_id, update)",
                    accountId,
                    marketOptions,
                    flags,
                    permissions
                );
                (onMarketCreated as any)(marketOptions.symbol);
            })
            .catch((error: any) => {
                console.error(error);
                mergeState({inProgress: false});
            });
    };

    const handleChange = (event: any) => {
        const marketOptions = state.marketOptions;
        if (event instanceof (moment as any)) {
            event.set("milliseconds", 0);
            event = {
                target: {
                    name: "expiry",
                    value: event.toISOString()
                }
            };
        }
        switch (event.target.name) {
            case "symbol":
                (marketOptions as any)[event.target.name] = event.target.value.toUpperCase();
                break;
            case "main":
            case "condition":
            case "expiry":
                (marketOptions.description as any)[event.target.name] =
                    event.target.value;
                break;
            default:
                (marketOptions as any)[event.target.name] = event.target.value;
                break;
        }
        mergeState({marketOptions});
    };

    const handleAssetChange = (asset: any) => {
        if (asset) {
            const newBitassetOpts = state.bitasset_opts;
            const newMarketOptions = state.marketOptions;
            const newCoreExchangeRate = state.core_exchange_rate;
            newBitassetOpts.short_backing_asset = asset;
            newMarketOptions.precision = (ChainStore as any)
                .getAsset(asset)
                .get("precision");
            newCoreExchangeRate.base.asset_id = asset;
            mergeState({
                bitasset_opts: newBitassetOpts,
                core_exchange_rate: newCoreExchangeRate,
                marketOptions: newMarketOptions
            });
        }
    };

    const forcePositive = (number: any) => {
        return parseFloat(number) < 0 ? "0" : number;
    };

    const handleFeeChange = (event: any) => {
        console.log(event);

        const newMarketOptions = state.marketOptions;
        newMarketOptions.market_fee_percent = forcePositive(
            event.target.value
        );

        mergeState({
            marketOptions: newMarketOptions
        });
    };

    const isFormValid = (): boolean => {
        if ((symbols as any).includes(state.marketOptions.symbol)) {
            mergeState({wrongSymbol: true});
            return false;
        } else {
            mergeState({wrongSymbol: false});
        }

        const now = new Date();
        const expiry = new Date(state.marketOptions.description.expiry);
        if (now > expiry) {
            mergeState({wrongDate: true});
            return false;
        } else {
            mergeState({wrongDate: false});
        }

        return !!(
            state.marketOptions.symbol &&
            state.marketOptions.description.main &&
            state.marketOptions.description.condition &&
            state.marketOptions.description.expiry
        );
    };

    const onSubmit = (e?: any) => {
        if (isFormValid()) {
            if (e) {
                e.preventDefault();
            }
            (createAsset() as any).call(undefined);
        } else {
            mergeState({showWarning: true});
        }
    };

    const {showWarning, marketOptions, wrongSymbol, wrongDate} = state;

    const footer = [
        <Button
            variant="accent"
            key="submit"
            onClick={onSubmit}
            disabled={state.inProgress}
        >
            {counterpart.translate("global.confirm")}
        </Button>,
        <Button key="cancel" onClick={onClose} disabled={state.inProgress}>
            {counterpart.translate("global.cancel")}
        </Button>
    ];

    return (
        <Modal
            title={<Translate content="prediction.create_market_modal.title" />}
            visible={visible}
            onCancel={onClose}
            closable={!state.inProgress}
            footer={footer}
        >
            <div className="prediction-markets--create-prediction-market">
                <Form className="full-width" layout="vertical">
                    <Form.Item>
                        <span
                            className={
                                (!marketOptions.symbol && showWarning) ||
                                wrongSymbol
                                    ? "has-error"
                                    : ""
                            }
                        >
                            <label className="left-label">
                                <Tooltip
                                    title={counterpart.translate(
                                        "prediction.create_market_modal.tooltip_symbol"
                                    )}
                                    placement="topLeft"
                                >
                                    <Translate content="prediction.create_market_modal.symbol" />
                                    <Icon
                                        style={{
                                            marginLeft: "0.5rem"
                                        }}
                                        theme="filled"
                                        type="question-circle"
                                    />
                                </Tooltip>
                                <Input
                                    name="symbol"
                                    type="text"
                                    onChange={handleChange}
                                    tabIndex={1}
                                    value={state.marketOptions.symbol}
                                />
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item>
                        <span
                            className={
                                !marketOptions.description.condition &&
                                showWarning
                                    ? "has-error"
                                    : ""
                            }
                        >
                            <label className="left-label">
                                <Tooltip
                                    title={counterpart.translate(
                                        "prediction.create_market_modal.tooltip_condition"
                                    )}
                                    placement="topLeft"
                                >
                                    <Translate content="prediction.create_market_modal.condition" />
                                    <Icon
                                        style={{
                                            marginLeft: "0.5rem"
                                        }}
                                        theme="filled"
                                        type="question-circle"
                                    />
                                </Tooltip>
                                <Input
                                    name="condition"
                                    type="text"
                                    onChange={handleChange}
                                    tabIndex={2}
                                />
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item>
                        <span
                            className={
                                !marketOptions.description.main && showWarning
                                    ? "has-error"
                                    : ""
                            }
                        >
                            <label className="left-label">
                                <Tooltip
                                    title={counterpart.translate(
                                        "prediction.create_market_modal.tooltip_description"
                                    )}
                                    placement="topLeft"
                                >
                                    <Translate content="prediction.create_market_modal.description" />
                                    <Icon
                                        style={{
                                            marginLeft: "0.5rem"
                                        }}
                                        theme="filled"
                                        type="question-circle"
                                    />
                                </Tooltip>
                                <Input.TextArea
                                    name="main"
                                    onChange={handleChange}
                                    tabIndex={3}
                                />
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item>
                        <span
                            className={
                                (!marketOptions.description.expiry &&
                                    showWarning) ||
                                wrongDate
                                    ? "has-error"
                                    : ""
                            }
                        >
                            <label className="left-label">
                                <Tooltip
                                    title={counterpart.translate(
                                        "prediction.create_market_modal.tooltip_resolution_date"
                                    )}
                                    placement="topLeft"
                                >
                                    <Translate content="prediction.create_market_modal.resolution_date" />
                                    <Icon
                                        style={{
                                            marginLeft: "0.5rem"
                                        }}
                                        theme="filled"
                                        type="question-circle"
                                    />
                                </Tooltip>
                                <div>
                                    {/* `name="expiry"` dropped: confirmed
                                    dead - `handleChange`'s `instanceof
                                    moment` branch hardcodes `name:
                                    "expiry"` itself, never reads the
                                    DOM attribute. */}
                                    <DatePicker
                                        style={{
                                            width: "100%"
                                        }}
                                        showTime
                                        placeholder={counterpart.translate(
                                            "prediction.create_market_modal.select_date_and_time"
                                        )}
                                        onChange={handleChange}
                                        onOk={handleChange}
                                        tabIndex={4}
                                    />
                                </div>
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Tooltip
                                title={counterpart.translate(
                                    "prediction.create_market_modal.tooltip_backing_asset"
                                )}
                                placement="topLeft"
                            >
                                <Translate content="prediction.create_market_modal.backing_asset" />
                                <Icon
                                    style={{
                                        marginLeft: "0.5rem"
                                    }}
                                    theme="filled"
                                    type="question-circle"
                                />
                            </Tooltip>
                            <AssetSelect
                                assets={["1.3.0", "1.3.113", "1.3.120", "1.3.121"]}
                                value={state.bitasset_opts.short_backing_asset}
                                onChange={handleAssetChange}
                                tabIndex={5}
                            />
                        </label>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Tooltip
                                title={counterpart.translate(
                                    "prediction.create_market_modal.tooltip_commission"
                                )}
                                placement="topLeft"
                            >
                                <Translate content="prediction.create_market_modal.commission" />
                                <Icon
                                    style={{
                                        marginLeft: "0.5rem"
                                    }}
                                    theme="filled"
                                    type="question-circle"
                                />
                            </Tooltip>
                            <Input
                                tabIndex={6}
                                type="number"
                                value={state.marketOptions.market_fee_percent}
                                onChange={handleFeeChange}
                            />
                        </label>
                    </Form.Item>
                    {state.inProgress ? (
                        <Translate content="footer.loading" />
                    ) : null}
                </Form>
            </div>
        </Modal>
    );
}

export default CreateMarketModal;
