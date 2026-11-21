import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import BackupNotice, {backupNeeded} from "../../next/BackupNotice";

const mockWalletState: {wallet: any} = {wallet: null};
jest.mock("stores/WalletDb", () => ({
    __esModule: true,
    default: {
        getState: () => mockWalletState,
        listen: () => {},
        unlisten: () => {}
    }
}));

const mockCachedState: {props: any} = {props: new Map()};
jest.mock("../../store/slices/cachedPropertySlice", () => ({
    __esModule: true,
    selectCachedPropertyState: () => mockCachedState
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: (selector: any) => selector({})
}));

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

function renderNotice() {
    return render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route path="/" element={<BackupNotice />} />
                <Route path="/wallet/backup/create" element={<p>backup</p>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("backupNeeded", () => {
    it("is false without a local wallet (cloud wallet / not logged in)", () => {
        expect(backupNeeded(null, true)).toBe(false);
        expect(backupNeeded(undefined, false)).toBe(false);
    });

    it("is true for a wallet that was never backed up", () => {
        expect(backupNeeded({}, false)).toBe(true);
    });

    it("is true again when the wallet changed since its backup", () => {
        expect(backupNeeded({backup_date: "2026-01-01"}, true)).toBe(true);
        expect(backupNeeded({backup_date: "2026-01-01"}, false)).toBe(false);
    });
});

describe("BackupNotice", () => {
    beforeEach(() => {
        mockWalletState.wallet = null;
        mockCachedState.props = new Map();
    });

    it("shows nothing when there is no wallet or it is backed up", () => {
        const none = renderNotice();
        expect(none.queryByRole("button")).toBeNull();
        none.unmount();
        mockWalletState.wallet = {backup_date: "2026-01-01"};
        const done = renderNotice();
        expect(done.queryByRole("button")).toBeNull();
    });

    it("says a backup is required and leads to the backup page", () => {
        mockWalletState.wallet = {};
        const {getAllByText, getByRole, getByText} = renderNotice();
        expect(getAllByText("A Backup is Required").length).toBeGreaterThan(0);
        fireEvent.click(getByRole("button"));
        expect(getByText("backup")).toBeTruthy();
    });
});
