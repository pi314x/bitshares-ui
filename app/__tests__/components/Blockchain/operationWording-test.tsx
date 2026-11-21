// HelpContent uses webpack's `require.context`, which Jest does not have
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import "../../../lib/chain/extraOperations";
import * as React from "react";
import {render} from "@testing-library/react";
import counterpart from "counterpart";
import {ChainTypes} from "bitsharesjs";
import OperationAnt from "../../../components/Blockchain/OperationAnt";
import {
    genericOperationRows,
    humanize
} from "../../../components/Blockchain/operations/GenericRows";
import localeEn from "../../../assets/locales/locale-en.json";

const wording = new (OperationAnt as any)();
const id = (name: string) => (ChainTypes as any).operations[name];
const fee = {amount: 100, asset_id: "1.3.0"};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("the history wording of the operation types added later", () => {
    const samples: Array<[string, any]> = [
        [
            "committee_member_update",
            {
                fee,
                committee_member: "1.5.3",
                committee_member_account: "1.2.9",
                extensions: []
            }
        ],
        ["assert", {fee, fee_paying_account: "1.2.9", predicates: []}],
        ["blind_transfer", {fee, inputs: [1], outputs: [1, 2]}],
        [
            "custom_authority_create",
            {fee, account: "1.2.9", operation_type: 0, enabled: true}
        ],
        [
            "custom_authority_update",
            {fee, account: "1.2.9", authority_to_update: "1.17.2"}
        ],
        [
            "custom_authority_delete",
            {fee, account: "1.2.9", authority_to_delete: "1.17.2"}
        ],
        [
            "ticket_update",
            {fee, ticket: "1.18.4", account: "1.2.9", target_type: 2}
        ],
        [
            "liquidity_pool_update",
            {fee, account: "1.2.9", pool: "1.19.3", taker_fee_percent: 20}
        ],
        [
            "credit_deal_update",
            {fee, account: "1.2.9", deal_id: "1.22.8", auto_repay: 1}
        ],
        [
            "limit_order_update",
            {
                fee,
                seller: "1.2.9",
                order: "1.7.77",
                new_expiration: "2030-01-01T00:00:00"
            }
        ]
    ];

    samples.forEach(([name, data]) => {
        it(`words ${name}`, () => {
            expect(id(name)).toBeDefined();
            const described = wording.getColumn([id(name), data], "x", 1, [
                0,
                {}
            ]);
            expect(described.unknown).toBe(false);
            expect(described.column).toBeTruthy();
        });
    });

    it("still says nothing for a type it does not know", () => {
        expect(wording.getColumn([999, {fee}], "x", 1, [0, {}]).unknown).toBe(
            true
        );
    });
});

describe("the labels of the operation types", () => {
    it("exist for every operation bitsharesjs and the extra registration know", () => {
        const labels = (localeEn as any).transaction.trxTypes;
        const missing = Object.keys((ChainTypes as any).operations).filter(
            name => !labels[name]
        );
        expect(missing).toEqual([]);
    });
});

describe("genericOperationRows", () => {
    const helpers = {
        linkToAccount: (a: string) => <span data-kind="account">{a}</span>,
        linkToAsset: (a: string) => <span data-kind="asset">{a}</span>
    };

    it("humanizes a field name", () => {
        expect(humanize("new_taker_fee_percent")).toBe("New taker fee percent");
    });

    it("shows each field in the form of its kind and leaves out the fee and empty sets", () => {
        const rows = genericOperationRows(
            {
                fee,
                account: "1.2.9",
                asset: "1.3.121",
                amount: {amount: 5, asset_id: "1.3.0"},
                when: "2030-01-01T00:00:00",
                enabled: true,
                note: "hello",
                extensions: []
            },
            helpers
        );
        const {container} = render(
            <table>
                <tbody>{rows}</tbody>
            </table>
        );
        const labels = Array.from(container.querySelectorAll("tr")).map(
            tr => tr.querySelector("td")?.textContent
        );
        expect(labels).toEqual([
            "Account",
            "Asset",
            "Amount",
            "When",
            "Enabled",
            "Note"
        ]);
        expect(
            container.querySelector('[data-kind="account"]')?.textContent
        ).toBe("1.2.9");
        expect(
            container.querySelector('[data-kind="asset"]')?.textContent
        ).toBe("1.3.121");
        expect(container.textContent).toContain("true");
        expect(container.textContent).toContain("hello");
        expect(container.textContent).toContain("2030-01-01");
    });
});
