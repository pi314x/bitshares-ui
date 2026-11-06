import {
    LOCAL_STEP_ORDER,
    describeLocalStep,
    getLocalSteps,
    reportLocalStep,
    resetLocalSteps,
    subscribeLocalSteps
} from "../../lib/common/startupProgress";
import localeEn from "../../assets/locales/locale-en.json";

beforeEach(() => resetLocalSteps());

describe("the local data steps", () => {
    it("start with nothing read", () => {
        const steps = getLocalSteps();
        LOCAL_STEP_ORDER.forEach(id =>
            expect(steps[id]).toEqual({state: "pending"})
        );
    });

    it("record how a step stands and tell the listeners", () => {
        const listener = jest.fn();
        const stop = subscribeLocalSteps(listener);
        reportLocalStep("keys", "done", {count: 3});
        expect(getLocalSteps().keys).toEqual({state: "done", count: 3});
        expect(getLocalSteps().wallet).toEqual({state: "pending"});
        expect(listener).toHaveBeenCalledTimes(1);
        stop();
        reportLocalStep("keys", "none");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("start over", () => {
        reportLocalStep("accounts", "done", {count: 2});
        resetLocalSteps();
        expect(getLocalSteps().accounts).toEqual({state: "pending"});
    });
});

describe("describeLocalStep", () => {
    const IDS: any[] = ["database", "settings", "keys", "wallet", "accounts"];

    it("keeps one line for a step whatever state it is in, and a line of its own for a failure", () => {
        IDS.forEach(id => {
            const lines = [
                {state: "pending"},
                {state: "active"},
                {state: "done", count: 3, name: "x"},
                {state: "none", password: true}
            ].map(step => describeLocalStep(id, step as any).key);
            expect(new Set(lines).size).toBe(1);
            expect(lines[0]).toBe(`app_init.local.${id}`);
            expect(describeLocalStep(id, {state: "failed"}).key).toBe(
                `app_init.local.${id}_failed`
            );
        });
    });

    it("has a locale string for every line", () => {
        IDS.forEach(id => {
            const local = (localeEn as any).app_init.local;
            expect(local[id]).toBeTruthy();
            expect(local[`${id}_failed`]).toBeTruthy();
            // no trailing dots: the line is not "in progress" words that stop being true
            expect(local[id]).not.toMatch(/\.\.\.$/);
        });
    });
});
