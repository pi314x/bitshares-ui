// TypeScript/functional-component port of the legacy Console.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical class-to-hooks translation, no
// logic changes.
//
// SECURITY (AGENTS.md): this is a developer debug console that `eval()`s
// arbitrary JS with `WalletApi`, `ApplicationApi`, `DebugApi` and the raw
// chain `db`/`network` API objects exposed into the eval'd script's scope
// via `evalInContext` - preserved verbatim, unchanged, not sandboxed or
// restricted/expanded in any way. Grepped every `console.*` call in the
// original: only `console.log("... evt", evt)` (the raw keydown event on
// Enter) and two already-commented-out `// DEBUG console.log(...)` lines
// (one logging a generic eval result, one logging a generic eval error) -
// none log password/key/brainkey material (this console has no
// password/key UI of its own), so all are carried over unchanged,
// including the commented-out ones (dead, but left as the original left
// them - no new logging added).
//
// No external callers: grepped the whole app for `components/Console`
// and `from "./Console"`/`from "../Console"` (case-insensitive) - this
// component is not imported or rendered anywhere, including
// `App.jsx`/`routes.jsx`/`Settings/`. It is ported as-is per the task,
// standalone.
//
// Module-level mutable `cmd_history`/`cmd_history_position`: kept as
// module-level `let` bindings exactly as in the original (shared across
// every `Console` instance, which was already true of the class version
// since they were declared with `var` outside the class) - not moved into
// component state/refs, to preserve the original's (almost certainly
// unintentional) cross-instance sharing behavior.
//
// Preserved bugs/quirks (verified by reading, not "fixed" per AGENTS.md):
// - `cmd_history.pushState("")` in `run()`: `Array.prototype` has no
//   `pushState` method (that's a `History` API method, unrelated to
//   arrays) - this throws a `TypeError` every time `run()` is invoked,
//   *after* the try/catch around `evalInContext` (so an eval error is
//   still reported to `cmd_console`), but *before* `setState` runs - so
//   in the original, submitting any command throws synchronously out of
//   `run()` and the typed command/result never actually commits to
//   `this.state.cmd_console`/clears `this.state.cmd` (React logs the
//   error to the console but the component doesn't crash since this
//   isn't inside `render()`). Reproduced verbatim: same call, same
//   throw, same place. TypeScript doesn't know `string[]` has no
//   `pushState`, so `cmd_history` is typed `any` (not `string[]`) solely
//   to let this exact call compile without widening or restricting what
//   it does at runtime.
// - `on_cmd_keyup`/the "prevent immediate duplicates" block in `run()`
//   both read `this.refs.console_input.props.value` - but `console_input`
//   is a string ref on a plain `<textarea>` *host* element, which resolves
//   to the real DOM node, not a React element/component instance - DOM
//   nodes have no `.props`. This throws `TypeError: Cannot read
//   properties of undefined (reading 'value')` whenever `on_cmd_keyup`
//   fires (every keyup in the textarea) or whenever `run()` reaches that
//   line. Reproduced verbatim via `(consoleInputRef.current as any).props
//   .value` - the `as any` cast is only to let a nonexistent property
//   access through `tsc`, it does not change the runtime throw.
// - `cmd_history.pushState("")` and `cmd_history[...].props.value` were
//   seemingly meant to be `cmd_history.push("")` and `...value` (plain
//   textarea value, already available as `this.state.cmd`/`cmd` state) -
//   not changed, per the no-fix rule.
// - The `switch` in `on_cmd_keydown` has a fallthrough from `case
//   keyCode.enter` into `case keyCode.up` when `evt.shiftKey` is true (no
//   `break`/`return` on that branch) - kept exactly as written.
// - `cmd_history.length == 1` / `!cmd_console.length` ("clear"/"clear
//   history" link visibility) and all other comparisons kept with their
//   original (non-strict `==`) operators.
//
// Structural/TypeScript-forced changes:
// - Three string refs (`console_div`, `console_form`, `console_input`),
//   grepped app-wide (see "No external callers" above) and confirmed used
//   only inside this file - plain `useRef`s, no `forwardRef` needed.
//   `console_form` is assigned via `ref` but never read anywhere in the
//   original (dead ref) - kept as an unused ref purely to mirror the
//   JSX shape; `console_div`/`console_input` are both read
//   (`componentDidUpdate`'s scroll/focus, and the two bugs above).
// - `componentDidUpdate() { this.refs.console_input.focus(); ... }` runs
//   on every update with no field comparison at all - translated to a
//   dependency-free `useEffect` gated by an `isMountRef` guard (fires
//   after every render except the first, matching `componentDidUpdate`
//   never firing on the initial mount).
// - `clear_history()`'s `this.forceUpdate()` (no state change, since
//   `cmd_history`/`cmd_history_position` are module-level, not component
//   state) becomes a dummy `setState` counter bump - hooks have no
//   `forceUpdate` equivalent that doesn't change anything, so an unread
//   `useState` tick that's incremented is the standard replacement.
//   Likewise for `cmd_console_result`/`cmd_console_error`, which mutate
//   `this.state.cmd_console` in place (`.push(...)`) and then call
//   `this.forceUpdate()` rather than `this.setState({cmd_console})` -
//   reproduced the same way (mutate the array referenced by state, then
//   bump the tick) rather than "fixed" into a proper `setState` with a
//   new array, to keep the exact original update semantics (e.g. this
//   means React sees the same array reference and relies on the tick
//   bump alone to know to re-render - preserved, not corrected).
// - `on_cmd_keydown`'s inline event-field reads are untyped
//   (`React.KeyboardEvent`); `evt.which` is deprecated but still present
//   on the event and matches the original's own use of `evt.which`.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import ApplicationApi from "api/ApplicationApi";
import WalletApi from "api/WalletApi";
import DebugApi from "api/DebugApi";

