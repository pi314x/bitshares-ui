import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import Block from "../../../components/Blockchain/Block";
import localeEn from "../../../assets/locales/locale-en.json";

const mockScrollTo = jest.fn();
const mockScrollToTop = jest.fn();
jest.mock("react-scroll", () => {
    const React = jest.requireActual("react");
    return {
        Element: ({children}: any) => <div>{children}</div>,
        Events: {scrollEvent: {register: jest.fn()}},
        animateScroll: {
            scrollToTop: (...args: any[]) => mockScrollToTop(...args)
        },
        scroller: {scrollTo: (...args: any[]) => mockScrollTo(...args)}
    };
});
jest.mock("actions/BlockchainActions", () => ({
    __esModule: true,
    default: {getBlock: jest.fn()}
}));
jest.mock("../../../components/Blockchain/Transaction", () => ({
    __esModule: true,
    default: () => <div />
}));
jest.mock("../../../components/Utility/LinkToWitnessById", () => ({
    __esModule: true,
    default: () => <span />
}));
jest.mock("../../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getObject: () =>
            jest.requireActual("immutable").Map({head_block_number: 500})
    }
}));

const block = {
    timestamp: "2026-10-30T08:57:45",
    witness: "1.6.1",
    previous: "00ab",
    transactions: [{operations: []}, {operations: []}]
};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
});
beforeEach(() => {
    mockScrollTo.mockClear();
    mockScrollToTop.mockClear();
});

/** The page as it is when the block has not arrived, then when it has. */
function open(scrollToIndex: number) {
    const props = {
        height: 100,
        match: {params: {height: "100"}},
        history: {push: jest.fn()},
        scrollToIndex
    };
    const view = render(<Block {...props} blocks={Immutable.Map()} />);
    view.rerender(<Block {...props} blocks={Immutable.Map([[100, block]])} />);
    return view;
}

describe("the block page, opened at a transaction", () => {
    it("scrolls to the transaction", () => {
        open(1);
        expect(mockScrollTo).toHaveBeenCalled();
        expect(mockScrollTo.mock.calls[0][0]).toBe("tx_1");
    });

    it("scrolls the page itself: the page is a document, and a container id would scroll an element that does not scroll", () => {
        open(1);
        expect(mockScrollTo.mock.calls[0][1]).not.toHaveProperty("containerId");
    });

    it("does not scroll when no transaction was asked for", () => {
        open(0);
        expect(mockScrollTo).not.toHaveBeenCalled();
    });
});
