import * as React from "react";
import {render, act, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {encodeProposal} from "../../../mcp/src/proposal";
import {
    CANCEL_OPS,
    CHAIN,
    NOW,
    makeProposal,
    sha256Hex
} from "../utils/mcpProposal";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({useNavigate: () => mockNavigate}));

let mockMe: any = {
    name: "alice",
    account: {state: "ok", value: {id: "1.2.100", name: "alice"}}
};
jest.mock("../../components/Advanced/fields", () => ({
    useCurrentAccount: () => mockMe,
    idOf: (lookup: any) => (lookup.state === "ok" ? lookup.value.id : null)
}));

const mockActions = {
    chainId: jest.fn(),
    sha256Hex: (text: string) => sha256Hex(text),
    getAssets: jest.fn(),
    getTicker: jest.fn(),
    getOrder: jest.fn(),
    send: jest.fn()
};
jest.mock("../../actions/McpReviewActions", () => ({
    __esModule: true,
    default: {
        chainId: (...a: any[]) => mockActions.chainId(...a),
        sha256Hex: (t: string) => mockActions.sha256Hex(t),
        getAssets: (...a: any[]) => mockActions.getAssets(...a),
        getTicker: (...a: any[]) => mockActions.getTicker(...a),
        getOrder: (...a: any[]) => mockActions.getOrder(...a),
        send: (...a: any[]) => mockActions.send(...a)
    }
}));

import McpReviewPage from "../../components/Mcp/McpReviewPage";

const ASSETS = {
    "1.3.0": {id: "1.3.0", symbol: "BTS", precision: 5},
    "1.3.121": {id: "1.3.121", symbol: "USD", precision: 4}
};
const MARKET = {latest: "830", lowest_ask: "840", highest_bid: "828"};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    mockMe = {
        name: "alice",
        account: {state: "ok", value: {id: "1.2.100", name: "alice"}}
    };
    mockActions.chainId.mockReturnValue(CHAIN);
    mockActions.getAssets.mockImplementation(async (ids: string[]) => {
        const out: any = {};
        ids.forEach(id => {
            if ((ASSETS as any)[id]) out[id] = (ASSETS as any)[id];
        });
        return out;
    });
    mockActions.getTicker.mockResolvedValue(MARKET);
    mockActions.getOrder.mockResolvedValue({
        id: "1.7.500",
        seller: "1.2.100",
        for_sale: 10000000,
        sell_price: {
            base: {amount: 10000000, asset_id: "1.3.0"},
            quote: {amount: 12000, asset_id: "1.3.121"}
        }
    });
    mockActions.send.mockResolvedValue({});
});

afterEach(() => {
    (Date.now as any).mockRestore();
    window.history.pushState({}, "", "/");
});

const open = (proposal?: any, raw?: string) => {
    const text =
        raw !== undefined ? raw : proposal ? encodeProposal(proposal) : "";
    window.history.pushState(
        {},
        "",
        "/mcp/review" + (text ? "#p=" + text : "")
    );
};

const flush = async () => {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
        });
    }
};

const signButton = (c: HTMLElement) =>
    Array.from(c.querySelectorAll("button")).find(b =>
        /Sign with my wallet/.test(b.textContent || "")
    ) as HTMLButtonElement;

