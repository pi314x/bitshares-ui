import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";

let mockData: any;

jest.mock("../../../components/Dashboard/Desk/useDeskData", () => ({
    useDeskData: () => mockData
}));
jest.mock("../../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({defaults: {unit: ["BTS", "USD"]}, settings: {}})
}));
jest.mock("../../../actions/SettingsActions", () => ({
    __esModule: true,
    default: {changeSetting: jest.fn(), changeViewSetting: jest.fn()}
}));
jest.mock("../../../actions/AccountActions", () => ({
    __esModule: true,
    default: {setCurrentAccount: {defer: jest.fn()}}
}));
jest.mock("../../../components/Account/RecentTransactions", () => ({
    RecentTransactions: () => <div data-testid="recent" />
}));
jest.mock("../../../components/Dashboard/Desk/AllocationChart", () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="allocation">
            {props.parts.map((p: any) => `${p.label}=${p.value}`).join(",")}
        </div>
    )
}));
jest.mock("../../../components/Account/BalanceHistoryChart", () => ({
    CurrentAccountBalanceChart: () => <div data-testid="chart" />
}));

import SettingsActions from "../../../actions/SettingsActions";
import Desk from "../../../components/Dashboard/Desk/Desk";

const data = (overrides: any = {}) => ({
    loading: false,
    accountId: "1.2.10",
    unit: {id: "1.3.0", symbol: "BTS", precision: 5},
    total: 1234.5,
    parts: {
        wallet: 1000,
        pools: 200,
        orders: 34.5,
        settlements: 0,
        collateral: 0,
        debt: 0
    },
    holdings: [
        {
            assetId: "1.3.0",
            symbol: "BTS",
            precision: 5,
            units: 100000000,
            value: 1000,
            amount: 1000,
            share: 0.8
        },
        {
            assetId: "1.3.5",
            symbol: "JUNK",
            precision: 2,
            units: 500,
            value: null,
            amount: 5,
            share: null
        }
    ],
    unpriced: 1,
    orders: {count: 2, nextExpiryMs: null, expiringSoon: 0, value: 34.5},
    settlements: {count: 0, nextMs: null, value: null, items: []},
    positions: [],
    pools: [],
    attention: [],
    ...overrides
});

function renderDesk(names = ["alice"]) {
    return render(
        <MemoryRouter>
            <Desk
                accountName="alice"
                accountNames={names}
                markets={<div data-testid="markets" />}
            />
        </MemoryRouter>
    );
}

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    mockData = data();
});

