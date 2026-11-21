// TypeScript/functional-component port of the legacy SearchInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes -
// already a function component, so this just adds types.
//
// Preserved verbatim (not "fixed"): `searchInput` is a single
// `React.createRef()` created once at *module* scope, shared by every
// `<SearchInput>` instance rendered anywhere in the app - not a per-
// instance ref. If more than one `SearchInput` is mounted at once, they
// all share the same ref object (whichever instance mounted/rendered last
// "wins" `searchInput.current`). A real pre-existing bug, not introduced
// by this port; using `useRef()` inside the component (a per-instance
// ref) would be the "obvious" hooks-idiomatic fix but would silently
// change behavior, so it's not done here.
import * as React from "react";
import {Input} from "../../design-system/Input";
import {Icon} from "../../design-system/Icon";
import counterpart from "counterpart";

const searchInput = React.createRef<any>();

interface SearchInputProps {
    onChange: (event: any) => void;
    value?: string;
    placeholder?: string;
    maxLength?: number;
    style?: React.CSSProperties;
    className?: string;
    name?: string;
    autoComplete?: string;
    onClear?: (() => void) | null;
    type?: string;
    [key: string]: any;
}

export default function SearchInput({
    onChange,
    value,
    placeholder = counterpart.translate("exchange.filter"),
    maxLength = 16,
    style = {width: "200px"},
    className = "",
    name = "focus",
    autoComplete = "off",
    onClear,
    type = "text",
    ...other
}: SearchInputProps) {
    if (onClear == undefined) {
        // if onClear=null, then it won't be rendered
        onClear = () => {
            onChange({
                target: {value: ""}
            });
            searchInput.current.focus();
        };
    }

    return (
        <Input
            ref={searchInput}
            autoComplete={autoComplete}
            style={style}
            type={type}
            className={className + " search-input"}
            placeholder={placeholder}
            maxLength={maxLength}
            name={name}
            value={value}
            onChange={onChange}
            addonAfter={<Icon type="search" />}
            suffix={
                onClear ? (
                    <Icon
                        onClick={onClear}
                        type="close"
                        // always include DOM the icon, otherwise user looses focus when it appears and input resizes
                        className={value ? "cursor-pointer" : "hide"}
                    />
                ) : (
                    <span />
                )
            }
            {...other}
        />
    );
}
