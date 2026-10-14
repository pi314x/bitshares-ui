// Regression: `items` arrives as an Immutable.List of account ids, and the
// port tested `item_rows.length` on a List (undefined), so the witness and
// committee tables never rendered a single row.
import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";

const mockAccounts: Record<string, any> = {};
const mockWitnesses: Record<string, any> = {};

jest.mock("bitsharesjs", () => {
    const actual = jest.requireActual("bitsharesjs");
    return {
        ...actual,
        ChainStore: {
            ...actual.ChainStore,
            getObject: (id: string) => mockAccounts[id],
            getWitnessById: (id: string) => mockWitnesses[id],
            getCommitteeMemberById: () => undefined
        }
    };
});
jest.mock("../../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("components/Utility/PaginatedList", () => ({
    __esModule: true,
    default: function MockPaginatedList(props: any) {
        return (
            <div data-testid="rows">
                {props.rows.map((r: any) => r.name).join(",")}
            </div>
        );
    }
}));
jest.mock("../../../components/Utility/LinkToAccountById", () => () => null);
jest.mock("../../../components/Utility/FormattedAsset", () => () => null);
jest.mock("../../../components/Icon/Icon", () => () => null);
jest.mock("react-translate-component", () => () => null);

import VotingAccountsList from "../../../components/Account/VotingAccountsList";

function account(id: string, name: string) {
    return Immutable.Map({id, name});
}

describe("VotingAccountsList", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockAccounts)) delete mockAccounts[k];
        for (const k of Object.keys(mockWitnesses)) delete mockWitnesses[k];
        mockAccounts["1.2.10"] = account("1.2.10", "alice");
        mockAccounts["1.2.11"] = account("1.2.11", "bob");
        mockWitnesses["1.2.10"] = Immutable.Map({
            id: "1.6.1",
            url: "",
            total_votes: "500"
        });
        mockWitnesses["1.2.11"] = Immutable.Map({
            id: "1.6.2",
            url: "",
            total_votes: "900"
        });
    });

    const props = {
        type: "witness",
        items: Immutable.List(["1.2.10", "1.2.11", "1.2.12"]),
        supported: Immutable.List<string>(),
        active: Immutable.List(["1.6.1"]),
        onAddItem: jest.fn(),
        onRemoveItem: jest.fn()
    };

    it("renders a row per resolved account from an Immutable.List, most votes first", () => {
        const {getByTestId} = render(
            <VotingAccountsList {...(props as any)} />
        );
        // 1.2.12 is not loaded yet and is left out, not an error
        expect(getByTestId("rows").textContent).toBe("1.2.11,1.2.10");
    });

    it("does not throw while a witness object is still being looked up", () => {
        delete mockWitnesses["1.2.11"];
        const {getByTestId} = render(
            <VotingAccountsList {...(props as any)} />
        );
        expect(getByTestId("rows").textContent).toBe("1.2.10,1.2.11");
    });
});
