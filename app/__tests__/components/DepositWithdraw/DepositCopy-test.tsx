import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
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

import {
    CopyOnTap,
    CopyTextButton,
    CopyableQr,
    DepositField
} from "../../../components/DepositWithdraw/DepositCopy";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,QR";
});

beforeEach(() => {
    mockCopyText.mockReset();
    mockCopyImage.mockReset();
    mockCanCopyImage.mockReset();
    mockCanCopyImage.mockReturnValue(false);
});

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
    });

describe("CopyTextButton", () => {
    it("copies the text and says it did", async () => {
        mockCopyText.mockResolvedValue(true);
        render(<CopyTextButton text="bts-address" label="copy_address" />);
        fireEvent.click(screen.getByRole("button", {name: "Copy address"}));
        await flush();
        expect(mockCopyText).toHaveBeenCalledWith("bts-address");
        expect(document.body.textContent).toContain("Copied");
    });

    it("says so when it could not copy", async () => {
        mockCopyText.mockResolvedValue(false);
        render(<CopyTextButton text="x" label="copy_memo" />);
        fireEvent.click(screen.getByRole("button", {name: "Copy memo"}));
        await flush();
        expect(document.body.textContent).toContain("Could not copy");
    });
});

describe("CopyableQr", () => {
    it("shows the code as an image, which can be pressed and held on a phone", async () => {
        render(<CopyableQr value="bitcoin:abc" />);
        await flush();
        const img = document.querySelector("img") as HTMLImageElement;
        expect(img.getAttribute("src")).toBe("data:image/png;base64,QR");
        // where the clipboard cannot take an image: save it, and say how to copy it
        expect(screen.getByRole("button", {name: "Save QR code"})).toBeTruthy();
        expect(document.body.textContent).toContain("press and hold");
    });

    it("copies the image where the browser can, and offers the file too", async () => {
        mockCanCopyImage.mockReturnValue(true);
        mockCopyImage.mockResolvedValue("copied");
        render(<CopyableQr value="bitcoin:abc" />);
        await flush();
        fireEvent.click(screen.getByRole("button", {name: "Copy QR code"}));
        await flush();
        expect(mockCopyImage).toHaveBeenCalledWith(
            "data:image/png;base64,QR",
            "deposit-qr.png"
        );
        expect(document.body.textContent).toContain("Copied");
        expect(screen.getByRole("button", {name: "Save QR code"})).toBeTruthy();
    });
});

describe("CopyOnTap", () => {
    it("copies its text when it is clicked or touched, and says so", async () => {
        mockCopyText.mockResolvedValue(true);
        render(
            <CopyOnTap text="bts-address-123">
                <b>bts-address-123</b>
            </CopyOnTap>
        );
        fireEvent.click(screen.getByRole("button"));
        await flush();
        expect(mockCopyText).toHaveBeenCalledWith("bts-address-123");
        expect(document.body.textContent).toContain("Copied");
    });

    it("copies with the keyboard (Enter and Space)", async () => {
        mockCopyText.mockResolvedValue(true);
        render(<CopyOnTap text="memo-42">memo-42</CopyOnTap>);
        const target = screen.getByRole("button");
        fireEvent.keyDown(target, {key: "Enter"});
        fireEvent.keyDown(target, {key: " "});
        fireEvent.keyDown(target, {key: "a"});
        await flush();
        expect(mockCopyText).toHaveBeenCalledTimes(2);
    });

    it("says so when it could not copy", async () => {
        mockCopyText.mockResolvedValue(false);
        render(<CopyOnTap text="x">x</CopyOnTap>);
        fireEvent.click(screen.getByRole("button"));
        await flush();
        expect(document.body.textContent).toContain("Could not copy");
    });
});

describe("the QR code, tapped", () => {
    it("copies the image where the browser can", async () => {
        mockCanCopyImage.mockReturnValue(true);
        mockCopyImage.mockResolvedValue("copied");
        render(<CopyableQr value="bitcoin:abc" />);
        await flush();
        fireEvent.click(document.querySelector("img") as HTMLImageElement);
        await flush();
        expect(mockCopyImage).toHaveBeenCalledTimes(1);
        expect(mockCopyText).not.toHaveBeenCalled();
    });

    it("copies the address it holds where an image cannot be copied (plain http)", async () => {
        mockCanCopyImage.mockReturnValue(false);
        mockCopyText.mockResolvedValue(true);
        render(<CopyableQr value="bitcoin:abc" />);
        await flush();
        fireEvent.click(document.querySelector("img") as HTMLImageElement);
        await flush();
        expect(mockCopyText).toHaveBeenCalledWith("bitcoin:abc");
        expect(mockCopyImage).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain("Copied");
        expect(document.body.textContent).toContain("copy the address");
    });
});

describe("DepositField", () => {
    beforeEach(() => mockCopyText.mockReset());

    it("shows what it is above the value, with a button that copies the value", async () => {
        mockCopyText.mockResolvedValue(true);
        render(
            <DepositField
                label="A sent to this address will show up as XBTSX.A"
                value="xbtsiowallet"
            />
        );
        expect(
            screen.getByText("A sent to this address will show up as XBTSX.A")
        ).toBeTruthy();
        expect(screen.getByText("xbtsiowallet")).toBeTruthy();
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", {
                    name: "Copy to clipboard: xbtsiowallet"
                })
            );
        });
        expect(mockCopyText).toHaveBeenCalledWith("xbtsiowallet");
    });
});
