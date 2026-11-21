// Real Alt actions get a `.defer(...args)` method for free
// (`alt/src/actions/index.js`: `action.defer = (...args) => setTimeout(() =>
// action(...args))`), and a number of call sites use it
// (`SettingsActions.changeViewSetting.defer(...)`, ...). The Redux-backed
// action facades are plain class instances, so each one has to provide it
// itself; a missing `.defer` is a TypeError at the call site and, inside a
// render/effect, takes the whole app down (the Exchange did, see
// `__tests__/actions/defer-test.ts`).
//
// Binds every prototype method to the facade (so `Actions.method` can still
// be passed around as a plain function, as Alt actions could) and gives it
// `.defer`.
export function addDefer<T extends object>(facade: T): T {
    Object.getOwnPropertyNames(Object.getPrototypeOf(facade)).forEach(name => {
        if (name === "constructor") return;
        const method = (facade as any)[name];
        if (typeof method !== "function") return;
        const bound: any = method.bind(facade);
        bound.defer = (...args: any[]) => setTimeout(() => bound(...args));
        (facade as any)[name] = bound;
    });
    return facade;
}