describe("the review page", () => {
    it("says so when the link holds nothing, or something it cannot use", async () => {
        open();
        const empty = render(<McpReviewPage />);
        expect(empty.container.textContent).toContain(
            "No transaction in this link"
        );
        empty.unmount();
        open(undefined, "AAAA");
        const bad = render(<McpReviewPage />);
        expect(bad.container.textContent).toContain("This link cannot be used");
        expect(bad.container.textContent).toContain("not_json");
        expect(signButton(bad.container)).toBeUndefined();
    });

    it("shows the order in words made from the operation, the reference it computed, and the checks", async () => {
        const proposal = makeProposal();
        open(proposal);
        const {container} = render(<McpReviewPage />);
        await flush();
        const text = container.textContent || "";
        expect(text).toContain(
            "An AI assistant prepared this. Nothing has been signed or sent."
        );
        expect(text).toContain(
            "Sell 100.00000 BTS for at least 0.1205 USD (829.87552 BTS per USD)"
        );
        expect(text).toContain("alice (1.2.100)");
        expect(text).toContain(proposal.ref);
        expect(text).toContain("Valid for 6 more minutes.");
        expect(text).toContain(
            "It is for the chain this application is connected to."
        );
        expect(text).toContain(
            "It is for alice, the account that is signed in."
        );
        expect(text).toMatch(
            /The price is \d+\.\d+% below the market's \(834 BTS \/ USD\)/
        );
        expect(signButton(container).disabled).toBe(false);
    });

    it("signs through the wallet only when the button is pressed, once, with the operation's own fields", async () => {
        open(makeProposal());
        const {container} = render(<McpReviewPage />);
        await flush();
        expect(mockActions.send).not.toHaveBeenCalled();
        fireEvent.click(signButton(container));
        await flush();
        expect(mockActions.send).toHaveBeenCalledTimes(1);
        const [name, fields] = mockActions.send.mock.calls[0];
        expect(name).toBe("limit_order_create");
        expect(fields).toMatchObject({
            seller: "1.2.100",
            amount_to_sell: {amount: "10000000", asset_id: "1.3.0"},
            min_to_receive: {amount: "1205", asset_id: "1.3.121"},
            expiration: "2026-10-21T21:31:15",
            fill_or_kill: false
        });
        expect(container.textContent).toContain(
            "Your wallet signed it and it was sent to the chain."
        );
        // signed: the button cannot be pressed again
        expect(signButton(container).disabled).toBe(true);
        expect(container.textContent).toContain("Go to my portfolio");
    });

    it("shows the reason when the wallet refuses, and stays open", async () => {
        mockActions.send.mockRejectedValue(new Error("Insufficient balance"));
        open(makeProposal());
        const {container} = render(<McpReviewPage />);
        await flush();
        fireEvent.click(signButton(container));
        await flush();
        expect(container.textContent).toContain("Insufficient balance");
        expect(signButton(container).disabled).toBe(false);
    });

    it("refuses a link whose operations were changed: the reference shown is the computed one", async () => {
        const original = makeProposal();
        const tampered = JSON.parse(JSON.stringify(original));
        tampered.ops[0][1].min_to_receive.amount = "1"; // the old reference stays in the link
        open(tampered);
        const {container} = render(<McpReviewPage />);
        await flush();
        const text = container.textContent || "";
        expect(text).toContain("the link was changed. Do not sign.");
        expect(text).not.toContain(original.ref);
        expect(signButton(container).disabled).toBe(true);
        fireEvent.click(signButton(container));
        expect(mockActions.send).not.toHaveBeenCalled();
    });

    it("refuses an expired proposal, another chain and another account", async () => {
        const proposal = makeProposal();
        open(proposal);
        (Date.now as any).mockReturnValue(Date.parse("2026-10-20T21:42:00Z"));
        const expired = render(<McpReviewPage />);
        await flush();
        expect(expired.container.textContent).toContain(
            "This proposal has expired."
        );
        expect(signButton(expired.container).disabled).toBe(true);
        expired.unmount();

        (Date.now as any).mockReturnValue(NOW);
        mockActions.chainId.mockReturnValue("f".repeat(64));
        const chain = render(<McpReviewPage />);
        await flush();
        expect(chain.container.textContent).toContain("another chain");
        expect(signButton(chain.container).disabled).toBe(true);
        chain.unmount();

        mockActions.chainId.mockReturnValue(CHAIN);
        mockMe = {
            name: "bob",
            account: {state: "ok", value: {id: "1.2.7", name: "bob"}}
        };
        const other = render(<McpReviewPage />);
        await flush();
        expect(other.container.textContent).toContain(
            "It is for alice, but bob is signed in."
        );
        expect(signButton(other.container).disabled).toBe(true);
        expect(mockActions.send).not.toHaveBeenCalled();
    });

    it("blocks a price far above the market until the person says they have read it", async () => {
        const proposal = makeProposal();
        proposal.ops[0][1].min_to_receive.amount = "1000";
        // keep the reference honest for the changed operation
        const honest = makeProposal({ops: proposal.ops});
        open(honest);
        const {container} = render(<McpReviewPage />);
        await flush();
        expect(container.textContent).toMatch(
            /pays \d+\.\d+% more than the market asks/
        );
        expect(signButton(container).disabled).toBe(true);
        const box = container.querySelector(
            'input[type="checkbox"]'
        ) as HTMLInputElement;
        fireEvent.click(box);
        await flush();
        expect(signButton(container).disabled).toBe(false);
    });

    it("waits for the market, and treats a missing price as something to acknowledge", async () => {
        mockActions.getTicker.mockResolvedValue({
            latest: "0",
            lowest_ask: "0",
            highest_bid: "0"
        });
        open(makeProposal());
        const {container} = render(<McpReviewPage />);
        await flush();
        expect(container.textContent).toContain(
            "The market has no price to compare with."
        );
        expect(signButton(container).disabled).toBe(true);
    });

    it("an asset the chain does not know blocks signing", async () => {
        mockActions.getAssets.mockResolvedValue({"1.3.0": ASSETS["1.3.0"]});
        open(makeProposal());
        const {container} = render(<McpReviewPage />);
        await flush();
        expect(container.textContent).toContain(
            "An asset in it is not known to the chain."
        );
        expect(signButton(container).disabled).toBe(true);
    });

    it("a cancellation shows the order and signs it; one that is gone cannot be signed", async () => {
        const cancel = makeProposal({ops: CANCEL_OPS});
        open(cancel);
        const first = render(<McpReviewPage />);
        await flush();
        const text = first.container.textContent || "";
        expect(text).toContain("Cancel the open order 1.7.500: 100.00000 BTS");
        expect(text).toContain("The order is open and belongs to alice.");
        fireEvent.click(signButton(first.container));
        await flush();
        expect(mockActions.send.mock.calls[0][0]).toBe("limit_order_cancel");
        expect(mockActions.send.mock.calls[0][1]).toMatchObject({
            fee_paying_account: "1.2.100",
            order: "1.7.500"
        });
        first.unmount();

        mockActions.send.mockClear();
        mockActions.getOrder.mockResolvedValue(null);
        const second = render(<McpReviewPage />);
        await flush();
        expect(second.container.textContent).toContain(
            "That order is not open any more."
        );
        expect(signButton(second.container).disabled).toBe(true);
    });
});
