import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Topbar} from "../../design-system/Topbar";

function renderTopbar(
    overrides: Partial<React.ComponentProps<typeof Topbar>> = {}
) {
    return render(
        <Topbar
            crumb="Dashboard"
            connectionStatus="open"
            activeNode="wss://node.xbts.io/ws"
            nodeSelector={<div>node selector</div>}
            currentAccount="init0"
            accounts={["init0", "init1"]}
            onSelectAccount={() => {}}
            locked={true}
            onToggleLock={() => {}}
            currentLocale="en"
            locales={["en", "de"]}
            onSelectLocale={() => {}}
            onShowSend={() => {}}
            onShowDeposit={() => {}}
            onShowWithdraw={() => {}}
            {...overrides}
        />
    );
}

describe("design-system/Topbar", () => {
    it("shows Connected when rpc_connection_status is open", () => {
        const {getByText} = renderTopbar();
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("surfaces the raw status when not connected, instead of hiding it", () => {
        const {getByText} = renderTopbar({connectionStatus: "closed"});
        expect(getByText("closed")).toBeTruthy();
    });

    it("falls back to a connecting label when status is null", () => {
        const {getByText} = renderTopbar({connectionStatus: null});
        expect(getByText("Connecting…")).toBeTruthy();
    });

    it("shows the wallet lock state and toggles it on click", () => {
        const onToggleLock = jest.fn();
        const {getByText} = renderTopbar({locked: true, onToggleLock});
        fireEvent.click(getByText("Locked"));
        expect(onToggleLock).toHaveBeenCalledTimes(1);
    });

    it("puts the lock after the account menu", () => {
        const {getByText} = renderTopbar({
            locked: true,
            currentAccount: "init0"
        });
        const account = getByText("init0");
        const lock = getByText("Locked");
        // DOCUMENT_POSITION_FOLLOWING: the lock comes later in the document
        expect(
            account.compareDocumentPosition(lock) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("puts what is passed as endChips at the far right, after the lock", () => {
        const {getByText} = renderTopbar({
            locked: true,
            endChips: <span>bell</span>
        });
        const lock = getByText("Locked");
        const bell = getByText("bell");
        expect(
            lock.compareDocumentPosition(bell) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("switches accounts through the real AccountSwitcher, not a static label", () => {
        const onSelectAccount = jest.fn();
        const {getByText} = renderTopbar({
            currentAccount: "init0",
            accounts: ["init0", "init1"],
            onSelectAccount
        });
        fireEvent.click(getByText("init0"));
        fireEvent.click(getByText("init1"));
        expect(onSelectAccount).toHaveBeenCalledWith("init1");
    });

    it("opens the node picker panel with the active node and the given selector", () => {
        const {getByText, queryByText} = renderTopbar({
            activeNode: "wss://node.xbts.io/ws",
            nodeSelector: <div>the real NodeSelector</div>
        });
        expect(queryByText("the real NodeSelector")).toBeNull();
        fireEvent.click(getByText("Connected"));
        expect(getByText("wss://node.xbts.io/ws")).toBeTruthy();
        expect(getByText("the real NodeSelector")).toBeTruthy();
    });

    it("wires the send/deposit/withdraw buttons to their handlers", () => {
        const onShowSend = jest.fn();
        const onShowDeposit = jest.fn();
        const onShowWithdraw = jest.fn();
        const {getByText} = renderTopbar({
            onShowSend,
            onShowDeposit,
            onShowWithdraw
        });
        fireEvent.click(getByText("Send"));
        fireEvent.click(getByText("Deposit"));
        fireEvent.click(getByText("Withdraw"));
        expect(onShowSend).toHaveBeenCalledTimes(1);
        expect(onShowDeposit).toHaveBeenCalledTimes(1);
        expect(onShowWithdraw).toHaveBeenCalledTimes(1);
    });

    it("shows the extension action only when one is given, and runs it on click", () => {
        const {queryByText, rerender, getByText} = renderTopbar();
        expect(queryByText("Connect extension")).toBeNull();
        const onClick = jest.fn();
        const {getByText: byText} = renderTopbar({
            extensionAction: {label: "Connect extension", onClick}
        });
        fireEvent.click(byText("Connect extension"));
        expect(onClick).toHaveBeenCalledTimes(1);
        void rerender;
        void getByText;
    });
});
