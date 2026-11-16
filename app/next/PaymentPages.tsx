import * as React from "react";
import {useLocation} from "react-router-dom";
import {ModalAsPage} from "../design-system/Modal";
import {ChainStore} from "bitsharesjs";
import {useReduxState} from "./hooks/useReduxState";
import {useChainStoreTick} from "./hooks/useChainStoreTick";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectGateway} from "../store/slices/gatewaySlice";
import SendModal from "../components/Modal/SendModal";
import DepositModal from "../components/Modal/DepositModal";
import WithdrawModal from "../components/Modal/WithdrawModalNew";
import {useLeave} from "./desktopModal";
import styles from "./PaymentPages.module.scss";

// Send, Deposit and Withdraw as pages of their own (menu: Payments). They are
// the same dialogs as before - same forms, same transaction flow - shown in the
// page instead of over it (`ModalAsPage`), so they can be reached, bookmarked
// and left like any other screen. Cancelling or finishing returns to where the
// user came from.

function useCurrentAccount(): string | null {
    const account = useReduxState<any>(selectAccountState);
    return account.currentAccount || account.passwordAccount || null;
}

export function SendPage(): JSX.Element {
    const leave = useLeave();
    const accountName = useCurrentAccount();
    const sendRef = React.useRef<{show: () => void} | null>(null);
    // the address book sends here with the recipient chosen
    const location = useLocation();
    const toName: string | undefined =
        location.state && typeof (location.state as any).toName === "string"
            ? (location.state as any).toName
            : undefined;
    // the entry that was pressed (two can be for one account)
    const entryId: string | undefined =
        location.state && typeof (location.state as any).entryId === "string"
            ? (location.state as any).entryId
            : undefined;
    // and the asset of an entry that is for one (a withdrawal of it), found by its symbol once the chain store has it
    useChainStoreTick();
    const symbol: string | undefined =
        location.state && typeof (location.state as any).asset === "string"
            ? (location.state as any).asset
            : undefined;
    const sendAsset: any = symbol ? ChainStore.getAsset(symbol) : null;
    const assetId: string | undefined = sendAsset
        ? sendAsset.get("id")
        : undefined;
    React.useEffect(() => {
        // the dialog opens itself on request, as it does from a button
        sendRef.current && sendRef.current.show();
    }, []);
    // the asset of the entry may be loaded after the dialog opened: it is chosen when it arrives
    React.useEffect(() => {
        if (assetId) sendRef.current && sendRef.current.show();
    }, [assetId]);
    const dialog = (
        <SendModal
            id="send_page"
            refCallback={(e: {show: () => void} | null) => {
                sendRef.current = e;
            }}
            from_name={accountName}
            to_name={toName}
            asset_id={assetId}
            entry_id={entryId}
            onHide={leave}
            layout="page"
        />
    );
    // the form as the cards of a payment page, with the summary and the button beside them
    return dialog;
}

export function DepositPage(): JSX.Element {
    const leave = useLeave();
    const accountName = useCurrentAccount();
    const gateway = useReduxState<any>(selectGateway);
    const dialog = (
        <DepositModal
            visible={true}
            hideModal={leave}
            showModal={() => undefined}
            modalId="deposit_page"
            account={accountName}
            backedCoins={gateway.backedCoins}
            layout="page"
        />
    );
    // the cards of a payment page, with the summary beside them
    return dialog;
}

export function WithdrawPage(): JSX.Element {
    const leave = useLeave();
    const gateway = useReduxState<any>(selectGateway);
    const dialog = (
        <WithdrawModal
            visible={true}
            hideModal={leave}
            showModal={() => undefined}
            modalId="withdraw_page"
            backedCoins={gateway.backedCoins}
        />
    );
    return (
        <div className={styles.page}>
            <ModalAsPage>{dialog}</ModalAsPage>
        </div>
    );
}