function evalInContext(js: string): any {
    const db = (Apis as any).instance().db_api(),
        net = (Apis as any).instance().network_api(),
        app = ApplicationApi,
        wallet = WalletApi,
        debug = new (DebugApi as any)();

    // Not statically referenced below - `eval(js)` reads it dynamically
    // from this function's scope, exactly as the original did. Preserved
    // verbatim: this is the sensitive surface described in this file's
    // header comment, not something to restrict or "clean up".
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const $g = {
        db,
        net,
        app,
        wallet,
        debug
    };
    return eval(js);
}

const keyCode = {
    enter: 13,
    up: 38,
    down: 40
};

// Module-level, shared across every `Console` instance - kept exactly as
// the original's module-level `var`s (see header comment).
let cmd_history: any = [""],
    cmd_history_position = 0;

export default function Console() {
    const [cmdConsole, setCmdConsole] = React.useState<React.ReactNode[]>([]);
    const [cmd, setCmd] = React.useState<string>("");
    // Dummy re-render tick, standing in for the original's
    // `this.forceUpdate()` calls (see header comment).
    const [, bumpTick] = React.useState(0);

    const consoleDivRef = React.useRef<HTMLDivElement | null>(null);
    const consoleFormRef = React.useRef<HTMLFormElement | null>(null);
    const consoleInputRef = React.useRef<HTMLTextAreaElement | null>(null);

    const cmdRef = React.useRef(cmd);
    cmdRef.current = cmd;
    const cmdConsoleRef = React.useRef(cmdConsole);
    cmdConsoleRef.current = cmdConsole;

    const isMountRef = React.useRef(false);
    React.useEffect(() => {
        if (!isMountRef.current) {
            isMountRef.current = true;
            return;
        }
        consoleInputRef.current && consoleInputRef.current.focus();
        const node = consoleDivRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    });

    function clear() {
        setCmdConsole([]);
    }

    function clear_history() {
        cmd_history = [""];
        cmd_history_position = 0;
        bumpTick(t => t + 1);
    }

    function on_cmd_change(evt: React.ChangeEvent<HTMLTextAreaElement>) {
        setCmd(evt.target.value);
    }

    function on_cmd_keydown(evt: React.KeyboardEvent<HTMLTextAreaElement>) {
        // DEBUG console.log('... on_cmd_keydown', evt.type, evt.which, evt)
        switch (evt.which) {
            case keyCode.enter:
                console.log("... evt", evt);
                if (!evt.shiftKey) {
                    on_cmd_submit(evt);
                    break;
                }
            // falls through intentionally when shiftKey is held - matches
            // the original
            case keyCode.up:
                if (cmd_history_position == 0) return;
                cmd_history_position--;
                setCmd(cmd_history[cmd_history_position]);
                break;
            case keyCode.down:
                if (cmd_history_position < cmd_history.length - 1) {
                    cmd_history_position++;
                    setCmd(cmd_history[cmd_history_position]);
                    break;
                }
                if (
                    cmd_history.length - 1 == cmd_history_position &&
                    cmdRef.current != ""
                ) {
                    cmd_history.pushState("");
                    cmd_history_position++;
                    setCmd("");
                    break;
                }
            default:
                // input field was altered, on_cmd_keyup will have the value
                cmd_history_position = cmd_history.length - 1;
                return;
        }
        evt.preventDefault();
        evt.stopPropagation();
    }

    function on_cmd_keyup() {
        cmd_history[cmd_history_position] = (consoleInputRef.current as any)
            .props.value;
    }

    function on_cmd_submit(evt: {preventDefault: () => void}) {
        evt.preventDefault();
        run();
    }

    function run() {
        if (cmdRef.current.trim() == "") return;

        // if pasted, it will not be in history via 'on_cmd_keyup'
        cmd_history[cmd_history_position] = (consoleInputRef.current as any)
            .props.value;

        const cmd_console = cmdConsoleRef.current;
        cmd_console.push(
            <div>
                <br />
                <div className="console_result monospace">
                    &gt;&nbsp;{cmdRef.current}
                </div>
            </div>
        );
        try {
            const result = evalInContext(cmdRef.current);
            if (result && result["then"]) {
                result
                    .then((result: any) => {
                        cmd_console_result(result);
                    })
                    .catch((error: any) => {
                        cmd_console_error(error);
                    });
            } else {
                cmd_console_result(result);
            }
        } catch (error) {
            cmd_console_error(error);
        }
        // prevent immediate duplicats in history
        if (
            cmd_history_position &&
            cmd_history[cmd_history_position - 1] == cmdRef.current
        )
            cmd_history.pop();

        while (cmd_history[cmd_history.length - 1] == "") cmd_history.pop();

        cmd_history_position = cmd_history.length;
        cmd_history.pushState("");
        setCmdConsole(cmd_console);
        setCmd("");
    }

    function cmd_console_result(result: any) {
        // DEBUG console.log('... cmd_console_result result',result)
        const cmd_console = cmdConsoleRef.current;
        const result_stringify = JSON.stringify(result);
        cmd_console.push(
            <div className="console_result monospace">{result_stringify}</div>
        );
        bumpTick(t => t + 1);
    }

    function cmd_console_error(error: any) {
        // DEBUG console.log("user console command error", error)
        const cmd_console = cmdConsoleRef.current;
        const message = error.message ? error.message : error;
        cmd_console.push(
            <div className="console-error monospace has-error">{message}</div>
        );
        bumpTick(t => t + 1);
    }

    return (
        <div className="grid-content" ref={consoleDivRef}>
            <form ref={consoleFormRef} onSubmit={on_cmd_submit}>
                <div>{cmdConsole}</div>&nbsp;
                <textarea
                    id="console_input"
                    ref={consoleInputRef}
                    onChange={on_cmd_change}
                    onKeyDown={on_cmd_keydown}
                    onKeyUp={on_cmd_keyup}
                    value={cmd}
                    placeholder="Console Command"
                />
                <p>
                    <code onClick={run}>run</code>
                    {!cmdConsole.length ? "" : <code onClick={clear}>clear</code>}
                    {cmd_history.length == 1 ? (
                        ""
                    ) : (
                        <code onClick={clear_history}>clear history</code>
                    )}
                </p>
            </form>
        </div>
    );
}
