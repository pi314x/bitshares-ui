// The pieces the "Advanced operations" dialogs share: the translation helper, the
// reason a builder gave for refusing as text, an account typed by name (and looked up as it
// is typed), an asset typed by symbol with its amount, and a multi-line field for JSON or
// hex. The look is the operation dialogs' (`Utility/OperationDialog`).
import * as React from "react";
import counterpart from "counterpart";
import {Input} from "../../design-system/Input";
import {DialogField} from "../Utility/OperationDialog";
import AdvancedActions, {
    AccountInfo,
    AssetInfo
} from "../../actions/AdvancedActions";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {AdvancedError} from "../../lib/common/advancedOps";
import styles from "./Advanced.module.scss";

export const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`advanced.${key}`, params) as string;

/** A builder's refusal as a sentence. */
export function errorText(failure: {
    error: AdvancedError;
    detail?: string;
}): string {
    return t(`errors.${failure.error}`, {detail: failure.detail ?? ""});
}

/** Waits for the value to stop changing before it is looked up. */
export function useDebounced<T>(value: T, ms = 300): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(timer);
    }, [value, ms]);
    return debounced;
}

export type LookupState<T> =
    | {state: "idle"}
    | {state: "loading"}
    | {state: "missing"}
    | {state: "error"}
    | {state: "ok"; value: T};

/** Looks `text` up as it settles; a later text throws the earlier answer away. */
export function useLookup<T>(
    text: string,
    find: (text: string) => Promise<T | null>
): LookupState<T> {
    const wanted = useDebounced(text.trim());
    const [result, setResult] = React.useState<LookupState<T>>({state: "idle"});
    const pending = text.trim() !== wanted;
    React.useEffect(() => {
        if (!wanted) {
            setResult({state: "idle"});
            return;
        }
        let cancelled = false;
        setResult({state: "loading"});
        find(wanted)
            .then(value => {
                if (cancelled) return;
                setResult(value ? {state: "ok", value} : {state: "missing"});
            })
            .catch(() => {
                if (!cancelled) setResult({state: "error"});
            });
        return () => {
            cancelled = true;
        };
        // `find` is stable per field
    }, [wanted]);
    if (!text.trim()) return {state: "idle"};
    return pending ? {state: "loading"} : result;
}

const ACCOUNT_ID = /^1\.2\.\d+$/;

/** Looks up an account by its name, or by its id. */
export const findAccount = (text: string): Promise<AccountInfo | null> =>
    ACCOUNT_ID.test(text)
        ? AdvancedActions.getAccountById(text)
        : AdvancedActions.getAccountByName(text);

/** The account the person is acting as (the current account), with its id. */
export function useCurrentAccount(): {
    name: string | null;
    account: LookupState<AccountInfo>;
} {
    const state = useReduxState<any>(selectAccountState);
    const name: string | null =
        state.currentAccount || state.passwordAccount || null;
    const account = useLookup<AccountInfo>(name || "", findAccount);
    return {name, account};
}

/** The id of a looked-up account, or null while it is not known. */
export const idOf = (lookup: LookupState<AccountInfo>): string | null =>
    lookup.state === "ok" ? lookup.value.id : null;

function statusText(
    lookup: LookupState<any>,
    ok: (value: any) => string
): {text?: string; error?: string} {
    switch (lookup.state) {
        case "ok":
            return {text: ok(lookup.value)};
        case "missing":
            return {error: t("lookup_missing")};
        case "error":
            return {error: t("lookup_failed")};
        case "loading":
            return {text: t("lookup_loading")};
        default:
            return {};
    }
}

export interface AccountNameFieldProps {
    label: React.ReactNode;
    help?: React.ReactNode;
    value: string;
    onChange: (text: string) => void;
    lookup: LookupState<AccountInfo>;
    placeholder?: string;
}

/** An account typed by name; says whom it found. */
export function AccountNameField(props: AccountNameFieldProps) {
    const status = statusText(
        props.lookup,
        (a: AccountInfo) => `${a.name} (${a.id})`
    );
    return (
        <DialogField
            label={props.label}
            help={status.text || props.help}
            error={status.error}
        >
            <Input
                value={props.value}
                placeholder={props.placeholder}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                aria-label={String(props.label)}
                onChange={e => props.onChange(e.target.value)}
            />
        </DialogField>
    );
}

