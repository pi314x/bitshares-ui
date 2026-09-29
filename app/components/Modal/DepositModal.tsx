// TypeScript/functional-component port of the legacy DepositModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Non-security-sensitive per AGENTS.md: grepped this file for
// `WalletApi`, `WalletDb`, `.add_type_operation`, `process_transaction`
// - none appear. This component only requests/displays a gateway deposit
// address; it never builds or signs an on-chain transaction itself.
//
// `DepositModalContent extends DecimalChecker` (`Utility/DecimalChecker
// .jsx`) is dropped entirely rather than inlined - grep-verified that
// none of `DecimalChecker`'s methods (`getNumericEventValue`, `onPaste`,
// `onKeyPress`) or its `allowNaN` propType are referenced anywhere in
// this file. The inheritance contributes nothing observable here (no
// numeric input in this component is wired to those handlers).
//
// The four `lib/common/assetGatewayMixin` functions
// (`_getCoinToGatewayMapping`, `_getNumberAvailableGateways`,
// `_onAssetSelected`, `gatewaySelector`) and `common/gatewayUtils`'s
// `getGatewayStatusByAsset` are plain functions called via `.call(this,
// ...)`, reading `this.props`/`this.state` (and, for `_onAssetSelected`,
// calling `this.setState(...)` as an internal side effect distinct from
// its return value). Same translation already established for
// `WithdrawModalNew.tsx` (earlier Modal batch): each call site builds a
// small object literal standing in for `this` (`{props, state}`, plus a
// `setState` that captures the patch into a local object when the
// mixin's own internal setState matters). `gatewaySelector` doesn't
// reference `this` anywhere in its own body despite being called via
// `.call(this, args)` in the original - called directly here as a plain
// function instead of replicating the no-op `.call`.
//
// `DepositModalContent`'s `shouldComponentUpdate(np, ns)` isn't a pure
// performance guard - like `ReportModal.tsx`'s (earlier Modal batch), it
// runs a real side effect (state reset + re-fetching the deposit address
// for the new asset) whenever the `asset` prop changes. The re-render-
// gating half is dropped as usual; the side-effect half becomes a
// `useEffect` keyed on `asset`, using the same "runs on update, not on
// the initial mount" mount-flag-ref pattern used throughout this
// migration (the initial-mount case is already covered separately by its
// own mount-only effect, replicating `UNSAFE_componentWillMount`).
//
// Dropped as confirmed dead (grepped, not assumed):
// - `DepositModalContent.onClose` - defined, but never bound to anything
//   in this file (only the *outer* `DepositModal.onClose` is wired to
//   the `<Modal onCancel>`); consequently `DepositModalContent`'s
//   `hideModal` prop is never actually read by any reachable code
//   either, so it's dropped from this component's own prop list.
// - The outer `DepositModal`'s `open={this.props.visible}` prop passed
//   down to `DepositModalContent`: no prop named `open` is ever
//   destructured or read anywhere in `DepositModalContent` (distinct
//   from the outer class's own, similarly-unread, `state.open` - see
//   below).
//
// The outer `DepositModal` class's `state.open` is set (`false`
// initially, `true` in `show()`) but never read in `render()` (the
// `<Modal>` uses `props.visible`, not `state.open`) - `show()`'s entire
// observable effect is therefore just calling `props.hideModal()` after
// the state update commits. Replicated with an ever-incrementing tick
// state instead of a literal boolean: a hooks `useState` setter bails
// out (skips the update, and the effect that would follow it) when the
// new value is identical to the current one, whereas a class `setState
// (update, callback)` always invokes its callback after committing, even
// for a value-identical update - the same "renderTick" technique already
// used for `AccountSelector.tsx` (Account/ batch 12) to preserve that
// guarantee. `forwardRef`+`useImperativeHandle` exposes `.show()`,
// matching `SendModal.tsx`'s established precedent for the one real
// ref-based caller (`AccountDepositWithdraw.tsx`'s `depositModalRef
// .current.show()`).
//
// Preserved verbatim, not "fixed": that one ref-based caller
// (`AccountDepositWithdraw.tsx`) never passes a `hideModal` prop to this
// `<DepositModal>` instance at all (only `modalId`/`account`/
// `backedCoins`) - calling `.show()` there calls `props.hideModal()`
// with `hideModal` genuinely `undefined`, which throws, exactly as it
// would in the original class. `hideModal` is typed optional (matching
// that real caller) and invoked with an `as any` cast to get past
// TypeScript's "possibly undefined" check, rather than adding a runtime
// guard that would silently swallow this pre-existing bug.
import * as React from "react";
import Translate from "react-translate-component";
import utils from "common/utils";
import {requestDepositAddress} from "common/gatewayMethods";
import {ChainStore} from "bitsharesjs";
import BlockTradesDepositAddressCache from "common/BlockTradesDepositAddressCache";
import CopyButton from "../Utility/CopyButton";
import Icon from "../Icon/Icon";
import LoadingIndicator from "../LoadingIndicator";
import DepositWithdrawAssetSelector from "../DepositWithdraw/DepositWithdrawAssetSelector.js";
import {
    gatewaySelector,
    _getNumberAvailableGateways,
    _onAssetSelected,
    _getCoinToGatewayMapping
} from "lib/common/assetGatewayMixin";
import {availableGateways} from "common/gateways";
import {getGatewayStatusByAsset} from "common/gatewayUtils";
import CryptoLinkFormatterImpl from "../Utility/CryptoLinkFormatter";
import counterpart from "counterpart";
import {Modal, Button} from "bitshares-ui-style-guide";

