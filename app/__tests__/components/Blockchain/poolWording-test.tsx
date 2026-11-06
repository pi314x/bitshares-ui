// The transactions of a block carry no operation results (the node answers `[]`): the explorer's
// recent activity wordings that read what was paid and received threw, and the page said "Unknown
// operation 63" beside "EXCHANGE LIQUIDITY". Without the result an operation says what it offered.
jest.mock("../../../components/Utility/HelpContent", () => () => null);
jest.mock("../../../components/Utility/FormattedAsset", () => ({
    __esModule: true,
    default: ({amount, asset}: any) => <span>{`${amount} of ${asset}`}</span>
}));
jest.mock("../../../components/Utility/LinkToAssetById", () => ({
    __esModule: true,
    default: () => null
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
import {DefaultOperation} from "../../../components/Blockchain/operations/DefaultOperation";
import localeEn from "../../../assets/locales/locale-en.json";

const id = (name: string) => (ChainTypes as any).operations[name];
const fee = {amount: 100, asset_id: "1.3.0"};
const BTS = "1.3.0";
const XYZ = "1.3.120";

const exchange = {
    fee,
    account: "1.2.9",
    pool: "1.19.59",
    amount_to_sell: {amount: 287642574, asset_id: BTS},
    min_to_receive: {amount: 26420, asset_id: XYZ},
    extensions: []
};
const withdraw = {
    fee,
    account: "1.2.9",
    pool: "1.19.59",
    share_amount: {amount: 5000, asset_id: "1.3.900"},
    extensions: []
};
const deposit = {
    fee,
    account: "1.2.9",
    pool: "1.19.59",
    amount_a: {amount: 100, asset_id: BTS},
    amount_b: {amount: 200, asset_id: XYZ},
    extensions: []
};

const wording = new (OperationAnt as any)();
const words = (node: HTMLElement) =>
    (node.textContent || "").replace(/\s+/g, " ").trim();
const line = (name: string, data: any, result?: any) => {
    const described = wording.getColumn(
        [id(name), data],
        "1.2.9",
        1,
        result,
        new Map()
    );
    expect(described.unknown).toBe(false);
    return words(render(<span>{described.column}</span>).container);
};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("liquidity pool operations in a block (no result)", () => {
    it("an exchange says what it offered", () => {
        const text = line("liquidity_pool_exchange", exchange, undefined);
        expect(text).toContain("offered 287642574 of 1.3.0");
        expect(text).toContain("for at least 26420 of 1.3.120");
        expect(text).toContain("1.19.59");
    });

    it("an exchange from an account's history says what was exchanged", () => {
        const text = line("liquidity_pool_exchange", exchange, [
            2,
            {
                paid: [{amount: 287642574, asset_id: BTS}],
                received: [{amount: 26500, asset_id: XYZ}],
                fees: []
            }
        ]);
        expect(text).toContain("exchanged 287642574 of 1.3.0");
        expect(text).toContain("for 26500 of 1.3.120");
    });

    it("a withdrawal says how many shares were withdrawn", () => {
        expect(line("liquidity_pool_withdraw", withdraw, [0, {}])).toContain(
            "withdrew 5000 of 1.3.900 from liquidity pool 1.19.59"
        );
    });

    it("a deposit names the amounts of the operation", () => {
        const text = line("liquidity_pool_deposit", deposit, undefined);
        expect(text).toContain("100 of 1.3.0");
        expect(text).toContain("200 of 1.3.120");
    });

    it('is not "Unknown operation" in the default view', () => {
        const {container} = render(
            <DefaultOperation
                op={[id("liquidity_pool_exchange"), exchange]}
                result={undefined}
            />
        );
        expect(words(container)).not.toContain("Unknown operation");
        expect(words(container)).toContain("offered");
    });
});
