import * as React from "react";
import styles from "./Select.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

// Fifth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`'s precedent: grep every real call site's prop usage
// before deciding the API's scope. Confirmed via grep: single-select
// only (no `mode="multiple"`/`allowClear` anywhere in the app), 7 real
// `showSearch` call sites (a few of those also pass a custom
// `filterOption`), no `Select.OptGroup` usage.
export interface SelectOptionProps {
    value: string | number;
    disabled?: boolean;
    children?: React.ReactNode;
}

// A real component (not just a type marker, the way some antd-API
// clones do it), typed via `React.FC<SelectOptionProps>` so JSX usage
// (`<Select.Option value="x" disabled>...</Select.Option>`) still
// type-checks against its real props - but it's never rendered
// directly, `Select` reads the props straight off the element and
// renders the dropdown list itself, so the implementation itself takes
// no parameters.
const SelectOption: React.FC<SelectOptionProps> = () => null;

function optionText(node: React.ReactNode): string {
    if (node === null || node === undefined || typeof node === "boolean")
        return "";
    if (typeof node === "string" || typeof node === "number")
        return String(node);
    if (Array.isArray(node)) return node.map(optionText).join(" ");
    if (React.isValidElement(node))
        return optionText((node.props as any).children);
    return "";
}

export interface SelectOptionData {
    key: string;
    value: string | number;
    disabled?: boolean;
    label: React.ReactNode;
    text: string;
}

function collectOptions(children: React.ReactNode): SelectOptionData[] {
    const options: SelectOptionData[] = [];
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child) || child.type !== SelectOption)
            return;
        const props = child.props as SelectOptionProps;
        options.push({
            key: String(child.key ?? props.value),
            value: props.value,
            disabled: props.disabled,
            label: props.children,
            text: optionText(props.children)
        });
    });
    return options;
}

export interface SelectProps {
    value?: string | number;
    defaultValue?: string | number;
    onChange?: (value: string | number) => void;
    onSelect?: (value: string | number) => void;
    placeholder?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    /** Adds a filter input at the top of the open dropdown. */
    showSearch?: boolean;
    /** Default (when `showSearch` is set and this is omitted): a
     * case-insensitive substring match against the option's own
     * rendered text, matching antd's own default. */
    filterOption?: (input: string, option: SelectOptionData) => boolean;
    notFoundContent?: React.ReactNode;
    /** Default true, matching antd. */
    showArrow?: boolean;
    onDropdownVisibleChange?: (open: boolean) => void;
    /** Fires with the raw typed text on every keystroke in the
     * `showSearch` filter input (antd's own `onSearch`) - distinct from
     * `onChange`/`onSelect`, which only fire when an option is actually
     * chosen. Real call sites use it to mirror free-typed text (not
     * limited to the listed options) back into their own state. */
    onSearch?: (value: string) => void;
    children?: React.ReactNode;
}

function SelectBase({
    value,
    defaultValue,
    onChange,
    onSelect,
    placeholder,
    disabled,
    className,
    style,
    showSearch,
    filterOption,
    notFoundContent,
    showArrow = true,
    onDropdownVisibleChange,
    onSearch,
    children
}: SelectProps) {
    const [open, setOpenState] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
        defaultValue
    );
    const [query, setQuery] = React.useState("");
    const searchRef = React.useRef<HTMLInputElement>(null);

    const setOpen = (next: boolean) => {
        setOpenState(next);
        if (onDropdownVisibleChange) onDropdownVisibleChange(next);
        if (next) setQuery("");
    };

    const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

    React.useEffect(() => {
        if (open && showSearch) searchRef.current?.focus();
    }, [open, showSearch]);

    const options = collectOptions(children);
    const currentValue = value !== undefined ? value : uncontrolledValue;
    const selected = options.find(o => o.value === currentValue);

    const visibleOptions =
        showSearch && query
            ? options.filter(o =>
                  filterOption
                      ? filterOption(query, o)
                      : o.text.toLowerCase().includes(query.toLowerCase())
              )
            : options;

    function choose(option: SelectOptionData) {
        if (option.disabled) return;
        if (value === undefined) setUncontrolledValue(option.value);
        if (onChange) onChange(option.value);
        if (onSelect) onSelect(option.value);
        setOpen(false);
    }

    const wrapClasses = [
        styles.wrap,
        disabled ? styles.disabled : "",
        className
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={wrapClasses} style={style} ref={ref}>
            <button
                type="button"
                className={styles.trigger}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => !disabled && setOpen(!open)}
            >
                <span
                    className={
                        selected ? styles.value : styles.placeholder
                    }
                >
                    {selected ? selected.label : placeholder}
                </span>
                {showArrow ? (
                    <span className={styles.caret} aria-hidden="true">
                        ▾
                    </span>
                ) : null}
            </button>
            {open ? (
                <div className={styles.dropdown} role="listbox">
                    {showSearch ? (
                        <input
                            ref={searchRef}
                            className={styles.search}
                            value={query}
                            onChange={e => {
                                setQuery(e.target.value);
                                if (onSearch) onSearch(e.target.value);
                            }}
                        />
                    ) : null}
                    {visibleOptions.length === 0 ? (
                        <div className={styles.empty}>
                            {notFoundContent}
                        </div>
                    ) : (
                        visibleOptions.map(option => (
                            <div
                                key={option.key}
                                role="option"
                                aria-selected={option.value === currentValue}
                                className={[
                                    styles.option,
                                    option.value === currentValue
                                        ? styles.optionActive
                                        : "",
                                    option.disabled
                                        ? styles.optionDisabled
                                        : ""
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => choose(option)}
                            >
                                {option.label}
                            </div>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}

export const Select = Object.assign(SelectBase, {Option: SelectOption});
