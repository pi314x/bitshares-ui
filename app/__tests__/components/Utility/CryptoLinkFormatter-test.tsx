import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";

const mockCopyText = jest.fn();
const mockCopyImage = jest.fn();
const mockCanCopyImage = jest.fn();
jest.mock("../../../lib/common/clipboard", () => ({
    __esModule: true,
    copyText: (...a: any[]) => mockCopyText(...a),
    copyImage: (...a: any[]) => mockCopyImage(...a),
    canCopyImage: () => mockCanCopyImage(),
    saveImage: jest.fn().mockReturnValue(true)
}));
// a canvas is not drawn in this jsdom: the code is a stand-in
jest.mock("qrcode.react", () => {
    const react = jest.requireActual("react");
    return {__esModule: true, default: () => react.createElement("canvas")};
});

import CryptoLinkFormatter from "../../../components/Utility/CryptoLinkFormatter";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,QR";
});

beforeEach(() => {
    mockCopyText.mockReset();
    mockCopyImage.mockReset();
    mockCanCopyImage.mockReset();
});

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
    });

describe("CryptoLinkFormatter (the QR of the deposit screens)", () => {
    it("shows the code of an account (BTS) as an image that copies what it says on a tap", async () => {
        mockCanCopyImage.mockReturnValue(false);
        mockCopyText.mockResolvedValue(true);
        render(<CryptoLinkFormatter asset="BTS" address="alice" />);
        await flush();
        fireEvent.click(document.querySelector("img") as HTMLImageElement);
        await flush();
        expect(mockCopyText).toHaveBeenCalledWith("alice");
        expect(document.body.textContent).toContain("Copied");
    });

    it("copies the image where the browser can", async () => {
        mockCanCopyImage.mockReturnValue(true);
        mockCopyImage.mockResolvedValue("copied");
        render(<CryptoLinkFormatter asset="BTS" address="alice" />);
        await flush();
        fireEvent.click(document.querySelector("img") as HTMLImageElement);
        await flush();
        expect(mockCopyImage).toHaveBeenCalledTimes(1);
        expect(mockCopyText).not.toHaveBeenCalled();
    });

    it("codes an address of another asset as its link", async () => {
        mockCanCopyImage.mockReturnValue(false);
        mockCopyText.mockResolvedValue(true);
        render(<CryptoLinkFormatter asset="BTC" address="1abc" amount={2} />);
        await flush();
        fireEvent.click(document.querySelector("img") as HTMLImageElement);
        await flush();
        expect(mockCopyText).toHaveBeenCalledWith("bitcoin:1abc?amount=2");
    });

    it("shows nothing for an asset it has no link for", () => {
        const {container} = render(
            <CryptoLinkFormatter asset="NOPE" address="x" />
        );
        expect(container.textContent).toBe("");
    });
});
