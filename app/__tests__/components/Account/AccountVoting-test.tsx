// Regression: the TypeScript port dropped the original
// `static defaultProps = {globalObject: "2.0.0"}`, so every voting page
// called `ChainStore.getObject(undefined)`, which throws - and an uncaught
// render error unmounts the whole app. Found by booting the built bundle
// against a real node (docs/UI_MIGRATION_PLAN.md, section 7.4).
import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

const mockGetObject = jest.fn(() => null);
const mockGetAccount = jest.fn(() => null);

jest.mock("bitsharesjs", () => {
    const actual = jest.requireActual("bitsharesjs");
    return {
        ...actual,
        ChainStore: {
            ...actual.ChainStore,
            getObject: (...args: any[]) => (mockGetObject as any)(...args),
            getAccount: (...args: any[]) => (mockGetAccount as any)(...args),
            subscribe: jest.fn(),
            unsubscribe: jest.fn()
        }
    };
});

// Heavy children that need webpack-only features (`require.context` in
// HelpContent) or a live chain; the container logic under test does not
// depend on them.
jest.mock("../../../components/Account/Voting/Witnesses", () => () => null);
jest.mock("../../../components/Account/Voting/Committee", () => () => null);
jest.mock("../../../components/Account/Voting/Workers", () => () => null);
jest.mock("../../../components/Modal/CreateLockModal", () => () => null);
jest.mock("../../../components/Account/AccountSelector", () => () => null);

import AccountVoting from "../../../components/Account/AccountVoting";

describe("AccountVoting container", () => {
    it("asks the chain store for the global properties object (2.0.0) when no globalObject prop is given", () => {
        render(
            <MemoryRouter>
                <AccountVoting
                    account="committee-account"
                    proxy="1.2.5"
                    initialBudget="2.13.1"
                />
            </MemoryRouter>
        );
        const ids = (mockGetObject.mock.calls as any[][]).map(call => call[0]);
        expect(ids).toContain("2.0.0");
        expect(ids).not.toContain(undefined);
    });
});
