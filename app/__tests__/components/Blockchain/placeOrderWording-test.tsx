// What a place-order line in the activity list and in the transaction view says:
// the order, the price, and what it comes to - the BTS a buy order puts up, what
// a sell order asks for.

// HelpContent uses webpack's `require.context`, which Jest does not have
jest.mock("../../../components/Utility/HelpContent", () => () => null);

// The assets come from the chain; here an asset is its id and a symbol.
jest.mock("../../../components/Utility/BindToChainState", () => {
    const {Map} = jest.requireActual("immutable");
    const symbols: Record<string, string> = {
        "1.3.0": "BTS",
        "1.3.5000": "HIVE"
    };
    const asset = (id: string) => Map({id, symbol: symbols[id], precision: 5});
    const Wrapper = ({base, quote, children}: any) =>
        children({base: asset(base), quote: asset(quote)});
    return {__esModule: true, default: {Wrapper}};
});
jest.mock("../../../components/Utility/FormattedAsset", () => ({
    __esModule: true,
    default: ({amount, asset}: any) => <span>{`${amount} of ${asset}`}</span>
}));
jest.mock("../../../components/Utility/FormattedPrice", () => ({
    __esModule: true,
    default: () => <span>price</span>
}));
jest.mock("../../../components/Utility/LinkToAssetById", () => ({
    __esModule: true,
    default: ({asset}: any) => <span>{asset}</span>
}));
jest.mock("../../../components/Utility/LinkToAccountById", () => ({
    __esModule: true,
    default: ({account}: any) => <span>{account}</span>
}));

import "../../../lib/chain/extraOperations";
import * as React from "react";
import {render} from "@testing-library/react";
import counterpart from "counterpart";
import {ChainTypes} from "bitsharesjs";
import OperationAnt from "../../../components/Blockchain/OperationAnt";
import {LimitOrderCreate} from "../../../components/Blockchain/operations/LimitOrderCreate";
import localeEn from "../../../assets/locales/locale-en.json";
import localeDe from "../../../assets/locales/locale-de.json";

const fee = {amount: 100, asset_id: "1.3.0"};
const BTS = "1.3.0";
const HIVE = "1.3.5000";
const create = (ChainTypes as any).operations.limit_order_create;

// buy 1,722.39 HIVE for 86,431.77 BTS
const buy = {
    fee,
    seller: "1.2.9",
    amount_to_sell: {amount: 8643177000, asset_id: BTS},
    min_to_receive: {amount: 172239724, asset_id: HIVE},
    expiration: "2030-01-01T00:00:00",
    fill_or_kill: false,
    extensions: []
};
// sell 100 HIVE for at least 5,000 BTS
const sell = {
    ...buy,
    amount_to_sell: {amount: 10000, asset_id: HIVE},
    min_to_receive: {amount: 500000000, asset_id: BTS}
};

// one line of words (an amount and its asset are joined by a no-break space)
const words = (node: HTMLElement) =>
    (node.textContent || "").replace(/\s+/g, " ").trim();

const wording = new (OperationAnt as any)();
const activityLine = (data: any) =>
    words(
        render(
            wording.getColumn(
                [create, data],
                "1.2.9",
                1,
                [0, "1.7.575989026"],
                new Map()
            ).column
        ).container
    );
const detailLine = (data: any) =>
    words(
        render(
            <LimitOrderCreate
                op={[create, data]}
                changeColor={() => {}}
                fromComponent="transaction"
                marketDirections={new Map()}
                result={[0, "1.7.575989026"]}
            />
        ).container
    );

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).registerTranslations("de", localeDe);
    (counterpart as any).setLocale("en");
});

describe.each([
    ["the activity list", activityLine],
    ["the transaction view", detailLine]
])("a place-order line in %s", (_name, line) => {
    it("says how much BTS a buy order puts up", () => {
        const text = line(buy);
        expect(text).toContain("placed order #575989026 to buy");
        expect(text).toContain("172239724 of 1.3.5000"); // what it buys
        expect(text).toMatch(/ for 8643177000 of 1\.3\.0 1\.3\.0$/); // what it costs
    });

    it("says what a sell order asks for", () => {
        const text = line(sell);
        expect(text).toContain("to sell");
        expect(text).toContain("10000 of 1.3.5000");
        expect(text).toMatch(/ for 500000000 of 1\.3\.0 1\.3\.0$/);
    });

    it("says it in the language of the page", () => {
        (counterpart as any).setLocale("de");
        try {
            expect(line(buy)).toMatch(/ für 8643177000 of 1\.3\.0 1\.3\.0$/);
        } finally {
            (counterpart as any).setLocale("en");
        }
    });
});