describe("Desk", () => {
    it("shows the total, the holdings with a no-price mark, and the order count", () => {
        const {getByText, getAllByText} = renderDesk();
        expect(getByText("Total value")).toBeTruthy();
        expect(getByText("1,234.50")).toBeTruthy();
        expect(getByText("JUNK")).toBeTruthy();
        expect(getAllByText("no price").length).toBe(1);
        expect(getByText("2 open orders")).toBeTruthy();
        expect(getByText("1 without a price are not counted")).toBeTruthy();
    });

    describe("the holdings filter", () => {
        const many = (n: number) =>
            Array.from({length: n}, (_, i) => ({
                assetId: `1.3.${i + 10}`,
                symbol: i === 11 ? "XBTSX.USDT" : `COIN${i}`,
                precision: 4,
                units: 1000,
                value: 10,
                amount: 1,
                share: 0.01
            }));

        it("is there for a long list, not for a short one", () => {
            const short = renderDesk();
            expect(short.queryByPlaceholderText("Filter assets")).toBeNull();
            short.unmount();
            mockData = data({holdings: many(12)});
            const long = renderDesk();
            expect(long.getByPlaceholderText("Filter assets")).toBeTruthy();
        });

        it("looks through all of the holdings, not only the rows shown, ignoring case", () => {
            mockData = data({holdings: many(12)});
            const {
                getByPlaceholderText,
                queryByText,
                getAllByRole
            } = renderDesk();
            // the 12th holding is not among the first eight rows
            expect(queryByText("XBTSX.USDT")).toBeNull();
            fireEvent.change(getByPlaceholderText("Filter assets"), {
                target: {value: "usdt"}
            });
            expect(queryByText("XBTSX.USDT")).not.toBeNull();
            // the header row and the one holding that matches
            expect(
                getAllByRole("row").filter(row => row.querySelector("td"))
            ).toHaveLength(1);
        });

        it("says when nothing matches, and gives the list back when it is cleared", () => {
            mockData = data({holdings: many(12)});
            const {getByPlaceholderText, queryByText, getByText} = renderDesk();
            const field = getByPlaceholderText("Filter assets");
            fireEvent.change(field, {target: {value: "zzz"}});
            expect(getByText('No asset matches "zzz"')).toBeTruthy();
            fireEvent.change(field, {target: {value: ""}});
            expect(queryByText(/No asset matches/)).toBeNull();
            expect(queryByText("COIN0")).not.toBeNull();
        });
    });

    describe("settlements", () => {
        const item = (n: number, over: any = {}) => ({
            id: `1.4.${n}`,
            assetId: "1.3.5",
            symbol: n === 1 ? "USD" : `COIN${n}`,
            precision: 4,
            amount: 2.5,
            value: 500,
            dateMs: Date.UTC(2026, 9, 28 + n, 20, 0, 0),
            ...over
        });
        const settled = (items: any[]) => ({
            count: items.length,
            nextMs: items.length ? items[0].dateMs : null,
            value: items.length ? 500 * items.length : null,
            items
        });

        it("says there are none, without a button to open them", () => {
            const {getByText, queryAllByText} = renderDesk();
            expect(getByText("Settlements")).toBeTruthy();
            expect(getByText("No settlements waiting")).toBeTruthy();
            // only the open orders have an Open button, not the settlements
            expect(queryAllByText("Open").length).toBe(2);
        });

        it("lists a request with its amount, its worth in the unit and when it settles", () => {
            mockData = data({
                parts: {...data().parts, settlements: 500},
                settlements: settled([item(1)])
            });
            const {getByText, container} = renderDesk();
            expect(getByText("USD")).toBeTruthy();
            expect(getByText(/^2\.5\d* USD$/)).toBeTruthy();
            const row = getByText(/^2\.5\d* USD$/).parentElement as HTMLElement;
            expect(row.textContent).toContain("≈ 500.00 BTS");
            expect(row.textContent).toContain("settles ");
            // the part of the total
            expect(container.textContent).toContain("Settlements");
        });

        it("says no price for a request without one, and no date where the chain gives none", () => {
            mockData = data({
                settlements: settled([item(1, {value: null, dateMs: null})])
            });
            const {getByText} = renderDesk();
            const row = getByText(/^2\.5\d* USD$/).parentElement as HTMLElement;
            expect(row.textContent).toContain("no price");
            expect(row.textContent).not.toContain("settles ");
        });

        it("shows five and leads to the rest in the portfolio", () => {
            mockData = data({
                settlements: settled(
                    Array.from({length: 7}, (_, i) => item(i + 1))
                )
            });
            const {getByText, queryByText} = renderDesk();
            expect(queryByText("COIN6")).toBeNull();
            fireEvent.click(getByText("+2 more"));
            // the portfolio's open orders tab, where the settlements are listed too
            expect(SettingsActions.changeViewSetting).toHaveBeenCalledWith({
                overviewTab: 1
            });
        });

        it("counts in the summary, and in the allocation by place", () => {
            mockData = data({
                parts: {...data().parts, settlements: 500},
                settlements: settled([item(1)])
            });
            const {getByText, getByTestId} = renderDesk();
            fireEvent.click(getByText("Where it sits"));
            expect(getByTestId("allocation").textContent).toContain(
                "Settlements=500"
            );
        });
    });

    describe("the allocation card", () => {
        it("shows the holdings as parts of the whole, and where it sits when asked", () => {
            const {getByTestId, getByText} = renderDesk();
            expect(getByTestId("allocation").textContent).toBe(
                "BTS=1000,JUNK=null"
            );
            fireEvent.click(getByText("Where it sits"));
            expect(getByTestId("allocation").textContent).toContain(
                "Wallet=1000"
            );
            expect(getByTestId("allocation").textContent).toContain(
                "Open orders=34.5"
            );
        });
    });

    describe("the layout", () => {
        it("puts holdings and positions in one column and the allocation in the other, so neither leaves a hole", () => {
            const {getByText} = renderDesk(["alice", "bob"]);
            const column = (title: string) =>
                (getByText(title) as HTMLElement).closest('[class*="stack"]');
            expect(column("Holdings")).not.toBeNull();
            expect(column("Positions")).toBe(column("Holdings"));
            expect(column("Allocation")).not.toBeNull();
            expect(column("Allocation")).not.toBe(column("Holdings"));
            expect(column("Accounts")).toBe(column("Allocation"));
        });

        it("lets a holdings table wider than its card scroll sideways", () => {
            const {container} = renderDesk();
            const table = container.querySelector("table") as HTMLElement;
            expect((table.parentElement as HTMLElement).className).toContain(
                "tableScroll"
            );
        });
    });

    it("keeps the attention list to four and expands it", () => {
        mockData = data({
            attention: Array.from({length: 6}, (_, i) => ({
                key: `k${i}`,
                level: "info",
                kind: "expiring",
                params: {count: i + 1}
            }))
        });
        const {getAllByRole, getByText} = renderDesk();
        expect(getAllByRole("listitem")).toHaveLength(4);
        fireEvent.click(getByText("Show all (6)"));
        expect(getAllByRole("listitem")).toHaveLength(6);
    });

    it("hides a card from Customize and remembers it", () => {
        const first = renderDesk();
        expect(first.queryByText("Holdings")).not.toBeNull();
        fireEvent.click(first.getByText("Customize"));
        fireEvent.click(first.getByLabelText("Holdings"));
        expect(first.queryByRole("table")).toBeNull();
        expect(
            JSON.parse(
                window.localStorage.getItem("__graphene__deskCards") || "{}"
            ).holdings
        ).toBe(false);
        first.unmount();
        // a fresh render reads it back
        const second = renderDesk();
        expect(second.queryByRole("table")).toBeNull();
    });

    it("lists the accounts card only with more than one account", () => {
        const one = renderDesk(["alice"]);
        expect(one.queryByText("Accounts")).toBeNull();
        one.unmount();
        const two = renderDesk(["alice", "bob"]);
        expect(two.getAllByText("Accounts").length).toBeGreaterThan(0);
        expect(two.getByText("bob")).toBeTruthy();
    });

    it("badges a position at risk and says how far the price may fall", () => {
        mockData = data({
            positions: [
                {
                    input: {id: "1.8.1"},
                    risk: {
                        risk: "danger",
                        ratio: 1.9,
                        mcr: 1.75,
                        distance: 0.079
                    },
                    debtSymbol: "USD",
                    collateralSymbol: "BTS",
                    debt: 100,
                    collateral: 5000
                }
            ]
        });
        const {getByText} = renderDesk();
        expect(getByText("At risk")).toBeTruthy();
        expect(getByText(/ratio 1\.90/)).toBeTruthy();
        expect(getByText(/price may fall 8%/)).toBeTruthy();
    });
});
