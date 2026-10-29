import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import counterpart from "counterpart";
import CopyIconButton from "../../../components/Utility/CopyIconButton";
import {copyText} from "../../../lib/common/clipboard";
import localeEn from "../../../assets/locales/locale-en.json";

jest.mock("../../../lib/common/clipboard", () => ({copyText: jest.fn()}));
const copy = copyText as jest.Mock;

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.useFakeTimers();
    copy.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

const press = async (button: HTMLElement) => {
    await act(async () => {
        fireEvent.click(button);
    });
};

describe("CopyIconButton", () => {
    it("copies the text and says so, then goes back", async () => {
        copy.mockResolvedValue(true);
        render(<CopyIconButton text="1.11.1400657532" />);
        const button = screen.getByRole("button", {
            name: "Copy to clipboard: 1.11.1400657532"
        });

        await press(button);
        expect(copy).toHaveBeenCalledWith("1.11.1400657532");
        expect(
            screen.getByRole("button", {name: "Copied: 1.11.1400657532"})
        ).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(1600);
        });
        expect(
            screen.getByRole("button", {
                name: "Copy to clipboard: 1.11.1400657532"
            })
        ).toBeTruthy();
    });

    it("says so when the browser refuses", async () => {
        copy.mockResolvedValue(false);
        render(<CopyIconButton text="1.11.5" />);
        await press(screen.getByRole("button"));
        expect(
            screen.getByRole("button", {
                name: "Could not copy - try again: 1.11.5"
            })
        ).toBeTruthy();
    });

    it("does not click the row it sits in", async () => {
        copy.mockResolvedValue(true);
        const rowClick = jest.fn();
        render(
            <div onClick={rowClick}>
                <CopyIconButton text="1.11.5" />
            </div>
        );
        await press(screen.getByRole("button"));
        expect(rowClick).not.toHaveBeenCalled();
    });
});
