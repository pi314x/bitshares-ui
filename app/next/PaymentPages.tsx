import * as React from "react";
import {useNavigate} from "react-router-dom";
import {ModalAsPage} from "../design-system/Modal";
import {useReduxState} from "./hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectGateway} from "../store/slices/gatewaySlice";
import SendModal from "../components/Modal/SendModal";
import DepositModal from "../components/Modal/DepositModal";
import WithdrawModal from "../components/Modal/WithdrawModalNew";

// Send, Deposit and Withdraw as pages of their own (menu: Payments). They are
// the same dialogs as before - same forms, same transaction flow - shown in the
// page instead of over it (`ModalAsPage`), so they can be reached, bookmarked
// and left like any other screen. Cancelling or finishing returns to where the
// user came from.

function useLeave(): () => void {
    const navigate = useNavigate();
    return React.useCallback(() => {
        // react-router numbers its history entries: index 0 is the first page
        // of this tab, so there is nothing to go back to - the dashboard then
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate("/", {replace: true});
        }
    }, [navigate]);
}

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
    );
}

export function DepositPage(): JSX.Element {
    const leave = useLeave();
    const accountName = useCurrentAccount();
    const gateway = useReduxState<any>(selectGateway);
    return (
        <ModalAsPage>
            <DepositModal
                visible={true}
                hideModal={leave}
                showModal={() => undefined}
                modalId="deposit_page"
                account={accountName}
                backedCoins={gateway.backedCoins}
            />
        </ModalAsPage>
    );
}

export function WithdrawPage(): JSX.Element {
    const leave = useLeave();
    const gateway = useReduxState<any>(selectGateway);
    return (
        <ModalAsPage>
            <WithdrawModal
                visible={true}
                hideModal={leave}
                showModal={() => undefined}
                modalId="withdraw_page"
                backedCoins={gateway.backedCoins}
            />
        </ModalAsPage>
    );
}
