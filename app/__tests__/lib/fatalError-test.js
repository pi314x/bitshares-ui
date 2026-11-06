import {
    installFatalErrorScreen,
    recordError,
    recordedErrors,
    showFatalError
} from "../../lib/common/fatalError";

describe("fatal error screen", () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="content"></main>';
    });

    it("shows what went wrong, with the browser, and can be shown once", () => {
        recordError(new TypeError("undefined is not a function"), "App.jsx:10");
        showFatalError(document);
        showFatalError(document);
        const boxes = document.querySelectorAll("#fatal-error");
        expect(boxes).toHaveLength(1);
        expect(boxes[0].textContent).toContain("BitShares could not start");
        expect(boxes[0].textContent).toContain("undefined is not a function");
        expect(boxes[0].textContent).toContain("App.jsx:10");
        expect(boxes[0].querySelectorAll("button")).toHaveLength(2);
    });

    it("keeps only the first few errors", () => {
        for (let i = 0; i < 12; i++) recordError(new Error("e" + i));
        expect(recordedErrors().length).toBeLessThanOrEqual(5);
    });

    it("shows the screen after an error only when the app is gone", () => {
        jest.useFakeTimers();
        const stop = installFatalErrorScreen(window, 100);
        const content = document.getElementById("content");
        content.innerHTML = "<div>app</div>";
        window.dispatchEvent(
            new ErrorEvent("error", {error: new Error("background task")})
        );
        jest.advanceTimersByTime(200);
        expect(document.getElementById("fatal-error")).toBeNull();

        content.innerHTML = ""; // React unmounted the tree
        window.dispatchEvent(
            new ErrorEvent("error", {error: new Error("render crash")})
        );
        jest.advanceTimersByTime(200);
        expect(document.getElementById("fatal-error")).not.toBeNull();
        stop();
        jest.useRealTimers();
    });
});
