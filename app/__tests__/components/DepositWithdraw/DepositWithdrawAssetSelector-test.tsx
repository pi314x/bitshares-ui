import * as React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";
import {
    DepositWithdrawAssetSelectorView,
    buildAssets
} from "../../../components/DepositWithdraw/DepositWithdrawAssetSelector";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const COINS = [
    [
        {symbol: "XBTSX.USDT", gateFee: "1", issuerId: "1.2.5"},
        {symbol: "XBTSX.BTC"},
        {symbol: "BROKEN"} // no gateway/coin split: skipped
    ],
    [
        {symbol: "GDEX.USDT"}, // USDT already listed from the first gateway
        {symbol: "GDEX.ETH"}
    ]
];

describe("buildAssets", () => {
    it("lists each backed coin once (first gateway wins) plus BTS", () => {
        const assets = buildAssets(COINS as any);
        expect(assets.map(a => `${a.id}@${a.gateway}`)).toEqual([
            "USDT@XBTSX",
            "BTC@XBTSX",
            "ETH@GDEX",
            "BTS@"
        ]);
        expect(assets[0]).toEqual({
            id: "USDT",
            label: "USDT",
            gateway: "XBTSX",
            gateFee: "1",
            issuer: "1.2.5"
        });
        // the old Openledger issuer is the fallback
        expect(assets[1].issuer).toBe("1.2.96397");
    });

    it("restricts to `include` but always keeps BTS", () => {
        const assets = buildAssets(COINS as any, ["ETH"]);
        expect(assets.map(a => a.id)).toEqual(["ETH", "BTS"]);
    });

    it("leaves BTS out when includeBTS is false", () => {
        expect(
            buildAssets(COINS as any, undefined, false).map(a => a.id)
        ).toEqual(["USDT", "BTC", "ETH"]);
    });

    it("handles no gateways", () => {
        expect(buildAssets([], undefined, false)).toEqual([]);
        expect(buildAssets([]).map(a => a.id)).toEqual(["BTS"]);
    });
});

describe("DepositWithdrawAssetSelectorView", () => {
    function open(props: any = {}) {
        const utils = render(
            <DepositWithdrawAssetSelectorView
                backedCoins={COINS as any}
                usageContext="withdraw"
                {...props}
            />
        );
        fireEvent.click(screen.getByRole("button"));
        return utils;
    }

    it("shows the options sorted by id, with the right placeholder", () => {
        open();
        expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual([
            "BTC",
            "BTS",
            "ETH",
            "USDT"
        ]);
    });

    it("reports the chosen asset object", () => {
        const onSelect = jest.fn();
        const onChange = jest.fn();
        open({onSelect, onChange});
        fireEvent.click(screen.getByRole("option", {name: "ETH"}));
        expect(onSelect).toHaveBeenCalledWith({
            id: "ETH",
            label: "ETH",
            gateway: "GDEX",
            gateFee: undefined,
            issuer: "1.2.96397"
        });
        expect(onChange).toHaveBeenCalledWith("ETH");
    });

    it("says so when no gateway offers anything", () => {
        open({backedCoins: [], includeBTS: false});
        const option = screen.getByRole("option");
        expect(option.textContent).toBe(
            (counterpart as any).translate("modal.withdraw.no_assets")
        );
    });

    it("uses the deposit wording for deposits", () => {
        open({backedCoins: [], includeBTS: false, usageContext: "deposit"});
        expect(screen.getByRole("option").textContent).toBe(
            (counterpart as any).translate("modal.deposit.no_assets")
        );
    });
});
