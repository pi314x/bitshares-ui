import accountUtils from "../../lib/common/account_utils";

// What the fee of a dialog is paid in: the asset the user chose there, when the account can
// pay the fee in it. (getFinalFeeAsset put the default of the settings first, so the
// choice was dropped, and a fee paid in a user-issued asset could not be had.)
describe("accountUtils.chooseFeeAsset", () => {
    afterEach(() => jest.restoreAllMocks());

    const possible = (assets: string[]) =>
        jest
            .spyOn(accountUtils as any, "getPossibleFees")
            .mockReturnValue({assets, fees: {}});
    const finalChoice = (id: string) =>
        jest.spyOn(accountUtils as any, "getFinalFeeAsset").mockReturnValue(id);

    it("uses the chosen asset when the account can pay the fee in it", () => {
        possible(["1.3.0", "1.3.1853"]);
        const final = finalChoice("1.3.0"); // what the settings default would give
        expect(
            (accountUtils as any).chooseFeeAsset(
                "1.2.5",
                "transfer",
                "1.3.1853"
            )
        ).toBe("1.3.1853");
        expect(final).not.toHaveBeenCalled();
    });

    it("falls back to the usual choice when the chosen asset cannot pay it", () => {
        possible(["1.3.0"]);
        const final = finalChoice("1.3.0");
        expect(
            (accountUtils as any).chooseFeeAsset(
                "1.2.5",
                "transfer",
                "1.3.1853"
            )
        ).toBe("1.3.0");
        expect(final).toHaveBeenCalledWith("1.2.5", "transfer", "1.3.1853");
    });

    it("leaves the choice to the usual rules when nothing was chosen", () => {
        const fees = possible(["1.3.0", "1.3.1853"]);
        const final = finalChoice("1.3.1853"); // the user's default in the settings
        expect(
            (accountUtils as any).chooseFeeAsset("1.2.5", "transfer", null)
        ).toBe("1.3.1853");
        expect(fees).not.toHaveBeenCalled();
        expect(final).toHaveBeenCalledWith("1.2.5", "transfer", undefined);
    });
});
