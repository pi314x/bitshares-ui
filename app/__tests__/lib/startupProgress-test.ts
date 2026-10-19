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
    it("names a locale string for every line, and every one exists", () => {
        const cases: Array<[any, any]> = [
            ["settings", {state: "done"}],
            ["database", {state: "done"}],
            ["keys", {state: "done", count: 0}],
            ["keys", {state: "done", count: 4}],
            ["wallet", {state: "done", count: 1, name: "default"}],
            ["wallet", {state: "done", count: 3, name: "default"}],
            ["wallet", {state: "none"}],
            ["wallet", {state: "none", password: true}],
            ["accounts", {state: "done", count: 0}],
            ["accounts", {state: "done", count: 2}],
            ["accounts", {state: "done", count: 2, name: "johnr"}],
            ["settings", {state: "failed"}],
            ["keys", {state: "active"}]
        ];
        cases.forEach(([id, step]) => {
            const {key} = describeLocalStep(id, step);
            const entry = key.replace("app_init.local.", "");
            expect((localeEn as any).app_init.local[entry]).toBeTruthy();
        });
    });

    it("picks the line by what was found", () => {
        expect(describeLocalStep("keys", {state: "done", count: 0}).key).toBe(
            "app_init.local.keys_none"
        );
        expect(describeLocalStep("keys", {state: "done", count: 2}).key).toBe(
            "app_init.local.keys_some"
        );
        expect(
            describeLocalStep("wallet", {state: "none", password: true}).key
        ).toBe("app_init.local.wallet_password");
        expect(describeLocalStep("wallet", {state: "done", count: 2}).key).toBe(
            "app_init.local.wallet_several"
        );
        expect(
            describeLocalStep("accounts", {
                state: "done",
                count: 2,
                name: "johnr"
            }).key
        ).toBe("app_init.local.accounts_last");
    });
});
