import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {WalletLockButton} from "../../design-system/WalletLockButton";

describe("design-system/WalletLockButton", () => {
    it("shows Locked and calls onToggle", () => {
        const onToggle = jest.fn();
        const {getByText} = render(
            <WalletLockButton locked={true} onToggle={onToggle} />
        );
        fireEvent.click(getByText("Locked"));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("shows Unlocked when locked is false", () => {
        const {getByText} = render(
            <WalletLockButton locked={false} onToggle={() => {}} />
        );
        expect(getByText("Unlocked")).toBeTruthy();
    });

    it("shows a neutral label before the lock state is known", () => {
        const {getByText} = render(
            <WalletLockButton locked={null} onToggle={() => {}} />
        );
        expect(getByText("Wallet")).toBeTruthy();
    });
});
