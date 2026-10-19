import * as React from "react";
import {ModalAsPage} from "../design-system/Modal";
import {useReduxState} from "./hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectGateway} from "../store/slices/gatewaySlice";
import SendModal from "../components/Modal/SendModal";
import DepositModal from "../components/Modal/DepositModal";
import WithdrawModal from "../components/Modal/WithdrawModalNew";
import {useDesktopModal, useLeave} from "./desktopModal";
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
    React.useEffect(() => {
        // the dialog opens itself on request, as it does from a button
        sendRef.current && sendRef.current.show();
    }, []);
    return (
        <div className={`send-page ${styles.page}`}>
            <ModalAsPage>
                <SendModal
                    id="send_page"
                    refCallback={(e: {show: () => void} | null) => {
                        sendRef.current = e;
                    }}
                    from_name={accountName}
                    onHide={leave}
                />
            </ModalAsPage>
        </div>
    );
}

export function DepositPage(): JSX.Element {
    const leave = useLeave();
    const asModal = useDesktopModal();
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
        />
    );
    // on a desktop the dialog opens over the page the user came from
    if (asModal) return dialog;
    return (
        <div className={styles.page}>
            <ModalAsPage>{dialog}</ModalAsPage>
        </div>
    );
}

export function WithdrawPage(): JSX.Element {
    const leave = useLeave();
    const asModal = useDesktopModal();
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
    if (asModal) return dialog;
    return (
        <div className={styles.page}>
            <ModalAsPage>{dialog}</ModalAsPage>
        </div>
    );
}