/** An account field with its own lookup, for a dialog that has few of them. */
export function useAccountField(initial = "") {
    const [text, setText] = React.useState(initial);
    const lookup = useLookup<AccountInfo>(text, findAccount);
    return {text, setText, lookup, id: idOf(lookup)};
}

/** Several accounts, one per line or separated by commas; each looked up. */
export function useAccountList(text: string) {
    const names = React.useMemo(
        () =>
            Array.from(
                new Set(
                    text
                        .split(/[\s,;]+/)
                        .map(n => n.trim())
                        .filter(Boolean)
                )
            ),
        [text]
    );
    const wanted = useDebounced(names.join(","));
    const [ids, setIds] = React.useState<Record<string, string | null> | null>(
        null
    );
    React.useEffect(() => {
        if (!wanted) {
            setIds({});
            return;
        }
        let cancelled = false;
        setIds(null);
        Promise.all(
            wanted
                .split(",")
                .map(name =>
                    (ACCOUNT_ID.test(name)
                        ? AdvancedActions.getAccountById(name)
                        : AdvancedActions.getAccountByName(name)
                    ).then(info => [name, info ? info.id : null] as const)
                )
        )
            .then(pairs => {
                if (!cancelled) setIds(Object.fromEntries(pairs));
            })
            .catch(() => {
                if (!cancelled) setIds(null);
            });
        return () => {
            cancelled = true;
        };
    }, [wanted]);
    const ready = ids !== null && names.join(",") === wanted;
    const missing = ready ? names.filter(name => !ids![name]) : [];
    return {
        names,
        ready,
        missing,
        /** name -> id of each name looked up */
        map: (ready ? ids : {}) as Record<string, string | null>,
        ids: ready
            ? names.map(name => ids![name] as string).filter(Boolean)
            : []
    };
}

export interface AccountListFieldProps {
    label: React.ReactNode;
    help?: React.ReactNode;
    value: string;
    onChange: (text: string) => void;
    list: ReturnType<typeof useAccountList>;
}

export function AccountListField(props: AccountListFieldProps) {
    const {list} = props;
    return (
        <DialogField
            label={props.label}
            help={
                list.names.length && !list.ready
                    ? t("lookup_loading")
                    : props.help
            }
            error={
                list.missing.length
                    ? t("lookup_missing_some", {names: list.missing.join(", ")})
                    : null
            }
        >
            <Input.TextArea
                rows={2}
                value={props.value}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                aria-label={String(props.label)}
                onChange={e => props.onChange(e.target.value)}
            />
        </DialogField>
    );
}

/** An asset typed by symbol, looked up for its id and its precision. */
export function useAssetField(initial = "") {
    const [text, setText] = React.useState(initial);
    const lookup = useLookup<AssetInfo>(text, symbol =>
        /^1\.3\.\d+$/.test(symbol)
            ? AdvancedActions.getAssetById(symbol)
            : AdvancedActions.getAssetBySymbol(symbol.toUpperCase())
    );
    return {
        text,
        setText,
        lookup,
        asset: lookup.state === "ok" ? lookup.value : null
    };
}

export interface AssetFieldProps {
    label: React.ReactNode;
    help?: React.ReactNode;
    value: string;
    onChange: (text: string) => void;
    lookup: LookupState<AssetInfo>;
}

export function AssetSymbolField(props: AssetFieldProps) {
    const status = statusText(
        props.lookup,
        (a: AssetInfo) =>
            `${a.symbol} (${a.id}), ${t("decimals", {count: a.precision})}`
    );
    return (
        <DialogField
            label={props.label}
            help={status.text || props.help}
            error={status.error}
        >
            <Input
                value={props.value}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label={String(props.label)}
                onChange={e => props.onChange(e.target.value)}
            />
        </DialogField>
    );
}

export interface AreaFieldProps {
    label: React.ReactNode;
    help?: React.ReactNode;
    error?: string | null;
    value: string;
    onChange: (text: string) => void;
    rows?: number;
    mono?: boolean;
    placeholder?: string;
}

/** A field of several lines: JSON, hex, text. */
export function AreaField(props: AreaFieldProps) {
    return (
        <DialogField label={props.label} help={props.help} error={props.error}>
            <Input.TextArea
                rows={props.rows ?? 4}
                value={props.value}
                placeholder={props.placeholder}
                className={props.mono === false ? undefined : styles.mono}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                aria-label={String(props.label)}
                onChange={e => props.onChange(e.target.value)}
            />
        </DialogField>
    );
}
