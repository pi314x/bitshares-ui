import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";

const mockDeleteLocalData = jest.fn();
const mockInventory = {
    databases: ["graphene_db_06f667", "graphene_v2_06f667_default"],
    storageKeys: ["__graphene__settings_v4"]
};
jest.mock("../../../lib/common/deleteLocal", () => ({
    ...jest.requireActual("../../../lib/common/deleteLocal"),
    localInventory: () => Promise.resolve(mockInventory),
    deleteLocalData: (...a: any[]) => mockDeleteLocalData(...a)
}));
const mockClose = jest.fn();
jest.mock("idb-instance", () => ({
    __esModule: true,
    default: {
        root: {database_name: "graphene_db_06f667", db: {}, close: jest.fn()},
        instance: () => ({db: () => ({name: "graphene_v2_06f667_default"})}),
        close: () => mockClose()
    }
}));

import DeleteLocalDialog from "../../../components/Settings/DeleteLocalDialog";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    mockDeleteLocalData.mockReset();
    mockDeleteLocalData.mockImplementation(async (_env, _inv, options) => {
        options.closeConnections();
        return {
            databases: mockInventory.databases,
            storageKeys: 1,
            blocked: []
        };
    });
    mockClose.mockReset();
});

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
    });

const open = async () => {
    const onCancel = jest.fn();
    const onDeleted = jest.fn();
    render(
        <MemoryRouter>
            <DeleteLocalDialog
                visible={true}
                onCancel={onCancel}
                onDeleted={onDeleted}
            />
        </MemoryRouter>
    );
    await flush();
    return {onCancel, onDeleted};
};

const button = (name: string) =>
    screen.getByRole("button", {name}) as HTMLButtonElement;
const field = () => screen.getByRole("textbox") as HTMLInputElement;

describe("DeleteLocalDialog", () => {
    it("warns first: what goes, what stays, the backup", async () => {
        await open();
        const text = document.body.textContent || "";
        expect(text).toContain("Step 1 of 2");
        expect(text).toContain("cannot be undone");
        expect(text).toContain("databases found: 2");
        expect(text).toContain("entries found: 1");
        expect(text).toContain("Not affected: your accounts, balances");
        expect(
            (screen.getByText(
                "Back up your wallet first"
            ) as HTMLAnchorElement).getAttribute("href")
        ).toBe("/wallet/backup/create");
    });

    it("cannot go on until the warning is accepted - the first approval", async () => {
        await open();
        expect(button("Continue").disabled).toBe(true);
        fireEvent.click(
            screen.getByLabelText(
                "I have a backup, or I accept that my keys are lost for good"
            )
        );
        expect(button("Continue").disabled).toBe(false);
    });

    it("deletes nothing at the first approval", async () => {
        await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        expect(document.body.textContent).toContain("Step 2 of 2");
        expect(mockDeleteLocalData).not.toHaveBeenCalled();
    });

    it("needs the word typed - the second approval - and then deletes and tells the page", async () => {
        const {onDeleted} = await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        expect(button("Delete everything").disabled).toBe(true);
        fireEvent.change(field(), {target: {value: "delete"}});
        expect(button("Delete everything").disabled).toBe(true);
        fireEvent.change(field(), {target: {value: "DELETE"}});
        expect(button("Delete everything").disabled).toBe(false);
        fireEvent.click(button("Delete everything"));
        await flush();
        expect(mockDeleteLocalData).toHaveBeenCalledTimes(1);
        // the app's own connections were closed first
        expect(mockClose).toHaveBeenCalledTimes(1);
        expect(onDeleted).toHaveBeenCalledTimes(1);
    });

    it("Enter in the field does not delete before the word is right", async () => {
        await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        fireEvent.change(field(), {target: {value: "DEL"}});
        fireEvent.keyDown(field(), {key: "Enter"});
        await flush();
        expect(mockDeleteLocalData).not.toHaveBeenCalled();
    });

    it("Back returns to the warning and clears what was typed", async () => {
        await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        fireEvent.change(field(), {target: {value: "DELETE"}});
        fireEvent.click(button("Back"));
        await flush();
        expect(document.body.textContent).toContain("Step 1 of 2");
        fireEvent.click(button("Continue"));
        await flush();
        expect(field().value).toBe("");
    });

    it("says so when another tab holds the data open, and does not reload", async () => {
        mockDeleteLocalData.mockResolvedValue({
            databases: [],
            storageKeys: 1,
            blocked: ["graphene_db_06f667"]
        });
        const {onDeleted} = await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        fireEvent.change(field(), {target: {value: "DELETE"}});
        fireEvent.click(button("Delete everything"));
        await flush();
        expect(document.body.textContent).toContain("Close the other tabs");
        expect(onDeleted).not.toHaveBeenCalled();
    });

    it("says so when the deletion fails", async () => {
        mockDeleteLocalData.mockRejectedValue(new Error("QuotaExceeded"));
        const {onDeleted} = await open();
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(button("Continue"));
        await flush();
        fireEvent.change(field(), {target: {value: "DELETE"}});
        fireEvent.click(button("Delete everything"));
        await flush();
        expect(document.body.textContent).toContain(
            "Could not delete: QuotaExceeded"
        );
        expect(onDeleted).not.toHaveBeenCalled();
    });

    it("Cancel leaves everything as it is", async () => {
        const {onCancel} = await open();
        fireEvent.click(button("Cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(mockDeleteLocalData).not.toHaveBeenCalled();
    });
});
