// TypeScript/functional-component port of the legacy FloatingDropdown.jsx
// (default-exported as `Dropdown`) (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// `componentDidMount` (calls `_setListener()` once) and
// `UNSAFE_componentWillReceiveProps` (adds/removes a document-level click
// listener as `entries.length` crosses the 1/>1 boundary) are unified
// into a single `useEffect` keyed on `entries.length` - it runs once on
// mount (matching `componentDidMount`, since `_setListener()`'s own
// internal `entries.length > 1` gate already made that call a no-op when
// starting at length 1) and again on every subsequent `entries.length`
// change (matching `componentWillReceiveProps`). `componentWillUnmount`'s
// cleanup is a separate mount-only effect returning the same removal
// function.
//
// The document-level listener is attached exactly once per mount (not
// re-created on every render), so it can't simply close over `id` the way
// the class's `this.props.id` always reads the *current* value - a
// `idRef` kept in sync on every render replicates that "always current"
// read from inside the long-lived listener.
//
// `shouldComponentUpdate` is a pure props/state shallow-equality
// performance guard - not replicated, per this migration's established
// treatment of pure perf guards.
import * as React from "react";

interface FloatingDropdownProps {
    scroll_length?: number;
    entries: any[];
    value?: any;
    values?: any;
    onChange: (value: any) => void;
    upperCase?: boolean;
    singleEntry?: React.ReactNode;
    id?: string;
}

export default function Dropdown({
    scroll_length = 9,
    entries,
    value,
    values,
    onChange,
    upperCase,
    singleEntry,
    id
}: FloatingDropdownProps) {
    const [active, setActive] = React.useState(false);
    const listenerRef = React.useRef(false);
    const idRef = React.useRef(id);
    idRef.current = id;

    const onBodyClickRef = React.useRef((e: any) => {
        let el = e.target;
        let insideActionSheet = false;

        do {
            if (
                el.classList &&
                el.classList.contains("dropdown") &&
                el.id === idRef.current
            ) {
                insideActionSheet = true;
                break;
            }
        } while ((el = el.parentNode));

        if (!insideActionSheet) {
            setActive(false);
        } else {
            e.stopPropagation();
        }
    });

    const setListener = () => {
        if (entries.length > 1 && !listenerRef.current) {
            listenerRef.current = true;
            document.body.addEventListener("click", onBodyClickRef.current, {
                capture: false,
                passive: true
            } as any);
        }
    };

    const removeListener = () => {
        document.body.removeEventListener(
            "click",
            onBodyClickRef.current as any
        );
        listenerRef.current = false;
    };

    React.useEffect(() => {
        if (entries.length === 1) {
            removeListener();
        } else if (entries.length > 1) {
            setListener();
        }
    }, [entries.length]);

    React.useEffect(() => {
        return () => {
            removeListener();
        };
    }, []);

    const onChangeOption = (optionValue: any, e: any) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(optionValue);
        setActive(false);
    };

    const toggleDropdown = () => {
        setActive(!active);
    };

    if (entries.length === 0) return null;
    if (entries.length == 1) {
        return (
            <div
                className={
                    "dropdown-wrapper inactive" +
                    (upperCase ? " upper-case" : "")
                }
            >
                <div>{singleEntry ? singleEntry : entries[0]}</div>
            </div>
        );
    } else {
        const options = entries.map(entryValue => {
            return (
                <li
                    className={upperCase ? "upper-case" : ""}
                    key={entryValue}
                    onClick={onChangeOption.bind(
                        null,
                        values[entryValue]
                    )}
                >
                    <span>{entryValue}</span>
                </li>
            );
        });
        return (
            <div
                onClick={toggleDropdown}
                className={
                    "dropdown-wrapper" +
                    (active ? " active" : "") +
                    (upperCase ? " upper-case" : "")
                }
            >
                <div style={{paddingRight: 15}}>
                    {value ? value : <span className="hidden">A</span>}
                </div>
                <ul
                    className="dropdown"
                    style={{
                        overflow:
                            entries.length > scroll_length ? "auto" : "hidden"
                    }}
                >
                    {options}
                </ul>
            </div>
        );
    }
}
