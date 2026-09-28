// TypeScript/functional-component port of the legacy
// AccountBrowsingMode.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `connect(Component, {listenTo: [AccountStore, SettingsStore], getProps})`
// alt-react HOC is replaced by two `useAltStore()` calls (one per store),
// the same multi-store pattern already established elsewhere in this
// migration (e.g. `Dashboard/DashboardList.tsx`).
//
// `componentDidUpdate` (compares `prevProps.currentAccount` against the
// current value) is replicated with a `useEffect` keyed on
// `currentAccount`, skipped on its first (mount) run via a ref guard -
// `componentDidUpdate` never fires on mount, and the effect's own
// dependency array already restricts it to exactly the cases where the
// original's internal `currentAccount !== prevProps.currentAccount`
// check would have mattered.
import * as React from "react";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import AccountActions from "actions/AccountActions";
import SettingsActions from "actions/SettingsActions";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {Button, Modal, Icon, Popover, Tooltip} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountBrowsingModeProps {
    usernameViewIcon?: boolean;
    [key: string]: any;
}

function AccountBrowsingMode({usernameViewIcon}: AccountBrowsingModeProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const accountState = useAltStore<any>(AccountStore);
    const viewOnlyMode = settingsState.settings.get("viewOnlyMode");
    const currentAccount = accountState.currentAccount;

    const [previousAccountName, setPreviousAccountName] = React.useState<
        string | null
    >(null);
    const [isModalVisible, setIsModalVisible] = React.useState(false);

    const isMyAccount = (name?: string) => {
        const accountName = name ? name : currentAccount;

        const myAccounts = AccountStore.getMyAccounts();

        let result = true;

        if (Array.isArray(myAccounts) && myAccounts.length && accountName) {
            result = myAccounts.indexOf(accountName) >= 0;
        }

        return result;
    };

    const prevCurrentAccountRef = React.useRef(currentAccount);
    const isMountRef = React.useRef(true);

    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevCurrentAccountRef.current = currentAccount;
            return;
        }
        const prevCurrentAccount = prevCurrentAccountRef.current;
        /* if user changed his account to not his own*/
        if (
            prevCurrentAccount &&
            currentAccount &&
            currentAccount !== prevCurrentAccount &&
            !isMyAccount() &&
            isMyAccount(prevCurrentAccount)
        ) {
            setIsModalVisible(viewOnlyMode !== false);
            setPreviousAccountName(prevCurrentAccount);
        }
        prevCurrentAccountRef.current = currentAccount;
    }, [currentAccount]);

    const handleSwitchBack = () => {
        const myAccounts = AccountStore.getMyAccounts();

        let switchToAccountName = null;

        if (isMyAccount(previousAccountName || undefined)) {
            switchToAccountName = previousAccountName;
        } else if (Array.isArray(myAccounts) && myAccounts.length) {
            switchToAccountName = myAccounts[0];
        }
        (AccountActions.setCurrentAccount as any).defer(switchToAccountName);
    };

    const handleClose = () => {
        setIsModalVisible(false);
    };

    const handleNeverShowAgain = () => {
        handleClose();

        SettingsActions.changeSetting({
            setting: "viewOnlyMode",
            value: false
        });
    };

    const footer = [
        <Button key="ok" type="primary" onClick={handleClose}>
            {counterpart.translate("modal.ok")}
        </Button>,
        <Button key="cancel" onClick={handleNeverShowAgain}>
            {counterpart.translate("account_browsing_mode.never_show_again")}
        </Button>
    ];

    if (usernameViewIcon) {
        return window.innerWidth < 640 && !isMyAccount() ? (
            <Popover
                content={
                    <Translate content="account_browsing_mode.you_are_in_browsing_mode" />
                }
                placement="bottom"
            >
                <Icon
                    style={{marginLeft: 10}}
                    className="blue"
                    type="eye"
                    onClick={handleSwitchBack}
                />
            </Popover>
        ) : null;
    } else {
        return (
            <div className="account-browsing-mode">
                <Modal
                    title={counterpart.translate(
                        "account_browsing_mode.modal_title"
                    )}
                    closable={false}
                    visible={isModalVisible}
                    footer={footer as any}
                >
                    {counterpart.translate(
                        "account_browsing_mode.modal_description"
                    )}
                </Modal>
                {!isMyAccount() ? (
                    <Tooltip
                        placement="bottom"
                        title={counterpart.translate(
                            "account_browsing_mode.you_are_in_browsing_mode"
                        )}
                    >
                        <Button
                            onClick={handleSwitchBack}
                            className="hide-for-small-only account-browsing-mode--button"
                        >
                            {counterpart.translate(
                                "account_browsing_mode.view_mode"
                            )}
                        </Button>
                    </Tooltip>
                ) : null}
            </div>
        );
    }
}

export default AccountBrowsingMode;