// `CryptoLinkFormatter.tsx` (an earlier, separately-ported file) types
// its two string-returning branches in a way `tsc` won't accept as a
// valid JSX component's return type - cast to `any` at this call site
// rather than touching that unrelated file, same as this migration's
// existing `Link as React.ComponentType<any>` pattern elsewhere.
const CryptoLinkFormatter = CryptoLinkFormatterImpl as any;

interface DepositModalContentState {
    depositAddress: any;
    selectedAsset: any;
    selectedGateway: any;
    fetchingAddress: boolean;
    backingAsset: any;
    gatewayStatus: any;
    depositConfirmation: any;
    coinToGatewayMapping?: any;
}

function getInitialDepositState(): DepositModalContentState {
    return {
        depositAddress: "",
        selectedAsset: "",
        selectedGateway: null,
        fetchingAddress: false,
        backingAsset: null,
        gatewayStatus: availableGateways,
        depositConfirmation: null
    };
}

interface DepositModalContentProps {
    account: any;
    asset: any;
    backedCoins: any;
}

function DepositModalContent({
    account,
    asset,
    backedCoins
}: DepositModalContentProps) {
    const [state, setState] = React.useState<DepositModalContentState>(
        getInitialDepositState
    );
    const mergeState = (patch: Partial<DepositModalContentState>) =>
        setState(prev => ({...prev, ...patch}));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const depositAddressCacheRef = React.useRef<any>(null);
    if (!depositAddressCacheRef.current) {
        depositAddressCacheRef.current = new (BlockTradesDepositAddressCache as any)();
    }

    const getDepositConfirmation = (backingAsset: any) => {
        let depositConfirmation = null;
        if (backingAsset.confirmations && backingAsset.confirmations.type) {
            if (backingAsset.confirmations.type === "irreversible") {
                depositConfirmation = {type: "irreversible"};
            } else if (
                backingAsset.confirmations.type === "blocks" &&
                backingAsset.confirmations.value
            ) {
                depositConfirmation = {
                    type: "blocks",
                    value: backingAsset.confirmations.value
                };
            }
        }
        mergeState({depositConfirmation});
    };

    const addDepositAddress = (depositAddress: any) => {
        const {selectedGateway, selectedAsset} = stateRef.current;
        depositAddressCacheRef.current.cacheInputAddress(
            selectedGateway.toLowerCase(),
            account,
            selectedAsset.toLowerCase(),
            selectedGateway.toLowerCase() + "." + selectedAsset.toLowerCase(),
            depositAddress.address,
            depositAddress.memo
        );
        mergeState({depositAddress, fetchingAddress: false});
    };

    const getDepositObject = (
        assetName: any,
        fullAssetName: any,
        selectedGateway: any,
        url: any
    ) => {
        const {gatewayStatus} = stateRef.current;
        return {
            inputCoinType: gatewayStatus[selectedGateway].useFullAssetName
                ? fullAssetName.toLowerCase()
                : assetName.toLowerCase(),
            outputCoinType: fullAssetName.toLowerCase(),
            outputAddress: account,
            url,
            stateCallback: addDepositAddress,
            selectedGateway
        };
    };

    const getDepositAddress = (selectedAsset: any, selectedGateway: any) => {
        const gatewayStatus = (getGatewayStatusByAsset as any).call(
            {props: {backedCoins}, state: stateRef.current},
            selectedAsset
        );

        mergeState({
            fetchingAddress: true,
            depositAddress: null,
            gatewayStatus
        });

        // Get Backing Asset for Gateway
        const backingAsset = backedCoins
            .get(selectedGateway.toUpperCase(), [])
            .find((c: any) => {
                let backingCoin = c.backingCoinType || c.backingCoin;

                if (backingCoin.toUpperCase().indexOf("EOS.") !== -1) {
                    backingCoin = backingCoin.split(".")[1];
                }

                return (
                    backingCoin.toUpperCase() === selectedAsset.toUpperCase()
                );
            });

        if (!backingAsset) {
            console.log(
                selectedGateway + " does not support " + selectedAsset
            );
            mergeState({
                depositAddress: null,
                selectedAsset,
                selectedGateway,
                fetchingAddress: false
            });
            return;
        }

        getDepositConfirmation(backingAsset);

        let depositAddress: any;
        if (
            selectedGateway &&
            selectedAsset &&
            (gatewayStatus[selectedGateway].hasOwnProperty("depositCaching")
                ? gatewayStatus[selectedGateway].depositCaching
                : true)
        ) {
            depositAddress = depositAddressCacheRef.current.getCachedInputAddress(
                selectedGateway.toLowerCase(),
                account,
                selectedAsset.toLowerCase(),
                selectedGateway.toLowerCase() +
                    "." +
                    selectedAsset.toLowerCase()
            );
        }

        if (
            !!gatewayStatus[selectedGateway].simpleAssetGateway &&
            !!backingAsset.gatewayWallet
        ) {
            let memoText;
            if (!!backingAsset.memoType && backingAsset.memoType === "btsid") {
                const accountMap = (ChainStore as any).getAccount(
                    account,
                    false
                );
                memoText =
                    gatewayStatus[selectedGateway].fixedMemo["prepend_btsid"] +
                    accountMap.get("id").replace("1.2.", "") +
                    gatewayStatus[selectedGateway].fixedMemo["append"];
            }
            let tagText;
            if (!!backingAsset.memoType && backingAsset.memoType === "tagid") {
                const accountMap = (ChainStore as any).getAccount(
                    account,
                    false
                );
                tagText =
                    gatewayStatus[selectedGateway].fixedMemo["prepend_btsid"] +
                    accountMap.get("id").replace("1.2.", "") +
                    gatewayStatus[selectedGateway].fixedMemo["append"];
            } else {
                memoText =
                    gatewayStatus[selectedGateway].fixedMemo[
                        "prepend_default"
                    ] +
                    account +
                    gatewayStatus[selectedGateway].fixedMemo["append"];
                tagText =
                    gatewayStatus[selectedGateway].fixedMemo[
                        "prepend_default"
                    ] +
                    account +
                    gatewayStatus[selectedGateway].fixedMemo["append"];
            }
            depositAddress = {
                address: backingAsset.gatewayWallet,
                memo: memoText,
                tag: tagText
            };

            mergeState({depositAddress, fetchingAddress: false});
        } else {
            if (!depositAddress) {
                const assetName =
                    backingAsset.backingCoinType || backingAsset.backingCoin;
                const fullAssetName = backingAsset.symbol;

                (requestDepositAddress as any)(
                    getDepositObject(
                        assetName,
                        fullAssetName,
                        selectedGateway,
                        gatewayStatus[selectedGateway].baseAPI.BASE
                    )
                );
            } else {
                mergeState({depositAddress, fetchingAddress: false});
            }
        }

        mergeState({selectedAsset, selectedGateway, backingAsset});
    };

    const setDepositAsset = (assetProp: any) => {
        const coinToGatewayMapping = (_getCoinToGatewayMapping as any).call({
            props: {backedCoins}
        });
        mergeState({coinToGatewayMapping});

        if (!assetProp) return;

        const backedAsset = assetProp.split(".");
        const usingGateway = stateRef.current.gatewayStatus[backedAsset[0]]
            ? true
            : false;

        if (usingGateway) {
            const assetName = backedAsset[1];
            const assetGateway = backedAsset[0];
            getDepositAddress(assetName, assetGateway);
        } else {
            mergeState({selectedAsset: "BTS"});
        }
    };

    React.useEffect(() => {
        setDepositAsset(asset);
    }, []);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        setState(getInitialDepositState());
        setDepositAsset(asset);
    }, [asset]);

    const onGatewayChanged = (selectedGateway: any) => {
        getDepositAddress(stateRef.current.selectedAsset, selectedGateway);
    };

    const onAssetSelected = (assetObj: any) => {
        if (assetObj.gateway == "") {
            mergeState({selectedAsset: assetObj.id, selectedGateway: null});
            return;
        }

        const capturedPatch: any = {};
        const mixinThis = {
            props: {backedCoins},
            state: stateRef.current,
            setState: (patch: any) => Object.assign(capturedPatch, patch)
        };

        const {selectedAsset, selectedGateway} = (_onAssetSelected as any).call(
            mixinThis,
            assetObj.id,
            "depositAllowed",
            (availableGatewaysList: any) => {
                if (availableGatewaysList && availableGatewaysList.length == 1)
                    return availableGatewaysList[0]; //autoselect gateway if exactly 1 item
                return null;
            }
        );

        mergeState(capturedPatch);

        if (selectedGateway) {
            getDepositAddress(selectedAsset, selectedGateway);
        }
    };

    const {
        selectedAsset,
        depositAddress: depositAddressState,
        fetchingAddress,
        gatewayStatus,
        backingAsset,
        depositConfirmation
    } = state;
    const selectedGateway = state.selectedGateway;
    let depositAddress = depositAddressState;
    let usingGateway = true;

    if (selectedGateway == null && selectedAsset == "BTS") {
        usingGateway = false;
        depositAddress = {address: account};
    }

    // Count available gateways
    const nAvailableGateways = (_getNumberAvailableGateways as any).call({
        props: {backedCoins},
        state: stateRef.current
    });
    const isAddressValid =
        depositAddress && depositAddress !== "unknown" && !depositAddress.error;

    let minDeposit = 0;
    if (!!backingAsset) {
        if (!!backingAsset.minAmount && !!backingAsset.precision) {
            minDeposit = (utils as any).format_number(
                backingAsset.minAmount /
                    (utils as any).get_asset_precision(backingAsset.precision),
                backingAsset.precision,
                false
            );
        } else if (!!backingAsset.gateFee) {
            minDeposit = backingAsset.gateFee * 2;
        }
    }

    const QR = isAddressValid ? (
        <CryptoLinkFormatter
            size={140}
            address={usingGateway ? depositAddress.address : account}
            asset={selectedAsset}
        />
    ) : (
        <div>
            <Icon
                size="5x"
                name="minus-circle"
                title="icons.minus_circle.wrong_address"
            />
            <p className="error-msg">
                <Translate content="modal.deposit.address_generation_error" />
            </p>
        </div>
    );

    return (
        <div className="grid-block vertical no-overflow">
            <div className="modal__body" style={{paddingTop: "0"}}>
                <div className="container-row">
                    <div className="no-margin no-padding">
                        <div className="inline-label input-wrapper">
                            <DepositWithdrawAssetSelector
                                defaultValue={state.selectedAsset}
                                onSelect={onAssetSelected}
                                selectOnBlur
                            />
                        </div>
                    </div>
                </div>

                {usingGateway && selectedAsset
                    ? gatewaySelector({
                          selectedGateway,
                          gatewayStatus,
                          nAvailableGateways,
                          error: depositAddress && depositAddress.error,
                          onGatewayChanged
                      })
                    : null}

                {!fetchingAddress ? (
                    (!usingGateway ||
                        (usingGateway &&
                            selectedGateway &&
                            gatewayStatus[selectedGateway].options.enabled)) &&
                    isAddressValid &&
                    !depositAddress.memo ? (
                        <div
                            className="container-row"
                            style={{textAlign: "center"}}
                        >
                            {QR}
                        </div>
                    ) : null
                ) : (
                    <div
                        className="container-row"
                        style={{textAlign: "center", paddingTop: 15}}
                    >
                        <LoadingIndicator type="three-bounce" />
                    </div>
                )}
                {selectedGateway &&
                gatewayStatus[selectedGateway].options.enabled &&
                isAddressValid ? (
                    <div className="container-row">
                        <Translate
                            className="grid-block container-row maxDeposit"
                            style={{fontSize: "1rem"}}
                            content="gateway.min_deposit_warning_amount"
                            minDeposit={minDeposit || 0}
                            coin={selectedAsset}
                        />

                        <div className="grid-block container-row">
                            <div style={{paddingRight: "1rem"}}>
                                <CopyButton
                                    text={depositAddress.address}
                                    className={"copyIcon"}
                                />
                            </div>
                            <div style={{wordBreak: "break-word"}}>
                                <Translate
                                    component="div"
                                    style={{
                                        fontSize: "0.8rem",
                                        fontWeight: "bold",
                                        paddingBottom: "0.3rem"
                                    }}
                                    content="gateway.purchase_notice"
                                    inputAsset={selectedAsset}
                                    outputAsset={
                                        selectedGateway + "." + selectedAsset
                                    }
                                />
                                <div
                                    className="modal__highlight"
                                    style={{
                                        fontSize: "0.9rem",
                                        wordBreak: "break-all"
                                    }}
                                >
                                    {depositAddress.address}
                                </div>
                            </div>
                        </div>
                        {depositAddress.memo ? (
                            <div className="grid-block container-row">
                                <div style={{paddingRight: "1rem"}}>
                                    <CopyButton
                                        text={depositAddress.memo}
                                        className={"copyIcon"}
                                    />
                                </div>
                                <div>
                                    <Translate
                                        component="div"
                                        style={{
                                            fontSize: "0.8rem",
                                            fontWeight: "bold",
                                            paddingBottom: "0.3rem"
                                        }}
                                        unsafe
                                        content="gateway.purchase_notice_memo"
                                    />
                                    <div
                                        className="modal__highlight"
                                        style={{wordBreak: "break-all"}}
                                    >
                                        {depositAddress.memo}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {depositAddress.tag ? (
                            <div className="grid-block container-row">
                                <div style={{paddingRight: "1rem"}}>
                                    <CopyButton
                                        text={depositAddress.tag}
                                        className={"copyIcon"}
                                    />
                                </div>
                                <div>
                                    <Translate
                                        component="div"
                                        style={{
                                            fontSize: "0.8rem",
                                            fontWeight: "bold",
                                            paddingBottom: "0.3rem"
                                        }}
                                        unsafe
                                        content="gateway.purchase_notice_tag"
                                    />
                                    <div
                                        className="modal__highlight"
                                        style={{wordBreak: "break-all"}}
                                    >
                                        {depositAddress.tag}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {depositConfirmation ? (
                            <div
                                style={{
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                    fontStyle: "italic",
                                    paddingBottom: "0.3rem"
                                }}
                            >
                                {depositConfirmation.type === "irreversible" ? (
                                    <Translate content="gateway.gateway_deposit.confirmations.last_irreversible" />
                                ) : depositConfirmation.type === "blocks" ? (
                                    <Translate
                                        content="gateway.gateway_deposit.confirmations.n_blocks"
                                        blocks={depositConfirmation.value}
                                    />
                                ) : null}
                            </div>
                        ) : null}

                        <Translate
                            component="span"
                            style={{fontSize: "0.8rem"}}
                            content="gateway.min_deposit_warning_asset"
                            minDeposit={minDeposit || 0}
                            coin={selectedAsset}
                        />
                    </div>
                ) : null}
                {!usingGateway ? (
                    <div className="container-row deposit-directly">
                        <h2
                            className="modal__highlight"
                            style={{textAlign: "center"}}
                        >
                            {account}
                        </h2>
                        <Translate
                            component="h6"
                            content="modal.deposit.bts_transfer_description"
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

interface DepositModalProps {
    account?: any;
    asset?: any;
    backedCoins?: any;
    modalId?: string;
    visible?: boolean;
    hideModal?: () => void;
    showModal?: () => void;
}

interface DepositModalHandle {
    show: () => void;
}

const DepositModal = React.forwardRef<DepositModalHandle, DepositModalProps>(
    (props, ref) => {
        const [showTick, setShowTick] = React.useState(0);
        const isMountRef = React.useRef(true);

        React.useEffect(() => {
            if (isMountRef.current) {
                isMountRef.current = false;
                return;
            }
            (props.hideModal as any)();
        }, [showTick]);

        React.useImperativeHandle(ref, () => ({
            show: () => setShowTick(t => t + 1)
        }));

        const onClose = () => {
            (props.hideModal as any)();
        };

        return (
            <Modal
                destroyOnClose={true}
                title={
                    props.account
                        ? counterpart.translate("modal.deposit.header", {
                              account_name: props.account
                          })
                        : counterpart.translate("modal.deposit.header_short")
                }
                id={props.modalId}
                className={props.modalId}
                onCancel={onClose}
                overlay={true}
                footer={[
                    <Button key="cancel" onClick={props.hideModal}>
                        {counterpart.translate("modal.close")}
                    </Button>
                ]}
                visible={props.visible}
                noCloseBtn
            >
                <DepositModalContent
                    account={props.account}
                    asset={props.asset}
                    backedCoins={props.backedCoins}
                />
            </Modal>
        );
    }
);

DepositModal.displayName = "DepositModal";

export default DepositModal;
