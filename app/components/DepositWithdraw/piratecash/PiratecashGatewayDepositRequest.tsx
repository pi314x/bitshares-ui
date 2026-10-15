// TypeScript/functional-component port of the legacy
// PiratecashGatewayDepositRequest.jsx (Phase 7, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. Structurally identical to
// XbtsxGatewayDepositRequest.tsx (this codebase already had the two
// gateways as near-duplicate files before this migration).
//
// Structural change (not a behavior change): the original's
// `BindToChainState(PiratecashGatewayDepositRequest, {keep_updating: true})`
// wrapper resolves `account`/`issuer_account` (via `ChainStore.getAccount`)
// and `receive_asset`/`deprecated_in_favor_of` (via `ChainStore.getAsset`)
// from whatever raw id/name/symbol (or already-resolved object) the
// caller passes - none of these four are marked `.isRequired` in the
// original's propTypes, so `BindToChainState` never added its own
// loading-fallback UI for them; the component's own `render()` already
// handles "not yet resolved" via its `!this.props.account
// || !this.props.issuer_account || !this.props.receive_asset` early
// return. Replaced by a small container component doing the same
// `ChainStore.getAccount`/`getAsset` resolution directly under
// `useChainStoreTick()` (matching `keep_updating: true`'s "keep
// re-resolving on every chain-store update" behavior), per this
// migration's established `BindToChainState` replacement pattern.
//
// Preserved verbatim (not "fixed"): the original calls the real,
// network-fetching `requestDepositAddress(...)` directly inside
// `render()` (not inside a lifecycle method or effect) whenever the
// cached `account_name` state doesn't match the current account's name -
// including on the very first render. This is an unusual pre-existing
// pattern (a side effect during render), kept exactly as-is rather than
// moved into a `useEffect`, since this codebase's class-component render
// methods already ran this way and moving it would be a behavior change,
// not just a mechanical translation.
//
// `addDepositAddress`'s two separate `this.setState({account_name})` /
// `this.setState({receive_address})` calls are merged into one state
// update here: outside React's synthetic event system (this runs from a
// `fetch().then()` callback), React 16 does not batch them, so the
// original produces one extra, purely-internal re-render with a stale
// `receive_address` before the second `setState` commits - the final
// rendered output is identical either way, so this port does not
// replicate that extra unobservable render.
//
// Dropped as confirmed dead: the `deposit_fee` prop (declared in
// propTypes, never read anywhere in the original render body or passed
// through - unlike `withdraw_fee`, which *is* forwarded to
// `PiratecashWithdrawModal`). Also dropped: the `deposit_address_cache`
// (`new PiratecashDepositAddressCache()`) instance - grepped, every call
// to its `getCachedInputAddress`/`cacheInputAddress` methods in the
// original is commented out, so the instance is constructed and then
// never read again (the constructor itself has no side effects beyond
// setting an internal version string). `PiratecashDepositAddressCache`
// is still ported (`lib/common/PiratecashDepositAddressCache.ts`) as a
// standalone utility, matching the original's own choice to keep it
// available while not actually wiring it up here.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs/es";
import PiratecashWithdrawModal from "./PiratecashWithdrawModal";
import AccountBalance from "../../Account/AccountBalance";
import {requestDepositAddress} from "lib/common/PiratecashMethods";
import AssetName from "components/Utility/AssetName";
import LinkToAccountById from "components/Utility/LinkToAccountById";
import utils from "lib/common/utils";
import DisableCopyText from "../DisableCopyText";
import counterpart from "counterpart";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";
import {Modal} from "../../../design-system/Modal";
import {useChainStoreTick} from "../../../next/hooks/useChainStoreTick";

