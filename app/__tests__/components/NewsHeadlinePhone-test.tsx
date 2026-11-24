// The warning header (the rotating notices above the top bar) is not for a phone: it is three or four lines of a
// small screen. A phone is the shell's phone layout (up to 860px wide) or a screen so short it is held sideways;
// there the notices are neither drawn nor asked for. Elsewhere they are.
import * as React from "react";
import {render, act} from "@testing-library/react";

// (jsdom here has no MutationObserver, so `waitFor` cannot be used: let the request and the render settle with a timer)
const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
    });

const mockPhone = {value: false};
const mockQueries: string[] = [];
const mockGetNotifications = jest.fn();

jest.mock("../../next/hooks/useMediaQuery", () => ({
    __esModule: true,
    useMediaQuery: (query: string) => {
        mockQueries.push(query);
        return mockPhone.value;
    }
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: () => ({hiddenNewsHeadline: {size: 0, indexOf: () => -1}})
}));
jest.mock("../../store/slices/settingsSlice", () => ({
    __esModule: true,
    selectSettingsState: () => ({})
}));
jest.mock("actions/SettingsActions", () => ({
    __esModule: true,
    default: {hideNewsHeadline: jest.fn()}
}));
jest.mock("../../lib/chain/onChainConfig", () => ({
    __esModule: true,
    getNotifications: () => mockGetNotifications()
}));

import NewsHeadline, {PHONE_QUERY} from "../../components/Layout/NewsHeadline";
import {DESKTOP_QUERY} from "../../next/desktopModal";

const notice = {
    type: "warning",
    begin_date: "01.01.2020",
    end_date: "01.01.2099",
    content: "Never share your keys."
};

beforeEach(() => {
    mockPhone.value = false;
    mockQueries.length = 0;
    mockGetNotifications.mockReset();
    mockGetNotifications.mockResolvedValue([notice]);
});

describe("the warning header and the phone", () => {
    it("shows the notices where there is room", async () => {
        const {container} = render(<NewsHeadline />);
        await settle();
        expect(container.textContent).toContain("Never share your keys.");
        expect(container.querySelector(".git-info")).not.toBeNull();
        expect(mockGetNotifications).toHaveBeenCalledTimes(1);
    });

    it("draws nothing on a phone, and does not ask for the notices", async () => {
        mockPhone.value = true;
        const {container} = render(<NewsHeadline />);
        await settle();
        expect(container.innerHTML).toBe("");
        expect(mockGetNotifications).not.toHaveBeenCalled();
    });

    it("asks the media query for a phone, not for a desktop (a test has no matchMedia: that must not count as a phone)", async () => {
        render(<NewsHeadline />);
        await settle();
        expect(mockQueries).toContain(PHONE_QUERY);
        expect(mockQueries).not.toContain(DESKTOP_QUERY);
    });

    it("is the phone of the shell (up to 860px wide) and a phone held sideways (500px high at most)", () => {
        expect(PHONE_QUERY).toContain("(max-width: 860px)");
        expect(PHONE_QUERY).toContain("(max-height: 500px)");
        // the desktop query starts where the phone's ends: no width is both or neither
        expect(DESKTOP_QUERY).toBe("(min-width: 861px)");
    });
});
