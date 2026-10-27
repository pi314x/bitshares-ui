import * as React from "react";
import {createPortal} from "react-dom";
import styles from "./Select.module.scss";
import {listRoom} from "./listRoom";

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
    /** Applied to this option's rendered row in the open dropdown -
     * real at one call site (`Utility/CustomTable.tsx`'s column-
     * visibility checkboxes), which uses it purely for its own padding
     * hook, not anything antd-DOM-structure-dependent. */
    className?: string;
    /** What the closed select shows when this option is the chosen one, where
     * that is not the option's children (a name without the balance that sits
     * beside it in the list). */
    triggerLabel?: React.ReactNode;
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
    className?: string;
    label: React.ReactNode;
    triggerLabel?: React.ReactNode;
    text: string;
}

function collectOptions(children: React.ReactNode): SelectOptionData[] {
    const options: SelectOptionData[] = [];
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child) || child.type !== SelectOption) return;
        const props = child.props as SelectOptionProps;
        options.push({
            key: String(child.key ?? props.value),
            value: props.value,
            disabled: props.disabled,
            className: props.className,
            label: props.children,
            triggerLabel: props.triggerLabel,
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
    /** `"value"` (the only value any real call site passes): shows the
     * selected option's `value` as the closed trigger's label instead
     * of its rendered `children` (antd's own default) - real call
     * sites use this to keep extra decoration inside an option's
     * `children` (e.g. a right-aligned balance) out of the collapsed
     * trigger display. */
    optionLabelProp?: "value";
    /** Applied to the open dropdown panel itself (antd's own
     * `dropdownClassName`), not the closed trigger - real call sites
     * use it to scope dropdown-only CSS (e.g. a wider panel) without
     * also restyling the trigger via `className`. */
    dropdownClassName?: string;
    /** Default `true` (antd's own default): the open dropdown panel's
     * width matches the closed trigger's. Real at one call site
     * (`Exchange/ScaledOrderTab.tsx`'s fee-currency picker, a narrow
     * 80-120px trigger whose dropdown still needs room for longer
     * asset names) set to `false`, letting the panel size to its own
     * content instead. */
    dropdownMatchSelectWidth?: boolean;
    children?: React.ReactNode;
}

// The narrowest a list is drawn, and the distance it keeps from the window's edge.
const MIN_LIST_WIDTH = 160;
const EDGE = 8;

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
    optionLabelProp,
    dropdownClassName,
    dropdownMatchSelectWidth = true,
    children
}: SelectProps) {
    const [open, setOpenState] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
        defaultValue
    );
    const [query, setQuery] = React.useState("");
    const searchRef = React.useRef<HTMLInputElement>(null);

    // The side of the field the list is drawn on (above it), chosen when it opens and kept while it is open.
    // A phone's keyboard comes up as the search box takes the focus and shrinks the window: choosing the
    // side again then turned the list round, onto the content above its field, while a person was picking.
    const above = React.useRef<boolean | null>(null);

    const setOpen = (next: boolean) => {
        above.current = null;
        setOpenState(next);
        if (onDropdownVisibleChange) onDropdownVisibleChange(next);
        if (next) setQuery("");
    };

    // The list is drawn in a portal on <body>, positioned from the trigger, so
    // no container (a modal body with overflow, a card, a table cell) can clip
    // it. Hence "outside" means outside both the trigger and the list.
    const ref = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const [box, setBox] = React.useState<{
        top: number;
        /** the distance from the window's bottom, for a list above its field */
        bottom: number;
        left: number;
        width: number;
        up: boolean;
        /** what is left of the visible window for the list, in px */
        room: number;
    } | null>(null);

    const place = React.useCallback(() => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const screenHeight = window.innerHeight;
        // Open upwards when there is little room below and more above - once, as it opens.
        if (above.current === null) {
            const below = screenHeight - rect.bottom;
            above.current = below < 240 && rect.top > below;
        }
        const up = above.current;
        // A list is at least as wide as an asset name needs, even under a small
        // trigger (a 100px fee asset field), and stays on the screen: under a field
        // at the right edge it opens to the left of the field's right edge, not
        // out of the window (where its text was cut off after the first letter).
        const screenWidth =
            document.documentElement.clientWidth || window.innerWidth;
        const width = Math.min(
            Math.max(rect.width, MIN_LIST_WIDTH),
            screenWidth - 2 * EDGE
        );
        const left = Math.max(
            EDGE,
            Math.min(rect.left, screenWidth - width - EDGE)
        );
        setBox({
            top: up ? rect.top : rect.bottom,
            bottom: screenHeight - rect.top + 4,
            left,
            width,
            up,
            room: listRoom(rect, up, screenHeight, window.visualViewport)
        });
    }, []);

    // A list that is as wide as its longest option (`dropdownMatchSelectWidth={false}`)
    // is measured once it is drawn and moved in if it runs out of the window.
    React.useLayoutEffect(() => {
        if (!open || !box || !listRef.current) return;
        const screenWidth =
            document.documentElement.clientWidth || window.innerWidth;
        const drawn = listRef.current.getBoundingClientRect();
        const over = drawn.right - (screenWidth - EDGE);
        if (over > 0.5) {
            const left = Math.max(EDGE, box.left - over);
            if (left !== box.left) setBox({...box, left});
        }
    }, [open, box]);

    React.useLayoutEffect(() => {
        if (!open) return;
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        // a keyboard shrinks the visual viewport, and a browser may say so only there
        const visual = window.visualViewport;
        if (visual) {
            visual.addEventListener("resize", place);
            visual.addEventListener("scroll", place);
        }
        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
            if (visual) {
                visual.removeEventListener("resize", place);
                visual.removeEventListener("scroll", place);
            }
        };
    }, [open, place]);

    React.useEffect(() => {
        if (!open) return;
        const onPointer = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !ref.current?.contains(target) &&
                !listRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                // an open list takes the key: the dialog around it stays
                event.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);

    // The search box is there once the list has a place (`box`), a render after `open`:
    // focus it then, so what is typed goes into it.
    const listPlaced = box !== null;
    React.useEffect(() => {
        if (open && showSearch && listPlaced) searchRef.current?.focus();
    }, [open, showSearch, listPlaced]);

    const listStyle: React.CSSProperties | null = box && {
        position: "fixed",
        left: box.left,
        ...(box.up ? {bottom: box.bottom} : {top: box.top + 4}),
        ...(dropdownMatchSelectWidth === false
            ? {minWidth: box.width}
            : {width: box.width})
    };

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
                <span className={selected ? styles.value : styles.placeholder}>
                    {selected
                        ? selected.triggerLabel !== undefined
                            ? selected.triggerLabel
                            : optionLabelProp === "value"
                            ? String(selected.value)
                            : selected.label
                        : placeholder}
                </span>
                {showArrow ? (
                    <span className={styles.caret} aria-hidden="true">
                        ▾
                    </span>
                ) : null}
            </button>
            {open && box
                ? createPortal(
                      <div
                          ref={listRef}
                          style={
                              {
                                  ...listStyle,
                                  // the stylesheet's height, or what is left of the visible window
                                  "--list-room": `${box.room}px`
                              } as React.CSSProperties
                          }
                          className={[
                              styles.dropdown,
                              dropdownMatchSelectWidth === false
                                  ? styles.dropdownAutoWidth
                                  : "",
                              dropdownClassName
                          ]
                              .filter(Boolean)
                              .join(" ")}
                          role="listbox"
                      >
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
                                      aria-selected={
                                          option.value === currentValue
                                      }
                                      className={[
                                          styles.option,
                                          option.value === currentValue
                                              ? styles.optionActive
                                              : "",
                                          option.disabled
                                              ? styles.optionDisabled
                                              : "",
                                          option.className
                                      ]
                                          .filter(Boolean)
                                          .join(" ")}
                                      onClick={() => choose(option)}
                                  >
                                      {option.label}
                                  </div>
                              ))
                          )}
                      </div>,
                      document.body
                  )
                : null}
        </div>
    );
}

export const Select = Object.assign(SelectBase, {Option: SelectOption});