interface PiratecashGatewayDepositRequestProps {
    gateway?: string;
    deposit_coin_type?: string;
    deposit_asset_name?: string;
    deposit_account?: string;
    receive_coin_type?: string;
    account: any;
    issuer_account: any;
    deposit_asset?: string;
    deposit_wallet_type?: string;
    receive_asset: any;
    deprecated_in_favor_of?: any;
    deprecated_message?: string;
    action?: string;
    supports_output_memos: boolean;
    min_amount?: number;
    withdraw_fee?: number;
    asset_precision?: number;
}

function PiratecashGatewayDepositRequest(
    props: PiratecashGatewayDepositRequestProps
) {
    const [isModalVisible, setIsModalVisible] = React.useState(false);
    const [accountName, setAccountName] = React.useState<string | null>(null);
    const [receiveAddress, setReceiveAddress] = React.useState<any>(null);

    const showModal = () => setIsModalVisible(true);
    const hideModal = () => setIsModalVisible(false);

    const getDepositObject = () => ({
        walletType: props.deposit_wallet_type,
        inputCoinType: props.deposit_coin_type,
        outputCoinType: props.receive_coin_type,
        outputAddress: props.account.get("name"),
        stateCallback: addDepositAddress
    });

    function addDepositAddress(newReceiveAddress: any) {
        setAccountName(props.account.get("name"));
        setReceiveAddress(newReceiveAddress);
    }

    const getWithdrawModalId = () =>
        "withdraw_asset_" +
        props.issuer_account.get("name") +
        "_" +
        props.receive_asset.get("symbol");

    const onWithdraw = () => {
        showModal();
    };

    const emptyRow = <div style={{display: "none", minHeight: 150}} />;
    if (!props.account || !props.issuer_account || !props.receive_asset)
        return emptyRow;

    const account_balances_object = props.account.get("balances");

    if (props.deprecated_in_favor_of) {
        let has_nonzero_balance = false;
        const balance_object_id = account_balances_object.get(
            props.receive_asset.get("id")
        );
        if (balance_object_id) {
            const balance_object: any = ChainStore.getObject(balance_object_id);
            if (balance_object) {
                const balance = balance_object.get("balance");
                if (balance != 0) has_nonzero_balance = true;
            }
        }
        if (!has_nonzero_balance) return emptyRow;
    }

    let receive_address = null;
    const prev_account_name = accountName;
    if (prev_account_name === props.account.get("name"))
        receive_address = receiveAddress;

    if (!receive_address) {
        // (cache lookup left commented out in the original)
    }

    if (!receive_address) {
        requestDepositAddress(getDepositObject() as any);
        return emptyRow;
    }

    const withdraw_modal_id = getWithdrawModalId();
    let deposit_address_fragment = null;
    let deposit_memo = null;
    let clipboardText = "";
    const payFromWallet =
        "sth:" +
        receive_address.address +
        "?vendorField=" +
        props.account.get("name");
    let showPayFromWallet = false;
    if (props.deposit_asset === "STH") {
        showPayFromWallet = true;
    }

    let memoText;
    let withdraw_memo_prefix;
    if (props.deposit_account) {
        deposit_address_fragment = <span>{props.deposit_account}</span>;
        clipboardText = props.deposit_account;
        memoText = "dex:" + props.account.get("name");
        deposit_memo = <span>{memoText}</span>;
        withdraw_memo_prefix = props.deposit_coin_type + ":";
    } else {
        if (receive_address.memo) {
            // This is a client that uses a deposit memo (like ethereum), we need to display both the address and the memo they need to send
            memoText = receive_address.memo;
            clipboardText = receive_address.address;
            deposit_address_fragment = <span>{receive_address.address}</span>;
            deposit_memo = <span>{receive_address.memo}</span>;
        } else {
            // This is a client that uses unique deposit addresses to select the output
            clipboardText = receive_address.address;
            deposit_address_fragment = <span>{receive_address.address}</span>;
        }
        withdraw_memo_prefix = "";
    }

    const minDeposit = (utils as any).format_number(
        (props.min_amount as number) /
            (utils as any).get_asset_precision(props.asset_precision),
        props.asset_precision,
        false
    );

    if (props.action === "deposit") {
        return (
            <div className="rudex__gateway grid-block no-padding no-margin">
                <div className="small-12 medium-5">
                    <Translate
                        component="h4"
                        content="gateway.deposit_summary"
                    />
                    <div className="small-12 medium-10">
                        <table className="table">
                            <tbody>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.asset_to_deposit"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        {props.deposit_asset}
                                    </td>
                                </tr>

                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.asset_to_receive"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <AssetName
                                            name={props.receive_asset.get(
                                                "symbol"
                                            )}
                                            replace={false}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.intermediate"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <LinkToAccountById
                                            account={props.issuer_account.get(
                                                "id"
                                            )}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.your_account"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <LinkToAccountById
                                            account={props.account.get("id")}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <Translate content="gateway.balance" />:
                                    </td>
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <AccountBalance
                                            account={props.account.get("name")}
                                            asset={props.receive_asset.get(
                                                "symbol"
                                            )}
                                            replace={false}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {!memoText ? (
                        <div className="QR">
                            <QRCode size={128} value={clipboardText} />
                        </div>
                    ) : null}
                </div>
                <div className="small-12 medium-7">
                    <Translate component="h4" content="gateway.deposit_inst" />
                    <label className="left-label">
                        <Translate
                            content="gateway.deposit_to"
                            asset={props.deposit_asset}
                        />
                        :
                    </label>
                    <label className="left-label">
                        <b>
                            <Translate
                                content="gateway.xbtsx.min_amount"
                                minAmount={minDeposit}
                                symbol={props.deposit_coin_type}
                            />
                        </b>
                    </label>
                    <div style={{padding: "10px 0", fontSize: "1.1rem"}}>
                        <table className="table">
                            <tbody>
                                <tr>
                                    <td>
                                        <Translate
                                            style={{textTransform: "uppercase"}}
                                            content="gateway.address"
                                        />
                                        :{" "}
                                        <DisableCopyText
                                            replaceCopyText={counterpart.translate(
                                                "gateway.use_copy_button"
                                            )}
                                        >
                                            <b>{deposit_address_fragment}</b>
                                        </DisableCopyText>
                                    </td>
                                </tr>
                                {deposit_memo ? (
                                    <tr>
                                        <td>
                                            <Translate
                                                style={{
                                                    textTransform: "uppercase"
                                                }}
                                                content="gateway.memo"
                                            />
                                            :{" "}
                                            <DisableCopyText
                                                replaceCopyText={counterpart.translate(
                                                    "gateway.use_copy_button"
                                                )}
                                            >
                                                <b> {deposit_memo} </b>
                                            </DisableCopyText>
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                        <div className="button-group" style={{paddingTop: 10}}>
                            {deposit_address_fragment ? (
                                <CopyToClipboard text={clipboardText}>
                                    <div className="button">
                                        <Translate content="gateway.copy_address" />
                                    </div>
                                </CopyToClipboard>
                            ) : null}
                            {memoText ? (
                                <CopyToClipboard text={memoText}>
                                    <div className="button">
                                        <Translate content="gateway.copy_memo" />
                                    </div>
                                </CopyToClipboard>
                            ) : null}
                            {showPayFromWallet ? (
                                <a className="button" href={payFromWallet}>
                                    <Translate content="gateway.deposit_from_wallet" />{" "}
                                    {props.deposit_asset}
                                </a>
                            ) : null}
                        </div>
                        <Translate
                            className="has-error fz_14"
                            component="p"
                            content="gateway.min_deposit_warning_amount"
                            minDeposit={minDeposit}
                            coin={props.deposit_asset}
                        />
                        <Translate
                            className="has-error fz_14"
                            component="p"
                            content="gateway.min_deposit_warning_asset"
                            minDeposit={minDeposit}
                            coin={props.deposit_asset}
                        />
                    </div>
                </div>
            </div>
        );
    } else {
        return (
            <div className="rudex__gateway grid-block no-padding no-margin">
                <div className="small-12 medium-5">
                    <Translate
                        component="h4"
                        content="gateway.withdraw_summary"
                    />
                    <div className="small-12 medium-10">
                        <table className="table">
                            <tbody>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.asset_to_withdraw"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <AssetName
                                            name={props.receive_asset.get(
                                                "symbol"
                                            )}
                                            replace={false}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.asset_to_receive"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        {props.deposit_asset}
                                    </td>
                                </tr>
                                <tr>
                                    <Translate
                                        component="td"
                                        content="gateway.intermediate"
                                    />
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <LinkToAccountById
                                            account={props.issuer_account.get(
                                                "id"
                                            )}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <Translate content="gateway.balance" />:
                                    </td>
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            color: "#049cce",
                                            textAlign: "right"
                                        }}
                                    >
                                        <AccountBalance
                                            account={props.account.get("name")}
                                            asset={props.receive_asset.get(
                                                "symbol"
                                            )}
                                            replace={false}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="small-12 medium-7">
                    <Translate component="h4" content="gateway.withdraw_inst" />
                    <label className="left-label">
                        <Translate
                            content="gateway.withdraw_to"
                            asset={props.deposit_asset}
                        />
                        :
                    </label>
                    <div className="button-group" style={{paddingTop: 20}}>
                        <button
                            className="button success"
                            style={{fontSize: "1.3rem"}}
                            onClick={onWithdraw}
                        >
                            <Translate content="gateway.withdraw_now" />{" "}
                        </button>
                    </div>
                </div>
                <Modal
                    onCancel={hideModal}
                    title={counterpart.translate("gateway.withdraw_coin", {
                        coin: props.deposit_asset_name,
                        symbol: props.deposit_asset
                    })}
                    footer={null}
                    visible={isModalVisible}
                >
                    <PiratecashWithdrawModal
                        hideModal={hideModal}
                        showModal={showModal}
                        account={props.account.get("name")}
                        issuer={props.issuer_account.get("name")}
                        asset={props.receive_asset.get("symbol")}
                        output_coin_name={props.deposit_asset_name}
                        output_coin_symbol={props.deposit_asset}
                        output_coin_type={props.deposit_coin_type}
                        output_wallet_type={props.deposit_wallet_type}
                        output_supports_memos={props.supports_output_memos}
                        memo_prefix={withdraw_memo_prefix}
                        modal_id={withdraw_modal_id}
                        min_amount={props.min_amount}
                        withdraw_fee={props.withdraw_fee}
                        asset_precision={props.asset_precision}
                        balance={
                            props.account.get("balances").toJS()[
                                props.receive_asset.get("id")
                            ]
                        }
                    />
                </Modal>
            </div>
        );
    }
}

function PiratecashGatewayDepositRequestContainer(
    props: PiratecashGatewayDepositRequestProps
) {
    useChainStoreTick();

    const account = props.account
        ? ChainStore.getAccount(props.account as any)
        : props.account;
    const issuer_account = props.issuer_account
        ? ChainStore.getAccount(props.issuer_account as any)
        : props.issuer_account;
    const receive_asset = props.receive_asset
        ? ChainStore.getAsset(props.receive_asset as any)
        : props.receive_asset;
    const deprecated_in_favor_of = props.deprecated_in_favor_of
        ? ChainStore.getAsset(props.deprecated_in_favor_of)
        : props.deprecated_in_favor_of;

    return (
        <PiratecashGatewayDepositRequest
            {...props}
            account={account}
            issuer_account={issuer_account}
            receive_asset={receive_asset}
            deprecated_in_favor_of={deprecated_in_favor_of}
        />
    );
}

export default PiratecashGatewayDepositRequestContainer;
