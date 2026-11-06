// Small pages as a dialog on a desktop screen. A page whose whole content is one
// short form (Deposit, Withdraw, Instant trade, an HTLC, a direct debit, a
// borrow) is a lonely box in a wide empty page; on a desktop it opens over the page
// the user was on instead, as a dialog. On a phone it stays a page. The address is
// the same either way (the route does not change, it can be bookmarked), and
// closing the dialog goes back to where the user came from.
//
// `App.jsx` keeps the last ordinary page as the background of such a route and
// provides `DesktopModalContext`; `ModalOrPage` is what a route's element wraps its
// content in.
import * as React from "react";
import {useNavigate} from "react-router-dom";
import {Modal} from "../design-system/Modal";

/** The routes shown as a dialog on a desktop screen. */
export const DESKTOP_MODAL_PATHS = [
    "/send",
    "/deposit",
    "/withdraw",
    "/instant-trade",
    "/htlc",
    "/direct-debit",
    "/borrow"
];

/** Below this width the navigation is a drawer and a page is the whole screen. */
export const DESKTOP_QUERY = "(min-width: 861px)";

export function isDesktopModalPath(pathname: string): boolean {
    return DESKTOP_MODAL_PATHS.some(
        path => pathname === path || pathname.startsWith(path + "/")
    );
}

/** True below the routes that are shown as a dialog over a page. */
export const DesktopModalContext = React.createContext<boolean>(false);

export function useDesktopModal(): boolean {
    return React.useContext(DesktopModalContext);
}

/** Leave a dialog or a page of its own: back where the user came from. */
export function useLeave(): () => void {
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

export interface ModalOrPageProps {
    title: React.ReactNode;
    /** the dialog's width on a desktop */
    width?: number;
    children: React.ReactNode;
}

/** The content as a dialog when the route is shown as one, as the page otherwise. */
export function ModalOrPage({
    title,
    width = 720,
    children
}: ModalOrPageProps): JSX.Element {
    const asModal = useDesktopModal();
    const leave = useLeave();
    if (!asModal) return <>{children}</>;
    return (
        <Modal visible={true} title={title} width={width} onCancel={leave}>
            {children}
        </Modal>
    );
}
